import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { createDealSchema, listQuerySchema } from '@/lib/validation';
import { listDeals } from '@/lib/data/queries';
import { appendDealEvent } from '@/lib/deals/events';
import type { Deal, DealLine } from '@/lib/types';

/**
 * GET /api/deals
 * Shop member. Filters by supplier, date, status and query.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`deals:list:${user.userId}`, RATE_LIMITS.list);

  const params = new URL(request.url).searchParams;
  const shopHint = params.get('shop');

  const context = await resolveShop(user.userId, shopHint);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'deal.view')) throw ApiError.forbidden();

  const filters = listQuerySchema.parse(Object.fromEntries(params.entries()));
  const result = await listDeals(context.shop.id, filters);

  return NextResponse.json(result);
});

/**
 * POST /api/deals
 * Shop member with deal.create.
 *
 * Creates the deal and its lines, then appends the canonical quote event. The
 * memory write happens inside appendDealEvent so that the sync row is created
 * for the confirmed event and not for the raw form payload.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`deals:write:${user.userId}`, RATE_LIMITS.dealWrite);

  const body = await request.json().catch(() => ({}));
  const input = createDealSchema.parse(body);

  const context = await resolveShop(user.userId, typeof body.shopId === 'string' ? body.shopId : null);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'deal.create')) {
    throw ApiError.forbidden('You do not have permission to create deals in this shop.');
  }

  const supabase = await createClient();

  // The supplier must belong to this shop. The composite foreign key also
  // enforces this in the database.
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, display_name')
    .eq('shop_id', context.shop.id)
    .eq('id', input.supplierId)
    .maybeSingle();

  if (!supplier) {
    throw ApiError.validation('Choose a supplier from this shop.', { supplierId: 'That supplier is not in this shop.' });
  }

  const currencyCode = context.shop.currency_code;

  const { data: dealRow, error: dealError } = await supabase
    .from('deals')
    .insert({
      shop_id: context.shop.id,
      supplier_id: input.supplierId,
      deal_date: input.dealDate,
      expected_delivery_at: input.expectedDeliveryAt ?? null,
      delivery_note: input.deliveryNote ?? null,
      external_reference: input.externalReference ?? null,
      currency_code: currencyCode,
      headline:
        input.headline ??
        `${input.lines.length} item${input.lines.length === 1 ? '' : 's'} from ${supplier.display_name}`,
      status: 'draft',
      created_by: user.userId,
    })
    .select('*')
    .single();

  if (dealError || !dealRow) {
    throw new Error(`Failed to create deal: ${dealError?.message ?? 'unknown error'}`);
  }

  const deal = dealRow as Deal;

  const lineRows = input.lines.map((line) => ({
    shop_id: context.shop.id,
    deal_id: deal.id,
    product_label_snapshot: line.productLabel,
    quoted_quantity: line.quotedQuantity ?? null,
    agreed_quantity: input.termsAgreed ? (line.agreedQuantity ?? line.quotedQuantity ?? null) : null,
    quoted_unit_price: line.quotedUnitPrice ?? null,
    agreed_unit_price: input.termsAgreed ? (line.agreedUnitPrice ?? line.quotedUnitPrice ?? null) : null,
    unit_label: line.unitLabel ?? null,
    currency_code: currencyCode,
  }));

  const { data: lines, error: lineError } = await supabase
    .from('deal_lines')
    .insert(lineRows)
    .select('*');

  if (lineError) {
    // A deal with no lines would be unopenable. Remove it and report cleanly.
    await supabase.from('deals').delete().eq('id', deal.id);
    throw new Error(`Failed to save deal items: ${lineError.message}`);
  }

  // A draft save writes no event at all, so nothing is remembered.
  if (input.saveAsDraft) {
    await supabase.from('deals').update({ status: 'draft' }).eq('id', deal.id);
    return NextResponse.json(
      {
        deal: { ...deal, status: 'draft' },
        lines: lines ?? [],
        memory: null,
        message: 'Draft saved. Nothing has been added to deal memory yet.',
      },
      { status: 201 },
    );
  }

  // The quote is the first confirmed fact. Only now does a memory get written.
  const quotedTotal = sumTotal(lineRows as DealLine[], 'quoted_unit_price', 'quoted_quantity');

  const quoteEvent = await appendDealEvent({
    shopId: context.shop.id,
    dealId: deal.id,
    userId: user.userId,
    eventType: 'quote_received',
    summary:
      input.headline ??
      `Supplier quoted ${input.lines.length} item${input.lines.length === 1 ? '' : 's'}: ${input.lines
        .map((l) => l.productLabel)
        .join(', ')}.`,
    quotedTotal,
    currencyCode,
    nextStatus: 'quoted',
    supplierLabel: supplier.display_name,
  });

  if (!quoteEvent.ok) {
    // The deal is saved; only the canonical event failed. Report the difference
    // honestly rather than claiming the whole save failed.
    return NextResponse.json(
      {
        deal,
        lines: lines ?? [],
        memory: null,
        partial: true,
        message: quoteEvent.message,
      },
      { status: 201 },
    );
  }

  // Agreed terms become their own confirmed event, which is what a retailer
  // later asks about.
  let termsEvent = null;
  if (input.termsAgreed) {
    const agreedTotal = sumTotal(lineRows as DealLine[], 'agreed_unit_price', 'agreed_quantity');

    termsEvent = await appendDealEvent({
      shopId: context.shop.id,
      dealId: deal.id,
      userId: user.userId,
      eventType: 'terms_agreed',
      summary: `Terms agreed for ${input.lines
        .map((l) => l.productLabel)
        .join(', ')}${input.expectedDeliveryAt ? `, expected ${new Date(input.expectedDeliveryAt).toLocaleDateString('en-GB')}` : ''}.`,
      agreedTotal,
      currencyCode,
      nextStatus: 'agreed',
      supplierLabel: supplier.display_name,
    });
  }

  const { data: finalDeal } = await supabase.from('deals').select('*').eq('id', deal.id).single();

  await supabase.from('audit_events').insert({
    shop_id: context.shop.id,
    actor_user_id: user.userId,
    action: 'deal.created',
    target_type: 'deal',
    target_id: deal.id,
    metadata: { termsAgreed: input.termsAgreed },
  });

  return NextResponse.json(
    {
      deal: finalDeal ?? deal,
      lines: lines ?? [],
      memory: {
        quote: quoteEvent.memory,
        terms: termsEvent?.memory ?? null,
      },
      message: termsEvent
        ? 'Deal saved. Adding the confirmed quote and agreed terms to deal memory.'
        : 'Quote saved. Adding it to deal memory.',
    },
    { status: 201 },
  );
});

function sumTotal(
  lines: DealLine[],
  priceKey: 'quoted_unit_price' | 'agreed_unit_price',
  quantityKey: 'quoted_quantity' | 'agreed_quantity',
): number | null {
  let total = 0;
  let seen = false;
  for (const line of lines) {
    const price = line[priceKey];
    const quantity = line[quantityKey];
    if (price === null || price === undefined) continue;
    const qty = quantity ?? 1;
    if (qty === null || qty === undefined) continue;
    total += Number(price) * Number(qty);
    seen = true;
  }
  return seen ? Math.round(total * 100) / 100 : null;
}