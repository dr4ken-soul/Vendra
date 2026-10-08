import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { completeUploadSchema } from '@/lib/validation';

/**
 * POST /api/evidence/complete
 *
 * Confirms an upload, verifies the object actually exists at the size the
 * server authorised, and records the evidence metadata. This is the point at
 * which a file becomes a citable source for a deal.
 *
 * The object key is re-validated against the shop and deal prefixes so a client
 * cannot complete an upload against somebody else's path.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`evidence:complete:${user.userId}`, RATE_LIMITS.uploadComplete);

  const body = await request.json().catch(() => ({}));
  const input = completeUploadSchema.parse(body);

  const shopId = typeof body.shopId === 'string' ? body.shopId : undefined;
  const context = await resolveShop(user.userId, shopId);

  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'evidence.upload')) {
    throw ApiError.forbidden('You do not have permission to attach evidence in this shop.');
  }

  const expectedPrefix = `${context.shop.id}/${input.dealId}/`;
  if (!input.objectKey.startsWith(expectedPrefix)) {
    throw ApiError.forbidden('That upload does not belong to this deal.');
  }

  const admin = createAdminClient();

  const { data: deal } = await admin
    .from('deals')
    .select('id')
    .eq('shop_id', context.shop.id)
    .eq('id', input.dealId)
    .maybeSingle();

  if (!deal) throw ApiError.validation('That deal is not part of this shop.');

  // Verify the object is really there before recording metadata.
  const { data: objectInfo, error: infoError } = await admin.storage
    .from('evidence')
    .info(input.objectKey);

  if (infoError || !objectInfo) {
    throw ApiError.validation(
      'That upload did not complete. Please add the file again.',
      { objectKey: 'The file was not received by storage.' },
    );
  }

  const actualSize = Number(objectInfo.size ?? 0);
  if (actualSize <= 0) {
    throw ApiError.validation('That file appears to be empty.', { objectKey: 'The file is empty.' });
  }

  if (actualSize > 25 * 1024 * 1024) {
    // Remove the oversized object rather than leaving an orphan in storage.
    await admin.storage.from('evidence').remove([input.objectKey]);
    throw ApiError.validation('Files must be 25 MB or smaller.', { objectKey: 'The file is too large.' });
  }

  const actualType = objectInfo.metadata?.mimetype ?? input.contentType;

  const { data: row, error: insertError } = await admin
    .from('evidence_files')
    .insert({
      shop_id: context.shop.id,
      deal_id: input.dealId,
      event_id: input.eventId ?? null,
      storage_object_key: input.objectKey,
      content_type: actualType,
      byte_size: actualSize,
      sha256: input.sha256 ?? null,
      original_filename: sanitiseFileName(input.fileName),
      uploaded_by: user.userId,
      extraction_status: 'not_requested',
    })
    .select('id, original_filename, content_type, byte_size, uploaded_at')
    .single();

  if (insertError || !row) {
    throw new Error(`Failed to record evidence: ${insertError?.message ?? 'unknown error'}`);
  }

  await admin.from('audit_events').insert({
    shop_id: context.shop.id,
    actor_user_id: user.userId,
    action: 'evidence.uploaded',
    target_type: 'evidence_file',
    target_id: row.id,
    metadata: { dealId: input.dealId, byteSize: actualSize },
  });

  return NextResponse.json(
    {
      evidence: row,
      message: 'File attached.',
    },
    { status: 201 },
  );
});

/** Strip any directory component a client may have supplied. */
function sanitiseFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'evidence';
  return base.replace(/[^\w.\- ]/g, '_').slice(0, 255) || 'evidence';
}