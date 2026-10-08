import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { createSupplierSchema } from '@/lib/validation';
import { listSuppliers } from '@/lib/data/queries';

/**
 * GET /api/suppliers
 * Shop member. Returns the authorised shop's supplier directory.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`suppliers:list:${user.userId}`, RATE_LIMITS.list);

  const shopHint = new URL(request.url).searchParams.get('shop');
  const context = await resolveShop(user.userId, shopHint);
  if (!context) throw ApiError.forbidden('You do not have access to any shop.');
  if (!can(context.membership, 'deal.view')) throw ApiError.forbidden();

  const suppliers = await listSuppliers(context.shop.id);
  return NextResponse.json({ suppliers });
});

/**
 * POST /api/suppliers
 * `{ displayName, phone?, notes? }`. Requires supplier.manage.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`suppliers:write:${user.userId}`, RATE_LIMITS.supplierWrite);

  const body = await request.json().catch(() => ({}));
  const shopIdFromBody = typeof body.shopId === 'string' ? body.shopId : null;
  const input = createSupplierSchema.parse(body);

  const context = await resolveShop(user.userId, shopIdFromBody);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'supplier.manage')) {
    throw ApiError.forbidden('You do not have permission to add suppliers in this shop.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      shop_id: context.shop.id,
      display_name: input.displayName,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      created_by: user.userId,
    })
    .select('id, display_name, phone, notes, created_at')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create supplier: ${error?.message ?? 'unknown error'}`);
  }

  await supabase.from('audit_events').insert({
    shop_id: context.shop.id,
    actor_user_id: user.userId,
    action: 'supplier.created',
    target_type: 'supplier',
    target_id: data.id,
    metadata: {},
  });

  return NextResponse.json({ supplier: data }, { status: 201 });
});