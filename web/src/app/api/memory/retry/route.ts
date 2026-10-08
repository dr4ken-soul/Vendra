import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { reconcilePendingWrites, retryMemoryWrite } from '@/lib/memory/service';
import { walrusEnv } from '@/lib/env';

/**
 * POST /api/memory/retry
 * Shop manager with memory.retry. Retries one failed write for a confirmed event.
 */
const retrySchema = z.object({
  syncId: z.string().uuid(),
  shopId: z.string().uuid().optional(),
});

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`memory:retry:${user.userId}`, RATE_LIMITS.memoryRetry);

  const body = await request.json().catch(() => ({}));
  const input = retrySchema.parse(body);

  const context = await resolveShop(user.userId, input.shopId);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'memory.retry')) {
    throw ApiError.forbidden('You do not have permission to retry memory writes in this shop.');
  }

  const result = await retryMemoryWrite(context.shop.id, input.syncId);
  return NextResponse.json(result);
});

/**
 * GET /api/memory/status
 * Shop member. Honest memory state for this shop, including the provider-reported
 * stored count. Never synthesised.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`memory:status:${user.userId}`, RATE_LIMITS.list);

  const shopHint = new URL(request.url).searchParams.get('shop');
  const context = await resolveShop(user.userId, shopHint);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'deal.view')) throw ApiError.forbidden();

  const reconciled = await reconcilePendingWrites(context.shop.id);

  const { getMemoryCount } = await import('@/lib/memory/service');
  const count = await getMemoryCount(context.shop.id);

  return NextResponse.json({
    memoryStatus: context.shop.memory_status,
    memoryStatusDetail: context.shop.memory_status_detail,
    custodyMode: context.shop.memory_custody_mode,
    walrusConfigured: walrusEnv() !== null,
    namespaceReady: Boolean(context.shop.walrus_namespace),
    providerStoredCount: count.count,
    providerCountKnown: count.known,
    reconciled,
  });
});