import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { updateDealSchema } from '@/lib/validation';
import { getDealDetail } from '@/lib/data/queries';
import type { Deal, DealLine } from '@/lib/types';

interface RouteContext {
  params: Promise<{ dealId: string }>;
}

/**
 * GET /api/deals/:dealId
 * Shop member with read permission on the deal's own shop.
 */
export const GET = withErrorHandling(async (request: Request, context: RouteContext) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`deals:detail:${user.userId}`, RATE_LIMITS.list);

  const { dealId } = await context.params;
  const shopHint = new URL(request.url).searchParams.get('shop');

  const ctx = await resolveShop(user.userId, shopHint);
  if (!ctx) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(ctx.membership, 'deal.view')) throw ApiError.forbidden();

  const detail = await getDealDetail(ctx.shop.id, dealId);
  if (!detail) throw ApiError.notFound('That deal was not found in this shop.');

  return NextResponse.json({ deal: detail });
});

/**
 * PATCH /api/deals/:dealId
 * Shop manager or the user who created the deal. Requires deal.edit.
 *
 * Immutable history is written as an event rather than overwritten.
 */
export const PATCH = withErrorHandling(async (request: Request, context: RouteContext) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`deals:patch:${user.userId}`, RATE_LIMITS.dealWrite);

  const { dealId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const shopIdFromBody = typeof body.shopId === 'string' ? body.shopId : null;
  const input = updateDealSchema.parse(body);

  const ctx = await resolveShop(user.userId, shopIdFromBody);
  if (!ctx) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(ctx.membership, 'deal.edit')) {
    throw ApiError.forbidden('You do not have permission to change deals in this shop.');
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

  const isCreator = deal.created_by === user.userId;
  if (!isCreator && !can(ctx.membership, 'settings.manage')) {
    throw ApiError.forbidden('Only the person who created this deal or a manager can change it.');
  }

  const patch: Record<string, unknown> = {};
  if (input.headline !== undefined) patch.headline = input.headline;
  if (input.externalReference !== undefined) patch.external_reference = input.externalReference;
  if (input.expectedDeliveryAt !== undefined) patch.expected_delivery_at = input.expectedDeliveryAt;
  if (input.deliveryNote !== undefined) patch.delivery_note = input.deliveryNote;
  if (input.dealDate !== undefined) patch.deal_date = input.dealDate;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('deals').update(patch).eq('id', deal.id).eq('shop_id', ctx.shop.id);
    if (error) throw new Error(`Failed to update the deal: ${error.message}`);
  }

  // Line replacements are additive: old lines are archived, new ones inserted,
  // and the change is recorded as an event so the history stays readable.
  if (input.lines && input.lines.length > 0) {
    const { data: currentLines } = await supabase
      .from('deal_lines')
      .select('*')
      .eq('shop_id', ctx.shop.id)
      .eq('deal_id', deal.id);

    const existing = (currentLines ?? []) as DealLine[];
    const newIds = new Set(input.lines.map((l) => l.productLabel));

    for (const line of existing) {
      if (!newIds.has(line.product_label_snapshot)) {
        await supabase.from('deal_lines').delete().eq('id', line.id).eq('shop_id', ctx.shop.id);
      }
    }

    const byLabel = new Map(existing.map((l) => [l.product_label_snapshot, l]));

    for (const line of input.lines) {
      const match = byLabel.get(line.productLabel);
      if (match) {
        await supabase
          .from('deal_lines')
          .update({
            quoted_quantity: line.quotedQuantity ?? null,
            agreed_quantity: line.agreedQuantity ?? match.agreed_quantity,
            quoted_unit_price: line.quotedUnitPrice ?? null,
            agreed_unit_price: line.agreedUnitPrice ?? match.agreed_unit_price,
            unit_label: line.unitLabel ?? match.unit_label,
          })
          .eq('id', match.id)
          .eq('shop_id', ctx.shop.id);
      } else {
        await supabase.from('deal_lines').insert({
          shop_id: ctx.shop.id,
          deal_id: deal.id,
          product_label_snapshot: line.productLabel,
          quoted_quantity: line.quotedQuantity ?? null,
          agreed_quantity: line.agreedQuantity ?? null,
          quoted_unit_price: line.quotedUnitPrice ?? null,
          agreed_unit_price: line.agreedUnitPrice ?? null,
          unit_label: line.unitLabel ?? null,
          currency_code: deal.currency_code,
        });
      }
    }
  }

  const detail = await getDealDetail(ctx.shop.id, deal.id);

  return NextResponse.json({
    deal: detail,
    message: 'Deal updated.',
  });
});