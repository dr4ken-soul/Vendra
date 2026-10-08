import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { getUser, listMemberships } from '@/lib/tenancy';
import { createShopSchema } from '@/lib/validation';
import { provisionShopMemory } from '@/lib/memory/provisioning';
import type { Shop } from '@/lib/types';

/**
 * GET /api/shops
 *
 * Returns ONLY the shops the authenticated user is an active member of.
 * A client-supplied shop id is never consulted.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();

  rateLimit(`shops:list:${user.userId}`, RATE_LIMITS.list);

  const memberships = await listMemberships(user.userId);
  const shopIds = memberships.map((m) => m.shop_id);

  if (shopIds.length === 0) {
    return NextResponse.json({ shops: [] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shops')
    .select(
      'id, name, market_area, country_code, currency_code, timezone, memory_status, memory_custody_mode, memory_status_detail',
    )
    .in('id', shopIds)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw new Error(`Failed to load shops: ${error.message}`);

  const shops = ((data ?? []) as Shop[]).map((shop) => {
    const membership = memberships.find((m) => m.shop_id === shop.id);
    return {
      id: shop.id,
      name: shop.name,
      marketArea: shop.market_area,
      currencyCode: shop.currency_code,
      timezone: shop.timezone,
      memoryStatus: shop.memory_status,
      memoryCustodyMode: shop.memory_custody_mode,
      memoryStatusDetail: shop.memory_status_detail,
      role: membership?.role ?? 'staff',
      permissions: membership?.permissions ?? [],
    };
  });

  void request;
  return NextResponse.json({ shops });
});

/**
 * POST /api/shops
 *
 * Creates a shop, its owner membership and its isolated memory scope.
 *
 * The namespace is derived server-side from a cryptographically random suffix
 * and is unique per shop. There is no client input for the Walrus account or
 * namespace at all.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();

  rateLimit(`shops:create:${user.userId}`, RATE_LIMITS.shopCreate);

  const body = await request.json().catch(() => ({}));
  const input = createShopSchema.parse(body);

  // A user owns at most one shop in V1. A second request is a no-op rather
  // than a silent duplicate.
  const existing = await listMemberships(user.userId);
  if (existing.length > 0) {
    throw ApiError.conflict('You already have a shop. Switch to it instead of creating another.');
  }

  const supabase = await createClient();

  const { data: created, error: insertError } = await supabase
    .from('shops')
    .insert({
      owner_user_id: user.userId,
      name: input.name,
      market_area: input.marketArea ?? null,
      currency_code: input.currencyCode,
      timezone: input.timezone,
    })
    .select('id')
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to create shop: ${insertError?.message ?? 'unknown error'}`);
  }

  const shopId = created.id as string;

  // Owner membership. Permissions come from the database default for the role,
  // never from a client-supplied array.
  const { error: membershipError } = await supabase.from('shop_memberships').insert({
    shop_id: shopId,
    user_id: user.userId,
    role: 'owner',
  });

  if (membershipError) {
    // Roll the shop back so we never leave an unreachable shop behind.
    const admin = createAdminClient();
    await admin.from('shops').delete().eq('id', shopId);
    throw new Error(`Failed to create owner membership: ${membershipError.message}`);
  }

  // Provision the shop's own Walrus account + namespace. Failure here leaves
  // memory_status = 'pending' and the UI offers a retry; it never blocks the
  // retailer from recording deals.
  const memory = await provisionShopMemory(shopId);

  await supabase.from('audit_events').insert({
    shop_id: shopId,
    actor_user_id: user.userId,
    action: 'shop.created',
    target_type: 'shop',
    target_id: shopId,
    metadata: { name: input.name },
  });

  const { data: shopRow } = await supabase.from('shops').select('*').eq('id', shopId).single();

  return NextResponse.json(
    {
      shop: {
        id: shopId,
        name: (shopRow as Shop | null)?.name ?? input.name,
        memoryStatus: memory.status,
        memoryStatusDetail: memory.detail,
        memoryCustodyMode: 'service_managed',
      },
    },
    { status: 201 },
  );
});