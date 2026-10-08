import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { requestUploadSchema } from '@/lib/validation';

/**
 * POST /api/evidence/uploads
 *
 * Issues a short-lived signed upload URL for an object path the SERVER builds
 * from an already-authorised shop and deal. The client never chooses the path,
 * so it cannot upload into another shop's prefix or escape the private bucket.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`evidence:upload:${user.userId}`, RATE_LIMITS.uploadRequest);

  const body = await request.json().catch(() => ({}));
  const input = requestUploadSchema.parse(body);

  const shopId = typeof body.shopId === 'string' ? body.shopId : undefined;
  const context = await resolveShop(user.userId, shopId);

  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'evidence.upload')) {
    throw ApiError.forbidden('You do not have permission to attach evidence in this shop.');
  }

  const supabaseAdmin = createAdminClient();

  // The deal must belong to this shop.
  const { data: deal } = await supabaseAdmin
    .from('deals')
    .select('id')
    .eq('shop_id', context.shop.id)
    .eq('id', input.dealId)
    .maybeSingle();

  if (!deal) {
    throw ApiError.validation('That deal is not part of this shop.', {
      dealId: 'Choose a deal from this shop.',
    });
  }

  if (input.eventId) {
    const { data: event } = await supabaseAdmin
      .from('deal_events')
      .select('id')
      .eq('shop_id', context.shop.id)
      .eq('deal_id', input.dealId)
      .eq('id', input.eventId)
      .maybeSingle();

    if (!event) {
      throw ApiError.validation('That record is not part of this deal.', {
        eventId: 'Choose a record from this deal.',
      });
    }
  }

  // Server-built path. The extension is derived from the validated content
  // type, never from the supplied file name, so a name like "../../x.sh" is
  // harmless.
  const extension = extensionFor(input.contentType);
  const objectKey = `${context.shop.id}/${input.dealId}/${crypto.randomUUID()}.${extension}`;

  const { data: signed, error } = await supabaseAdmin.storage
    .from('evidence')
    .createSignedUploadUrl(objectKey);

  if (error || !signed) {
    console.error('[vendra] failed to create signed upload url', error?.message);
    throw ApiError.unavailable('The file upload', 'The upload could not be prepared. Try again in a moment.');
  }

  return NextResponse.json({
    objectKey,
    token: signed.token,
    // A short-lived signed upload path. Never a permanent public URL.
    signedUrl: signed.signedUrl,
    expiresInSeconds: 7200,
    maxBytes: input.byteSize,
  });
});

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}