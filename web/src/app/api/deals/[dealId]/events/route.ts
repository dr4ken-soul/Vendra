import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { createEventSchema } from '@/lib/validation';
import { appendDealEvent } from '@/lib/deals/events';
import type { Deal } from '@/lib/types';

interface RouteContext {
  params: Promise<{ dealId: string }>;
}

/**
 * POST /api/deals/:dealId/events
 * Shop member with deal.event.
 *
 * `{ eventType, occurredAt?, summary, structuredPayload?, evidenceIds? }`
 *
 * Returns the event and its memory-sync state. The two are reported separately
 * so the UI never implies a fact is recallable before the write completes.
 */
export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`deals:event:${user.userId}`, RATE_LIMITS.dealWrite);

  const { dealId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input = createEventSchema.parse(body);

  const ctx = await resolveShop(user.userId, typeof body.shopId === 'string' ? body.shopId : null);
  if (!ctx) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(ctx.membership, 'deal.event')) {
    throw ApiError.forbidden('You do not have permission to record events in this shop.');
  }

  const supabase = await createClient();

  const { data: dealRow } = await supabase
    .from('deals')
    .select('*')
    .eq('shop_id', ctx.shop.id)
    .eq('id', dealId)
    .maybeSingle();

  if (!dealRow) throw ApiError.notFound('That deal was not found in this shop.');

  const deal = dealRow as Deal;

  const { data: supplierRow } = await supabase
    .from('suppliers')
    .select('display_name')
    .eq('shop_id', ctx.shop.id)
    .eq('id', deal.supplier_id)
    .maybeSingle();

  const supplierLabel = supplierRow?.display_name ?? 'This supplier';

  // A delivery check also writes per-line received quantities.
  let receivedTotal = input.receivedTotal ?? null;

  if (input.receivedLines && input.receivedLines.length > 0) {
    const lineIds = input.receivedLines.map((l) => l.lineId);

    const { data: lines } = await supabase
      .from('deal_lines')
      .select('id')
      .eq('shop_id', ctx.shop.id)
      .eq('deal_id', deal.id)
      .in('id', lineIds);

    const allowedIds = new Set(((lines ?? []) as Array<{ id: string }>).map((l) => l.id));

    for (const line of input.receivedLines) {
      // Ignore any line id that is not part of this deal.
      if (!allowedIds.has(line.lineId)) continue;

      await supabase
        .from('deal_lines')
        .update({ received_quantity: line.receivedQuantity ?? null })
        .eq('id', line.lineId)
        .eq('shop_id', ctx.shop.id)
        .eq('deal_id', deal.id);
    }

    if (receivedTotal === null) {
      const { data: updatedLines } = await supabase
        .from('deal_lines')
        .select('received_quantity, agreed_unit_price')
        .eq('shop_id', ctx.shop.id)
        .eq('deal_id', deal.id);

      let total = 0;
      let seen = false;
      for (const line of (updatedLines ?? []) as Array<{
        received_quantity: number | null;
        agreed_unit_price: number | null;
      }>) {
        if (line.received_quantity === null) continue;
        const price = line.agreed_unit_price ?? 0;
        total += Number(line.received_quantity) * Number(price);
        seen = true;
      }
      if (seen) receivedTotal = Math.round(total * 100) / 100;
    }
  }

  // Decide the deal's resulting status from the lines actually recorded, so
  // "part delivered" is derived rather than asserted by the client.
  let nextStatus: string | undefined;

  if (input.eventType === 'delivery_checked') {
    const { data: currentLines } = await supabase
      .from('deal_lines')
      .select('agreed_quantity, received_quantity')
      .eq('shop_id', ctx.shop.id)
      .eq('deal_id', deal.id);

    const lines = (currentLines ?? []) as Array<{
      agreed_quantity: number | null;
      received_quantity: number | null;
    }>;

    const anyShort =
      lines.some((l) => l.received_quantity !== null && l.agreed_quantity !== null && Number(l.received_quantity) < Number(l.agreed_quantity)) ||
      lines.some((l) => l.received_quantity === null);

    nextStatus = anyShort ? 'part_delivered' : 'delivered';
  }

  const result = await appendDealEvent({
    shopId: ctx.shop.id,
    dealId: deal.id,
    userId: user.userId,
    eventType: input.eventType,
    summary: input.summary,
    supplierLabel,
    occurredAt: input.occurredAt,
    quotedTotal: input.quotedTotal ?? null,
    agreedTotal: input.agreedTotal ?? null,
    receivedTotal,
    currencyCode: deal.currency_code,
    issueType: input.issueType ?? null,
    condition: input.condition ?? null,
    resolutionOutcome: input.resolutionOutcome ?? null,
    outcomeCode: input.outcomeCode ?? null,
    evidenceIds: input.evidenceIds ?? [],
    supersedesEventId: input.supersedesEventId ?? null,
    nextStatus: nextStatus as never,
  });

  if (!result.ok && !result.event) {
    throw new Error(result.message);
  }

  await supabase.from('audit_events').insert({
    shop_id: ctx.shop.id,
    actor_user_id: user.userId,
    action: `deal.event.${input.eventType}`,
    target_type: 'deal_event',
    target_id: result.event?.id ?? null,
    metadata: { dealId: deal.id },
  });

  const { data: updatedDeal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', deal.id)
    .single();

  return NextResponse.json(
    {
      event: result.event,
      deal: updatedDeal,
      memory: result.memory,
      message: result.message,
    },
    { status: result.ok ? 201 : 207 },
  );
});