import { NextResponse } from 'next/server';
import { ApiError, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { provisionShopMemory } from '@/lib/memory/provisioning';

/**
 * POST /api/shops/:shopId/memory
 * Re-runs memory provisioning for a shop. Requires settings.manage.
 *
 * This is the `Retry setup` path from onboarding and Settings. It repairs or
 * recreates the shop's own namespace. It can never point a shop at another
 * shop's scope, because the namespace is always derived server-side.
 */
export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();

  const { shopId } = await context.params;

  // The route segment id is only a hint. It must resolve to an authorised
  // membership before anything is provisioned.
  const ctx = await resolveShop(user.userId, shopId);
  if (!ctx) throw ApiError.forbidden('You do not have access to that shop.');
  if (ctx.shop.id !== shopId) throw ApiError.foreignScope();
  if (!can(ctx.membership, 'settings.manage')) {
    throw ApiError.forbidden('You do not have permission to change this shop’s memory setup.');
  }

  const result = await provisionShopMemory(ctx.shop.id);

  void request;
  return NextResponse.json({
    memoryStatus: result.status,
    memoryStatusDetail: result.detail,
    custodyMode: result.custodyMode,
    namespaceReady: result.namespace !== null,
  });
});

/**
 * GET /api/shops/:shopId/memory
 * Reports the honest memory state for this shop.
 */
export const GET = withErrorHandling(async (request: Request, context: RouteContext) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();

  const { shopId } = await context.params;

  const ctx = await resolveShop(user.userId, shopId);
  if (!ctx) throw ApiError.forbidden('You do not have access to that shop.');
  if (ctx.shop.id !== shopId) throw ApiError.foreignScope();
  if (!can(ctx.membership, 'deal.view')) throw ApiError.forbidden();

  const { getMemoryCount, reconcilePendingWrites } = await import('@/lib/memory/service');
  const reconciled = await reconcilePendingWrites(ctx.shop.id);
  const count = await getMemoryCount(ctx.shop.id);
  const { walrusEnv } = await import('@/lib/env');

  void request;
  return NextResponse.json({
    memoryStatus: ctx.shop.memory_status,
    memoryStatusDetail: ctx.shop.memory_status_detail,
    custodyMode: ctx.shop.memory_custody_mode,
    walrusConfigured: walrusEnv() !== null,
    namespaceReady: Boolean(ctx.shop.walrus_namespace),
    providerStoredCount: count.count,
    providerCountKnown: count.known,
    reconciled,
  });
});

interface RouteContext {
  params: Promise<{ shopId: string }>;
}