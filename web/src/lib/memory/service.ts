/**
 * Memory orchestration.
 *
 * Joins the two stores according to the contract in DATA_API_CONTRACTS.md
 * section 5 and WALRUS_MEMORY_PLAN.md:
 *
 *   WRITE   confirmed deal event -> memory statement -> Walrus (shop namespace)
 *   RECALL  question -> Walrus memories -> resolve each to a canonical Supabase
 *            event inside the SAME shop -> discard anything unresolvable ->
 *            only then send context to the model
 *
 * A recalled memory is never treated as proof by itself. Every fact used in an
 * answer must resolve to a canonical, non-superseded event.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { walrusEnv } from '@/lib/env';
import { recall, remember, checkJob, composeMemoryText, namespaceStatus } from './walrus';
import type {
  DealEvent,
  DealLine,
  Deal,
  EvidenceFile,
  RecallSource,
  WalrusMemorySync,
} from '@/lib/types';

export interface MemoryScope {
  shopId: string;
  namespace: string | null;
}

export interface WriteOutcome {
  /** Reported honestly: never 'ready' until the job is confirmed complete. */
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'skipped' | 'superseded';
  syncId: string | null;
  jobId: string | null;
  errorCode: string | null;
  detail: string;
}

/**
 * Persist a memory for one retailer-confirmed deal event.
 *
 * Called only from the event-write path. Chat text is never auto-persisted.
 * A failure here must NOT roll back the deal record: the deal stays saved and
 * the sync row records the failure so the UI can show a retry.
 */
export async function writeMemoryForEvent(input: {
  shopId: string;
  event: DealEvent;
  supplierLabel: string;
  /** Set when this event corrects an earlier one. */
  supersedesEventId?: string | null;
}): Promise<WriteOutcome> {
  const env = walrusEnv();
  const admin = createAdminClient();

  // One shop, one namespace. A shop whose memory setup has not completed has
  // no namespace and therefore no memory scope at all.
  const { data: shopRow } = await admin
    .from('shops')
    .select('walrus_namespace, memory_status')
    .eq('id', input.shopId)
    .maybeSingle();

  const namespace = shopRow?.walrus_namespace ?? null;
  const memoryStatus = shopRow?.memory_status ?? 'pending';

  if (!namespace || memoryStatus === 'revoked') {
    return {
      status: 'skipped',
      syncId: null,
      jobId: null,
      errorCode: 'no_namespace',
      detail: 'This shop\'s memory scope is not active, so no memory was written.',
    };
  }

  // Supersede the previous version of this event's memory, if any.
  if (input.supersedesEventId) {
    await admin
      .from('walrus_memory_sync')
      .update({ status: 'superseded' })
      .eq('event_id', input.supersedesEventId)
      .in('status', ['queued', 'processing', 'ready']);
  }

  // Determine the next memory version for the new event.
  const { data: existingVersions } = await admin
    .from('walrus_memory_sync')
    .select('id, memory_version, status')
    .eq('event_id', input.event.id)
    .order('memory_version', { ascending: false })
    .limit(1);

  const prior = existingVersions?.[0];
  if (prior && prior.status === 'ready') {
    // Already stored and confirmed. Do not write a duplicate.
    return {
      status: 'ready',
      syncId: prior.id,
      jobId: null,
      errorCode: null,
      detail: 'This event is already in deal memory.',
    };
  }

  const memoryVersion = (prior?.memory_version ?? 0) + 1;

  // Record the intent BEFORE the network call so a crash cannot lose the
  // fact that a memory was owed for this event.
  const { data: syncRow, error: syncError } = await admin
    .from('walrus_memory_sync')
    .insert({
      shop_id: input.shopId,
      deal_id: input.event.deal_id,
      event_id: input.event.id,
      namespace,
      status: 'queued',
      memory_version: memoryVersion,
      supersedes_sync_id: prior?.id ?? null,
      memory_text: composeMemoryText({
        occurredAt: input.event.occurred_at,
        eventType: input.event.event_type,
        summary: input.event.summary,
        supplierLabel: input.supplierLabel,
        dealId: input.event.deal_id,
        eventId: input.event.id,
      }),
    })
    .select('id')
    .single();

  if (syncError || !syncRow) {
    console.error('[vendra] failed to create memory sync row', syncError?.message);
    return {
      status: 'failed',
      syncId: null,
      jobId: null,
      errorCode: 'sync_row_failed',
      detail: 'The deal was saved, but its memory could not be queued. Retry from the deal record.',
    };
  }

  const memoryText = composeMemoryText({
    occurredAt: input.event.occurred_at,
    eventType: input.event.event_type,
    summary: input.event.summary,
    supplierLabel: input.supplierLabel,
    dealId: input.event.deal_id,
    eventId: input.event.id,
  });

  const result = await remember({
    env,
    namespace,
    text: memoryText,
    idempotencyKey: `${input.event.id}:${memoryVersion}`,
  });

  const nextStatus: WalrusMemorySync['status'] =
    result.status === 'queued' ? 'processing' : result.status === 'skipped' ? 'failed' : result.status;

  await admin
    .from('walrus_memory_sync')
    .update({
      status: nextStatus,
      job_id: result.jobId,
      memory_blob_id: result.blobId,
      last_error_code: result.errorCode,
      last_error_at: result.errorCode ? new Date().toISOString() : null,
      attempt_count: 1,
      memory_text: memoryText,
    })
    .eq('id', syncRow.id);

  return {
    status: nextStatus,
    syncId: syncRow.id,
    jobId: result.jobId,
    errorCode: result.errorCode,
    detail: result.detail,
  };
}

/**
 * Reconcile outstanding memory jobs for a shop.
 *
 * Called when the Ask screen or the settings screen loads, so a queued write is
 * promoted to `ready` as soon as the relayer confirms it. This is what keeps
 * the UI from ever showing "memory syncing" forever when the job is done.
 */
export async function reconcilePendingWrites(
  shopId: string,
): Promise<{ checked: number; ready: number; failed: number }> {
  const env = walrusEnv();
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from('walrus_memory_sync')
    .select('id, job_id, namespace')
    .eq('shop_id', shopId)
    .in('status', ['queued', 'processing']);

  if (!pending || pending.length === 0) {
    return { checked: 0, ready: 0, failed: 0 };
  }

  let ready = 0;
  let failed = 0;

  for (const row of pending) {
    if (!row.job_id) {
      // Queued but never got a job id. Check the queued status directly.
      await admin
        .from('walrus_memory_sync')
        .update({ status: 'failed', last_error_code: 'no_job_id', last_error_at: new Date().toISOString() })
        .eq('id', row.id);
      failed += 1;
      continue;
    }

    const result = await checkJob({ env, namespace: row.namespace, jobId: row.job_id });

    if (result.state === 'ready') {
      await admin
        .from('walrus_memory_sync')
        .update({ status: 'ready', memory_blob_id: result.blobId, verified_at: new Date().toISOString() })
        .eq('id', row.id);
      ready += 1;
    } else if (result.state === 'failed') {
      await admin
        .from('walrus_memory_sync')
        .update({ status: 'failed', last_error_code: result.errorCode, last_error_at: new Date().toISOString() })
        .eq('id', row.id);
      failed += 1;
    }
  }

  return { checked: pending.length, ready, failed };
}

/** Retry one failed memory write. Managers only; RLS enforces that too. */
export async function retryMemoryWrite(
  shopId: string,
  syncId: string,
): Promise<WriteOutcome> {
  const admin = createAdminClient();

  const { data: syncRow } = await admin
    .from('walrus_memory_sync')
    .select('*')
    .eq('id', syncId)
    .eq('shop_id', shopId)
    .maybeSingle();

  if (!syncRow) {
    return {
      status: 'failed',
      syncId: null,
      jobId: null,
      errorCode: 'not_found',
      detail: 'That memory record could not be found in this shop.',
    };
  }

  if (!syncRow.memory_text) {
    return {
      status: 'failed',
      syncId,
      jobId: null,
      errorCode: 'no_memory_text',
      detail: 'There is no confirmed fact to store for this event.',
    };
  }

  if (syncRow.status === 'ready') {
    return {
      status: 'ready',
      syncId,
      jobId: syncRow.job_id,
      errorCode: null,
      detail: 'This event is already in deal memory.',
    };
  }

  const { data: event } = await admin
    .from('deal_events')
    .select('*')
    .eq('id', syncRow.event_id)
    .maybeSingle();

  const env = walrusEnv();
  const result = await remember({
    env,
    namespace: syncRow.namespace,
    text: syncRow.memory_text,
    // A new version keeps the retry from collapsing onto the already-failed
    // job while still preventing a duplicate of the new attempt.
    idempotencyKey: `${syncRow.event_id}:${syncRow.memory_version}:retry-${syncRow.attempt_count + 1}`,
  });

  const nextStatus: WalrusMemorySync['status'] =
    result.status === 'queued' ? 'processing' : result.status === 'skipped' ? 'failed' : result.status;

  await admin
    .from('walrus_memory_sync')
    .update({
      status: nextStatus,
      job_id: result.jobId,
      memory_blob_id: result.blobId,
      last_error_code: result.errorCode,
      last_error_at: result.errorCode ? new Date().toISOString() : null,
      attempt_count: syncRow.attempt_count + 1,
    })
    .eq('id', syncRow.id);

  void event;

  return {
    status: nextStatus,
    syncId,
    jobId: result.jobId,
    errorCode: result.errorCode,
    detail: result.detail,
  };
}

/**
 * Resolve recalled memories to canonical, current deal records in ONE shop.
 *
 * Anything that cannot be resolved is DISCARDED:
 *   - memory with no parseable source event
 *   - event that no longer exists (deleted with the shop)
 *   - event that has been superseded by a correction
 *   - event that belongs to a different shop
 *
 * The result is the only context a model is ever allowed to see.
 */
export async function resolveRecalledSources(input: {
  shopId: string;
  question: string;
}): Promise<{
  available: boolean;
  unavailableReason: string | null;
  sources: RecallSource[];
  /** Number of memories discarded during grounding, for honest diagnostics. */
  discarded: number;
  /** The memory texts that were grounded, for the audit trail. */
  groundedMemoryIds: string[];
}> {
  const env = walrusEnv();
  const admin = createAdminClient();

  const { data: shopRow } = await admin
    .from('shops')
    .select('walrus_namespace')
    .eq('id', input.shopId)
    .maybeSingle();

  const namespace = shopRow?.walrus_namespace ?? null;

  if (!namespace || !env) {
    return {
      available: false,
      unavailableReason: env
        ? 'This shop\'s memory scope is not active yet.'
        : 'Deal memory is not connected in this environment. You can still browse your saved deals.',
      sources: [],
      discarded: 0,
      groundedMemoryIds: [],
    };
  }

  const recalled = await recall({ env, namespace, query: input.question, limit: 10 });

  if (!recalled.ok) {
    return {
      available: false,
      unavailableReason: recalled.unavailableReason,
      sources: [],
      discarded: 0,
      groundedMemoryIds: [],
    };
  }

  if (recalled.memories.length === 0) {
    return {
      available: true,
      unavailableReason: null,
      sources: [],
      discarded: 0,
      groundedMemoryIds: [],
    };
  }

  const eventIds = [
    ...new Set(
      recalled.memories
        .map((m) => m.eventId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  if (eventIds.length === 0) {
    // Every recalled memory was untraceable. They cannot support an answer.
    return {
      available: true,
      unavailableReason: null,
      sources: [],
      discarded: recalled.memories.length,
      groundedMemoryIds: [],
    };
  }

  // Resolve ONLY inside this shop. RLS is bypassed here deliberately because the
  // shop_id predicate is the authorisation check and must hold even when the
  // caller's own token cannot see the row.
  const { data: events } = await admin
    .from('deal_events')
    .select('*')
    .eq('shop_id', input.shopId)
    .in('id', eventIds)
    .is('superseded_at', null);

  const liveEvents = (events ?? []) as DealEvent[];

  if (liveEvents.length === 0) {
    return {
      available: true,
      unavailableReason: null,
      sources: [],
      discarded: recalled.memories.length,
      groundedMemoryIds: [],
    };
  }

  const liveDealIds = [...new Set(liveEvents.map((e) => e.deal_id))];

  const [{ data: deals }, { data: lines }, { data: evidence }] = await Promise.all([
    admin
      .from('deals')
      .select('*')
      .eq('shop_id', input.shopId)
      .in('id', liveDealIds),
    admin
      .from('deal_lines')
      .select('*')
      .eq('shop_id', input.shopId)
      .in('deal_id', liveDealIds),
    admin
      .from('evidence_files')
      .select('*')
      .eq('shop_id', input.shopId)
      .in('deal_id', liveDealIds)
      .is('deleted_at', null),
  ]);

  const dealById = new Map(((deals ?? []) as Deal[]).map((d) => [d.id, d]));
  const supplierIds = [...new Set((deals ?? []).map((d) => d.supplier_id))];

  const { data: suppliers } = await admin
    .from('suppliers')
    .select('id, display_name')
    .eq('shop_id', input.shopId)
    .in('id', supplierIds);

  const supplierNameById = new Map(
    ((suppliers ?? []) as Array<{ id: string; display_name: string }>).map((s) => [s.id, s.display_name]),
  );

  const linesByDeal = groupBy((lines ?? []) as DealLine[], (l) => l.deal_id);
  const evidenceByDeal = groupBy((evidence ?? []) as EvidenceFile[], (e) => e.deal_id);

  const sources: RecallSource[] = [];
  const groundedIds: string[] = [];

  for (const event of liveEvents) {
    const deal = dealById.get(event.deal_id);
    if (!deal) continue;

    sources.push({
      eventId: event.id,
      dealId: deal.id,
      supplierName: supplierNameById.get(deal.supplier_id) ?? 'This supplier',
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      summary: event.summary,
      headline: deal.headline,
      dealDate: deal.deal_date,
      currencyCode: deal.currency_code,
      lines: (linesByDeal.get(deal.id) ?? []).map((line) => ({
        productLabel: line.product_label_snapshot,
        quotedQuantity: line.quoted_quantity,
        agreedQuantity: line.agreed_quantity,
        receivedQuantity: line.received_quantity,
        unitLabel: line.unit_label,
        quotedUnitPrice: line.quoted_unit_price,
        agreedUnitPrice: line.agreed_unit_price,
      })),
      evidence: (evidenceByDeal.get(deal.id) ?? []).map((file) => ({
        id: file.id,
        originalFilename: file.original_filename,
        contentType: file.content_type,
        uploadedAt: file.uploaded_at,
      })),
    });
  }

  const groundedEventIds = new Set(sources.map((s) => s.eventId));
  for (const memory of recalled.memories) {
    if (memory.eventId && groundedEventIds.has(memory.eventId) && memory.blobId) {
      groundedIds.push(memory.blobId);
    }
  }

  // Prefer the newest event for a given deal when duplicates arise, so a
  // correction wins over the fact it replaced.
  sources.sort((a, b) => {
    if (a.dealId !== b.dealId) return a.dealId < b.dealId ? -1 : 1;
    return b.occurredAt.localeCompare(a.occurredAt);
  });

  return {
    available: true,
    unavailableReason: null,
    sources,
    discarded: recalled.memories.length - groundedIds.length,
    groundedMemoryIds: groundedIds,
  };
}

/**
 * Fallback grounding path: when semantic recall is unavailable or returns
 * nothing, search this shop's canonical events directly.
 *
 * This is honest because it only ever returns real records and always labels
 * the result as a record search rather than a memory recall.
 */
export async function searchCanonicalEvents(input: {
  shopId: string;
  question: string;
  limit?: number;
}): Promise<RecallSource[]> {
  const supabase = await createClient();
  const limit = input.limit ?? 6;

  const terms = input.question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 8);

  if (terms.length === 0) return [];

  const orFilter = terms.map((term) => `summary.ilike.%${term.replace(/[%_]/g, '')}%`).join(',');

  const { data: events } = await supabase
    .from('deal_events')
    .select('*')
    .eq('shop_id', input.shopId)
    .is('superseded_at', null)
    .or(orFilter)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  const liveEvents = (events ?? []) as DealEvent[];
  if (liveEvents.length === 0) return [];

  const liveDealIds = [...new Set(liveEvents.map((e) => e.deal_id))];

  const [{ data: deals }, { data: lines }, { data: evidence }, { data: suppliers }] = await Promise.all([
    supabase.from('deals').select('*').eq('shop_id', input.shopId).in('id', liveDealIds),
    supabase.from('deal_lines').select('*').eq('shop_id', input.shopId).in('deal_id', liveDealIds),
    supabase
      .from('evidence_files')
      .select('*')
      .eq('shop_id', input.shopId)
      .in('deal_id', liveDealIds)
      .is('deleted_at', null),
    supabase.from('suppliers').select('id, display_name').eq('shop_id', input.shopId),
  ]);

  const dealById = new Map(((deals ?? []) as Deal[]).map((d) => [d.id, d]));
  const supplierNameById = new Map(
    ((suppliers ?? []) as Array<{ id: string; display_name: string }>).map((s) => [s.id, s.display_name]),
  );
  const linesByDeal = groupBy((lines ?? []) as DealLine[], (l) => l.deal_id);
  const evidenceByDeal = groupBy((evidence ?? []) as EvidenceFile[], (e) => e.deal_id);

  const sources: RecallSource[] = [];
  for (const event of liveEvents) {
    const deal = dealById.get(event.deal_id);
    if (!deal) continue;
    sources.push({
      eventId: event.id,
      dealId: deal.id,
      supplierName: supplierNameById.get(deal.supplier_id) ?? 'This supplier',
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      summary: event.summary,
      headline: deal.headline,
      dealDate: deal.deal_date,
      currencyCode: deal.currency_code,
      lines: (linesByDeal.get(deal.id) ?? []).map((line) => ({
        productLabel: line.product_label_snapshot,
        quotedQuantity: line.quoted_quantity,
        agreedQuantity: line.agreed_quantity,
        receivedQuantity: line.received_quantity,
        unitLabel: line.unit_label,
        quotedUnitPrice: line.quoted_unit_price,
        agreedUnitPrice: line.agreed_unit_price,
      })),
      evidence: (evidenceByDeal.get(deal.id) ?? []).map((file) => ({
        id: file.id,
        originalFilename: file.original_filename,
        contentType: file.content_type,
        uploadedAt: file.uploaded_at,
      })),
    });
  }
  return sources;
}

/** Provider-reported memory count for a shop namespace. Never synthesised. */
export async function getMemoryCount(shopId: string): Promise<{
  count: number;
  known: boolean;
}> {
  const env = walrusEnv();
  if (!env) return { count: 0, known: false };

  const admin = createAdminClient();
  const { data: shopRow } = await admin
    .from('shops')
    .select('walrus_namespace')
    .eq('id', shopId)
    .maybeSingle();

  const namespace = shopRow?.walrus_namespace ?? null;
  if (!namespace) return { count: 0, known: false };

  const status = await namespaceStatus({ env, namespace });
  if (status.memoryCount < 0) return { count: 0, known: false };
  return { count: status.memoryCount, known: true };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}