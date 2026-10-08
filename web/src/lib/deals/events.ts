/**
 * Append a canonical deal event and, when the event is a confirmed fact,
 * write the corresponding memory.
 *
 * This is the single write path for deal events. Every call site goes through
 * here so that:
 *   - tenant scope is derived, never trusted from the client
 *   - the memory sync row is always created for a canonical event
 *   - a memory failure never rolls back the relational record
 */

import { createClient } from '@/lib/supabase/server';
import { ApiError } from '@/lib/api';
import { statusAfterEvent } from '@/lib/data/queries';
import { writeMemoryForEvent, type WriteOutcome } from '@/lib/memory/service';
import type { Deal, DealEvent, DealStatus } from '@/lib/types';

export interface AppendEventInput {
  shopId: string;
  dealId: string;
  userId: string;
  eventType: DealEvent['event_type'];
  summary: string;
  supplierLabel: string;
  occurredAt?: string;
  quotedTotal?: number | null;
  agreedTotal?: number | null;
  receivedTotal?: number | null;
  currencyCode?: string | null;
  issueType?: string | null;
  condition?: string | null;
  resolutionOutcome?: string | null;
  outcomeCode?: string | null;
  evidenceIds?: string[];
  supersedesEventId?: string | null;
  nextStatus?: DealStatus;
}

export interface AppendEventResult {
  ok: boolean;
  event: DealEvent | null;
  memory: WriteOutcome | null;
  message: string;
}

export async function appendDealEvent(input: AppendEventInput): Promise<AppendEventResult> {
  const supabase = await createClient();

  // Confirm the deal belongs to this shop before writing anything.
  const { data: dealRow } = await supabase
    .from('deals')
    .select('*')
    .eq('shop_id', input.shopId)
    .eq('id', input.dealId)
    .maybeSingle();

  if (!dealRow) {
    return {
      ok: false,
      event: null,
      memory: null,
      message: 'That deal could not be found in this shop.',
    };
  }

  const deal = dealRow as Deal;

  // A correction must reference an event inside this shop.
  if (input.supersedesEventId) {
    const { data: target } = await supabase
      .from('deal_events')
      .select('id, superseded_at')
      .eq('shop_id', input.shopId)
      .eq('id', input.supersedesEventId)
      .maybeSingle();

    if (!target) {
      throw ApiError.validation('The record being corrected could not be found in this shop.', {
        supersedesEventId: 'That record is not part of this shop.',
      });
    }

    if (target.superseded_at) {
      throw ApiError.conflict('That record has already been corrected. Refresh and try again.');
    }
  }

  // Attach evidence: verify every id belongs to this deal in this shop.
  let evidenceIds: string[] = [];
  if (input.evidenceIds && input.evidenceIds.length > 0) {
    const { data: evidence } = await supabase
      .from('evidence_files')
      .select('id')
      .eq('shop_id', input.shopId)
      .eq('deal_id', input.dealId)
      .in('id', input.evidenceIds)
      .is('deleted_at', null);

    evidenceIds = (evidence ?? []).map((e) => e.id);
  }

  const { data: eventRow, error: eventError } = await supabase
    .from('deal_events')
    .insert({
      shop_id: input.shopId,
      deal_id: input.dealId,
      event_type: input.eventType,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      summary: input.summary,
      quoted_total: input.quotedTotal ?? null,
      agreed_total: input.agreedTotal ?? null,
      received_total: input.receivedTotal ?? null,
      currency_code: input.currencyCode ?? deal.currency_code,
      issue_type: input.issueType ?? null,
      condition: input.condition ?? null,
      resolution_outcome: input.resolutionOutcome ?? null,
      outcome_code: input.outcomeCode ?? null,
      created_by: input.userId,
      supersedes_event_id: input.supersedesEventId ?? null,
    })
    .select('*')
    .single();

  if (eventError || !eventRow) {
    return {
      ok: false,
      event: null,
      memory: null,
      message: `The record could not be saved: ${eventError?.message ?? 'unknown error'}`,
    };
  }

  const event = eventRow as DealEvent;

  // Evidence is linked to the event that justified it.
  if (evidenceIds.length > 0) {
    await supabase
      .from('evidence_files')
      .update({ event_id: event.id })
      .eq('shop_id', input.shopId)
      .in('id', evidenceIds);
  }

  // Mark the replaced event as superseded. The original row is retained.
  if (input.supersedesEventId) {
    await supabase
      .from('deal_events')
      .update({ superseded_at: new Date().toISOString() })
      .eq('shop_id', input.shopId)
      .eq('id', input.supersedesEventId);
  }

  const nextStatus = input.nextStatus ?? statusAfterEvent(deal.status, input.eventType);

  if (nextStatus !== deal.status) {
    const { error: statusError } = await supabase
      .from('deals')
      .update({ status: nextStatus })
      .eq('id', deal.id)
      .eq('shop_id', input.shopId);

    if (statusError) {
      // The event is saved but the status did not move. This is recoverable
      // and must be reported rather than hidden.
      return {
        ok: false,
        event,
        memory: null,
        message:
          'The event was saved, but the deal status did not update. Refresh the deal and try again.',
      };
    }
  }

  // Memory is written only for the retailer-confirmed event, and only after the
  // relational record exists.
  const memory = await writeMemoryForEvent({
    shopId: input.shopId,
    event,
    supplierLabel: input.supplierLabel,
    supersedesEventId: input.supersedesEventId ?? null,
  });

  return {
    ok: true,
    event,
    memory,
    message:
      memory.status === 'ready'
        ? 'Saved and added to deal memory.'
        : memory.status === 'processing' || memory.status === 'queued'
          ? 'Saved. Adding to deal memory — this can take a moment.'
          : 'Saved. The memory could not be written yet; you can retry from the deal record.',
  };
}