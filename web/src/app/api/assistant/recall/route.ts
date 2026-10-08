import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { recallRequestSchema } from '@/lib/validation';
import {
  resolveRecalledSources,
  searchCanonicalEvents,
  reconcilePendingWrites,
} from '@/lib/memory/service';
import { answerFromSources } from '@/lib/ai/grounding';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AssistantSession, RecallSource } from '@/lib/types';

/**
 * POST /api/assistant/recall
 * Shop member with assistant.ask.
 *
 * `{ question, sessionId? }` -> `{ answer, sources[], memoryStatus }`
 *
 * Grounding sequence, in this order and with no shortcuts:
 *   1. derive the authorised shop from the session membership
 *   2. recall memories in that shop's namespace only
 *   3. resolve every recalled memory to a current canonical event in the SAME shop
 *   4. discard anything unresolvable, deleted or superseded
 *   5. if nothing remains, say no saved record was found
 *   6. only then generate an answer, with citations
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`assistant:recall:${user.userId}`, RATE_LIMITS.assistant);

  const body = await request.json().catch(() => ({}));
  const input = recallRequestSchema.parse(body);

  // `shopId` in the body is a hint only. A hint that does not resolve to an
  // authorised membership is ignored, not trusted.
  const context = await resolveShop(user.userId, input.shopId);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'assistant.ask')) {
    throw ApiError.forbidden('You do not have permission to use Ask Vendra in this shop.');
  }

  // Promote any finished memory writes so recall is not stale.
  await reconcilePendingWrites(context.shop.id);

  const resolved = await resolveRecalledSources({
    shopId: context.shop.id,
    question: input.question,
  });

  let sources: RecallSource[] = resolved.sources;
  let memoryStatus: 'ready' | 'record_search' | 'unavailable' | 'no_match' = 'ready';
  const unavailableReason: string | null = resolved.unavailableReason;

  if (!resolved.available) {
    // Semantic recall is unavailable. Fall back to a direct search of this
    // shop's own canonical records and label it accurately.
    sources = await searchCanonicalEvents({ shopId: context.shop.id, question: input.question });
    memoryStatus = 'unavailable';
  } else if (sources.length === 0) {
    // Recall worked but returned nothing usable. Fall back to a record search
    // so a retailer is not told "no record" when one plainly exists.
    sources = await searchCanonicalEvents({ shopId: context.shop.id, question: input.question });
    memoryStatus = sources.length === 0 ? 'no_match' : 'record_search';
  }

  const answer = await answerFromSources({ question: input.question, sources });

  // Persist the turn for conversation continuity only. Durable memory is always
  // a deal_event plus a walrus_memory_sync row, never this transcript.
  const sessionId = await persistTurn({
    userId: user.userId,
    shopId: context.shop.id,
    requestedSessionId: input.sessionId,
    question: input.question,
    answer: answer.answer,
    grounded: answer.grounded,
    sources,
    memoryStatus,
  });

  return NextResponse.json({
    answer: answer.answer,
    grounded: answer.grounded,
    sources: sources.map(publicSource),
    memoryStatus,
    unavailableReason,
    memoryDiscarded: resolved.discarded,
    modelUsed: answer.modelUsed,
    modelId: answer.modelId,
    failureReason: answer.failureReason,
    sessionId,
  });
});

async function persistTurn(input: {
  userId: string;
  shopId: string;
  requestedSessionId: string | null | undefined;
  question: string;
  answer: string;
  grounded: boolean;
  sources: RecallSource[];
  memoryStatus: string;
}): Promise<string | null> {
  const supabase = await createClient();

  let sessionId = input.requestedSessionId ?? null;

  if (sessionId) {
    // Confirm the session belongs to this user and this shop before appending.
    const { data: session } = await supabase
      .from('assistant_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('shop_id', input.shopId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (!session) sessionId = null;
  }

  if (!sessionId) {
    const { data: created } = await supabase
      .from('assistant_sessions')
      .insert({
        shop_id: input.shopId,
        user_id: input.userId,
        title: input.question.slice(0, 120),
      })
      .select('id')
      .single();

    sessionId = (created as AssistantSession | null)?.id ?? null;
  }

  if (!sessionId) return null;

  const eventIds = input.sources.map((s) => s.eventId);
  const evidenceIds = input.sources.flatMap((s) => s.evidence.map((e) => e.id));

  await supabase.from('assistant_messages').insert([
    {
      shop_id: input.shopId,
      session_id: sessionId,
      role: 'user',
      content: input.question,
      grounded: false,
      source_event_ids: [],
      source_evidence_ids: [],
      memory_status: input.memoryStatus,
    },
    {
      shop_id: input.shopId,
      session_id: sessionId,
      role: 'assistant',
      content: input.answer,
      grounded: input.grounded,
      source_event_ids: eventIds,
      source_evidence_ids: evidenceIds,
      memory_status: input.memoryStatus,
    },
  ]);

  await supabase
    .from('assistant_sessions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', sessionId);

  return sessionId;
}

/** The shape returned to the browser. Contains no internal identifiers. */
function publicSource(source: RecallSource) {
  return {
    eventId: source.eventId,
    dealId: source.dealId,
    supplierName: source.supplierName,
    eventType: source.eventType,
    occurredAt: source.occurredAt,
    summary: source.summary,
    headline: source.headline,
    dealDate: source.dealDate,
    currencyCode: source.currencyCode,
    lines: source.lines,
    evidence: source.evidence.map((e) => ({ id: e.id, originalFilename: e.originalFilename })),
  };
}

/** Exposed for the settings screen so the shop's memory scope can be shown. */
export async function readMemoryStatus(shopId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('walrus_memory_sync')
    .select('status')
    .eq('shop_id', shopId);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ status: string }>) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}