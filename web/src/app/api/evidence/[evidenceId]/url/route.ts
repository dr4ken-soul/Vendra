import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';

/**
 * POST /api/evidence/[evidenceId]/url
 *
 * Issues a short-lived signed URL for an evidence file.
 *
 * Checks performed before a URL is issued:
 *   1. the caller is an active member of the shop that owns the evidence
 *   2. the caller holds evidence.view for that shop
 *   3. the evidence row is inside that same shop and is not soft-deleted
 *
 * The raw object key is never returned to the browser.
 */
export const POST = withErrorHandling(async (request: Request, context: RouteContext) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`evidence:url:${user.userId}`, RATE_LIMITS.list);

  const { evidenceId } = await context.params;
  const shopId = typeof request.headers.get('x-vendra-shop') === 'string' ? request.headers.get('x-vendra-shop') : null;

  const ctx = await resolveShop(user.userId, shopId);
  if (!ctx) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(ctx.membership, 'evidence.view')) {
    throw ApiError.forbidden('You do not have permission to view evidence in this shop.');
  }

  // RLS applies here because this is a session-scoped read.
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: evidence } = await supabase
    .from('evidence_files')
    .select('id, shop_id, deal_id, storage_object_key, content_type, original_filename, byte_size, uploaded_at')
    .eq('id', evidenceId)
    .eq('shop_id', ctx.shop.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!evidence) {
    throw ApiError.notFound('That file was not found in this shop.');
  }

  // The admin client is used only to mint the signed URL for a key the
  // authorised read above has already vouched for.
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from('evidence')
    .createSignedUrl(evidence.storage_object_key, 300);

  if (error || !signed) {
    console.error('[vendra] failed to sign evidence url', error?.message);
    throw ApiError.unavailable('Opening the file', 'The file could not be opened just now. Try again.');
  }

  return NextResponse.json({
    url: signed.signedUrl,
    expiresInSeconds: 300,
    contentType: evidence.content_type,
    fileName: evidence.original_filename,
    byteSize: evidence.byte_size,
  });
});

interface RouteContext {
  params: Promise<{ evidenceId: string }>;
}