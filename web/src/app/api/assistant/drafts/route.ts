import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { draftRequestSchema } from '@/lib/validation';
import { draftFollowUp } from '@/lib/ai/grounding';
import type { DealEvent, DealLine, EvidenceFile, RecallSource, Supplier } from '@/lib/types';

/**
 * POST /api/assistant/drafts
 * Shop member with assistant.ask.
 *
 * `{ dealId, selectedEventIds, goal }` -> an editable draft plus cited ids.
 *
 * Vendra never sends this message and never places an order. It returns text
 * the retailer reviews, edits and sends themselves.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`assistant:draft:${user.userId}`, RATE_LIMITS.assistant);

  const body = await request.json().catch(() => ({}));
  const input = draftRequestSchema.parse(body);

  const context = await resolveShop(user.userId, typeof body.shopId === 'string' ? body.shopId : null);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'assistant.ask')) {
    throw ApiError.forbidden('You do not have permission to use Ask Vendra in this shop.');
  }

  const supabase = await createClient();

  // The deal must belong to this shop.
  const { data: dealRow } = await supabase
    .from('deals')
    .select('*')
    .eq('shop_id', context.shop.id)
    .eq('id', input.dealId)
    .maybeSingle();

  if (!dealRow) throw ApiError.notFound('That deal was not found in this shop.');

  // Only events inside this shop AND this deal may be used.
  const { data: eventRows } = await supabase
    .from('deal_events')
    .select('*')
    .eq('shop_id', context.shop.id)
    .eq('deal_id', input.dealId)
    .in('id', input.selectedEventIds)
    .is('superseded_at', null)
    .order('occurred_at', { ascending: true });

  const events = (eventRows ?? []) as DealEvent[];

  if (events.length === 0) {
    throw ApiError.validation(
      'None of the selected records are available in this shop.',
      { selectedEventIds: 'Select records from this deal.' },
    );
  }

  const [{ data: lineRows }, { data: evidenceRows }, { data: supplierRow }] = await Promise.all([
    supabase.from('deal_lines').select('*').eq('shop_id', context.shop.id).eq('deal_id', input.dealId),
    supabase
      .from('evidence_files')
      .select('*')
      .eq('shop_id', context.shop.id)
      .eq('deal_id', input.dealId)
      .is('deleted_at', null),
    supabase
      .from('suppliers')
      .select('*')
      .eq('shop_id', context.shop.id)
      .eq('id', dealRow.supplier_id)
      .maybeSingle(),
  ]);

  const sources: RecallSource[] = events.map((event) => ({
    eventId: event.id,
    dealId: input.dealId,
    supplierName: (supplierRow as Supplier | null)?.display_name ?? 'This supplier',
    eventType: event.event_type,
    occurredAt: event.occurred_at,
    summary: event.summary,
    headline: dealRow.headline,
    dealDate: dealRow.deal_date,
    currencyCode: dealRow.currency_code,
    lines: ((lineRows ?? []) as DealLine[]).map((line) => ({
      productLabel: line.product_label_snapshot,
      quotedQuantity: line.quoted_quantity,
      agreedQuantity: line.agreed_quantity,
      receivedQuantity: line.received_quantity,
      unitLabel: line.unit_label,
      quotedUnitPrice: line.quoted_unit_price,
      agreedUnitPrice: line.agreed_unit_price,
    })),
    evidence: ((evidenceRows ?? []) as EvidenceFile[])
      .filter((file) => !file.event_id || input.selectedEventIds.includes(file.event_id))
      .map((file) => ({
        id: file.id,
        originalFilename: file.original_filename,
        contentType: file.content_type,
        uploadedAt: file.uploaded_at,
      })),
  }));

  const result = await draftFollowUp({ goal: input.goal, sources });

  return NextResponse.json({
    draft: result.draft,
    sourceEventIds: result.sourceEventIds,
    usedRecords: sources.length,
    modelUsed: result.modelUsed,
    failureReason: result.failureReason,
    // An explicit reminder, so the product boundary is visible in the API too.
    notice: 'Vendra does not send this message. Review it, edit it, and send it yourself.',
  });
});