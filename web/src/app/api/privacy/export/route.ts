import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';

/**
 * POST /api/privacy/export
 * Requires privacy.export (owner or manager).
 *
 * Builds a real export of this shop's records and writes it to private storage
 * as a JSON file, then issues a short-lived signed download URL. The export is
 * produced from the database, not from the browser, so it includes rows the
 * requesting member may not be able to browse individually.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`privacy:export:${user.userId}`, RATE_LIMITS.list);

  const shopHeader = request.headers.get('x-vendra-shop');
  const context = await resolveShop(user.userId, shopHeader);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'privacy.export')) {
    throw ApiError.forbidden('You do not have permission to export this shop\'s data.');
  }

  const admin = createAdminClient();
  const shopId = context.shop.id;

  const [shop, suppliers, deals, lines, events, evidence, memory, audit, requests] = await Promise.all([
    admin.from('shops').select('*').eq('id', shopId).single(),
    admin.from('suppliers').select('*').eq('shop_id', shopId),
    admin.from('deals').select('*').eq('shop_id', shopId),
    admin.from('deal_lines').select('*').eq('shop_id', shopId),
    admin.from('deal_events').select('*').eq('shop_id', shopId),
    // Object keys are intentionally excluded. The export references the file
    // name and metadata, not a usable storage path.
    admin
      .from('evidence_files')
      .select('id, deal_id, event_id, content_type, byte_size, original_filename, uploaded_at, extraction_status')
      .eq('shop_id', shopId),
    admin
      .from('walrus_memory_sync')
      .select('id, deal_id, event_id, status, memory_version, memory_text, created_at')
      .eq('shop_id', shopId),
    admin.from('audit_events').select('*').eq('shop_id', shopId),
    admin.from('data_requests').select('*').eq('shop_id', shopId),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    format: 'vendra-shop-export-v1',
    note:
      'Evidence files are not embedded. Download each file from the deal record while you still have access.',
    shop: shop.data,
    suppliers: suppliers.data ?? [],
    deals: deals.data ?? [],
    dealLines: lines.data ?? [],
    dealEvents: events.data ?? [],
    evidence: evidence.data ?? [],
    memoryWrites: memory.data ?? [],
    auditLog: audit.data ?? [],
    dataRequests: requests.data ?? [],
  };

  const json = JSON.stringify(exportPayload, null, 2);
  const objectKey = `${shopId}/exports/vendra-export-${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.json`;

  const { error: uploadError } = await admin.storage
    .from('evidence')
    .upload(objectKey, new Blob([json], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: false,
    });

  if (uploadError) {
    console.error('[vendra] export upload failed', uploadError.message);
    throw ApiError.unavailable('The data export', 'The export file could not be created. Try again shortly.');
  }

  const { data: signed } = await admin.storage.from('evidence').createSignedUrl(objectKey, 900);

  await admin.from('audit_events').insert({
    shop_id: shopId,
    actor_user_id: user.userId,
    action: 'privacy.export_requested',
    target_type: 'shop',
    target_id: shopId,
    metadata: { rows: (deals.data ?? []).length },
  });

  return NextResponse.json({
    downloadUrl: signed?.signedUrl ?? null,
    expiresInSeconds: 900,
    counts: {
      suppliers: (suppliers.data ?? []).length,
      deals: (deals.data ?? []).length,
      events: (events.data ?? []).length,
      evidence: (evidence.data ?? []).length,
      memoryWrites: (memory.data ?? []).length,
    },
    message:
      'Your export is ready. The link works for 15 minutes. Evidence files are not embedded — download them from their deals.',
  });
});