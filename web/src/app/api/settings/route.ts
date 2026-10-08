import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { updateShopSchema } from '@/lib/validation';

/**
 * PATCH /api/settings
 * Shop manager with settings.manage. Updates shop details only.
 *
 * The memory binding is deliberately NOT editable from the browser. Changing a
 * shop's Walrus account or namespace is a server-side provisioning operation,
 * so it cannot be used to point a shop at another shop's memory scope.
 */
export const PATCH = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`settings:update:${user.userId}`, RATE_LIMITS.dealWrite);

  const body = await request.json().catch(() => ({}));
  const input = updateShopSchema.parse(body);

  const context = await resolveShop(user.userId, typeof body.shopId === 'string' ? body.shopId : null);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'settings.manage')) {
    throw ApiError.forbidden('You do not have permission to change shop settings.');
  }

  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.marketArea !== undefined) patch.market_area = input.marketArea;
  if (input.currencyCode !== undefined) patch.currency_code = input.currencyCode;
  if (input.timezone !== undefined) patch.timezone = input.timezone;

  if (Object.keys(patch).length === 0) {
    throw ApiError.validation('Nothing to change.');
  }

  const { error } = await supabase
    .from('shops')
    .update(patch)
    .eq('id', context.shop.id)
    .eq('shop_id', context.shop.id);

  if (error) throw new Error(`Failed to update settings: ${error.message}`);

  await supabase.from('audit_events').insert({
    shop_id: context.shop.id,
    actor_user_id: user.userId,
    action: 'shop.settings_updated',
    target_type: 'shop',
    target_id: context.shop.id,
    metadata: { fields: Object.keys(patch) },
  });

  const { data: shop } = await supabase.from('shops').select('*').eq('id', context.shop.id).single();

  return NextResponse.json({
    shop: {
      id: context.shop.id,
      name: shop?.name,
      marketArea: shop?.market_area,
      currencyCode: shop?.currency_code,
      timezone: shop?.timezone,
    },
    message: 'Shop settings saved.',
  });
});