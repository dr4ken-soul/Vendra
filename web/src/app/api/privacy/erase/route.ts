import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { erasureRequestSchema } from '@/lib/validation';
import { custodyCopy, DELETION_LIMITS } from '@/lib/memory/provisioning';

/**
 * POST /api/privacy/erase
 * Shop OWNER only (privacy.erase).
 *
 * Executes the deletion workflow and reports the result PER DATA CLASS.
 *
 * The contract in DATA_API_CONTRACTS.md section 5 and PRIVACY_SECURITY.md
 * section 5 is explicit: a request must not report "Complete" until the
 * Security Delete transaction has been authorised and verified. In this build
 * that path is NOT verified, so:
 *
 *   - relational rows       -> deleted
 *   - evidence objects     -> deleted and removal confirmed
 *   - derived text         -> deleted with its record
 *   - Walrus memory blobs  -> WITHDRAWN FROM SCOPE and reported as BLOCKED
 *
 * The Walrus row is reported as blocked, not complete. Nothing here claims
 * permanent erasure.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`privacy:erase:${user.userId}`, RATE_LIMITS.erasure);

  const body = await request.json().catch(() => ({}));
  const input = erasureRequestSchema.parse(body);

  const shopHeader = request.headers.get('x-vendra-shop');
  const context = await resolveShop(user.userId, shopHeader);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');

  if (!can(context.membership, 'privacy.erase')) {
    throw ApiError.forbidden(
      'Only the shop owner can request deletion of this shop\'s data.',
    );
  }

  // A deliberate confirmation step: the retailer must retype the shop name.
  if (input.confirmShopName.trim().toLowerCase() !== context.shop.name.trim().toLowerCase()) {
    throw ApiError.validation('The shop name does not match.', {
      confirmShopName: 'Type the shop name exactly to confirm.',
    });
  }

  const admin = createAdminClient();
  const shopId = context.shop.id;
  const now = new Date().toISOString();

  const results: Array<{ scope: string; status: string; detail: string }> = [];

  // ---- 1. Enumerate what must be removed -----------------------------------
  const [{ data: evidenceRows }, { data: memoryRows }] = await Promise.all([
    admin.from('evidence_files').select('id, storage_object_key').eq('shop_id', shopId),
    admin
      .from('walrus_memory_sync')
      .select('id, memory_blob_id, status')
      .eq('shop_id', shopId)
      .not('memory_blob_id', 'is', null),
  ]);

  const objectKeys = (evidenceRows ?? [])
    .map((row) => row.storage_object_key as string)
    .filter(Boolean);

  const blobIds = (memoryRows ?? [])
    .map((row) => row.memory_blob_id as string)
    .filter(Boolean);

  // ---- 2. Evidence objects --------------------------------------------------
  let evidenceStatus = 'complete';
  let evidenceDetail = `${objectKeys.length} file${objectKeys.length === 1 ? '' : 's'} removed from private storage.`;

  if (objectKeys.length > 0) {
    const { error: removeError } = await admin.storage.from('evidence').remove(objectKeys);
    if (removeError) {
      evidenceStatus = 'blocked';
      evidenceDetail = `Storage reported: ${removeError.message.slice(0, 200)}`;
    } else {
      // Verify the objects are actually gone rather than assuming the call worked.
      const { data: stillPresent } = await admin.storage
        .from('evidence')
        .list(objectKeys[0].split('/').slice(0, 2).join('/'), { limit: 1000 });

      const stillThere = new Set((stillPresent ?? []).map((o) => o.name));
      const surviving = objectKeys.filter((key) => stillThere.has(key.split('/').pop() ?? ''));
      if (surviving.length > 0) {
        evidenceStatus = 'verifying';
        evidenceDetail = `${surviving.length} file(s) could not be confirmed as removed.`;
      }
    }
  }

  await recordRequest(admin, {
    shopId,
    userId: user.userId,
    requestType: 'erasure',
    scope: 'evidence_objects',
    status: evidenceStatus,
    detail: evidenceDetail,
  });
  results.push({ scope: 'evidence_objects', status: evidenceStatus, detail: evidenceDetail });

  // ---- 3. Walrus memory: withdrawn from scope, honestly reported blocked ----
  let memoryStatus: string = 'blocked';
  let memoryDetail: string = DELETION_LIMITS.walrus_memory;

  if (blobIds.length === 0 && context.shop.walrus_namespace === null) {
    memoryStatus = 'complete';
    memoryDetail = 'No memories were ever written for this shop.';
  }

  if (blobIds.length > 0) {
    // Withdraw from scope so nothing further is recalled for this shop.
    await admin
      .from('walrus_memory_sync')
      .update({ status: 'deletion_pending', updated_at: now })
      .eq('shop_id', shopId);

    // The namespace itself is retired by revoking the delegate key in the key
    // store, which is the documented runbook step. Until that runbook has been
    // executed and the Security Delete transaction verified, this stays BLOCKED.
    await admin
      .from('shops')
      .update({
        memory_status: 'revoked',
        memory_status_detail:
          'Memory recall has been switched off for this shop. Permanent erasure of stored memories has not been verified and is recorded as blocked.',
      })
      .eq('id', shopId);

    memoryDetail = `${DELETION_LIMITS.walrus_memory} ${blobIds.length} memory reference(s) are recorded against this shop and are listed as blocked, not erased.`;
  }

  await recordRequest(admin, {
    shopId,
    userId: user.userId,
    requestType: 'erasure',
    scope: 'walrus_memory',
    status: memoryStatus,
    detail: memoryDetail,
    walrusBlobIds: blobIds,
    blockedReason: memoryStatus === 'blocked' ? memoryDetail.slice(0, 1000) : null,
  });
  results.push({ scope: 'walrus_memory', status: memoryStatus, detail: memoryDetail });

  // ---- 4. Relational records ----------------------------------------------
  // One function, one transaction.
  //
  // deal_events is append-only, so deleting it requires the erasure window, and
  // the window is transaction-local. PostgREST runs every HTTP request in its own
  // transaction, so opening the window from the route and then issuing each delete
  // as a separate request can never work: the setting is already gone by the time
  // the next delete arrives. erase_shop_records opens the window and performs the
  // whole cascade itself, so erasure is atomic.
  //
  // Every count it returns is checked against the database afterwards, because the
  // reported status must not claim more than actually happened.
  let relationalStatus = 'complete';
  let relationalDetail = '';

  const { data: counts, error: eraseError } = await admin.rpc('erase_shop_records', {
    p_shop_id: shopId,
  });

  if (eraseError) {
    relationalStatus = 'blocked';
    relationalDetail = `Records could not be removed: ${eraseError.message.slice(0, 200)}`;
  } else {
    // Verify rather than trust. The failure this guards against is reporting
    // `complete` while rows survive, which is what the previous implementation did.
    const survivors: string[] = [];
    for (const table of [
      'deal_events',
      'deal_lines',
      'deals',
      'suppliers',
      'shop_memberships',
      'evidence_files',
      'assistant_sessions',
      'walrus_memory_sync',
    ] as const) {
      const { count } = await admin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId);
      if ((count ?? 0) > 0) survivors.push(`${table}: ${count}`);
    }

    const { count: shopCount } = await admin
      .from('shops')
      .select('*', { count: 'exact', head: true })
      .eq('id', shopId);
    if ((shopCount ?? 0) > 0) survivors.push(`shops: ${shopCount}`);

    if (survivors.length > 0) {
      relationalStatus = 'blocked';
      relationalDetail = `Some records could not be confirmed as removed: ${survivors.join(', ')}`;
    } else {
      const removed = ((counts ?? []) as Array<{ deleted_count: number }>).reduce(
        (total, row) => total + Number(row.deleted_count ?? 0),
        0,
      );
      relationalDetail = `${removed} record(s) removed: suppliers, deals, records, evidence metadata, messages and the shop itself.`;
    }
  }

  // Audit the erasure itself. This runs after the shop row is gone, so it cannot
  // carry a shop_id foreign key; it records only what was requested.
  if (!eraseError) {
    await admin.from('audit_events').insert({
      shop_id: shopId,
      actor_user_id: user.userId,
      action: 'privacy.erasure_completed',
      target_type: 'shop',
      target_id: shopId,
      metadata: { status: relationalStatus, scope: 'database_rows' },
    });
  }

  results.push({ scope: 'relational', status: relationalStatus, detail: relationalDetail });

  const anyBlocked = results.some((r) => r.status === 'blocked' || r.status === 'verifying');

  return NextResponse.json({
    results,
    overall: anyBlocked ? 'blocked' : 'complete',
    custody: custodyCopy(context.shop.memory_custody_mode),
    message: anyBlocked
      ? 'Some data was removed, but one layer could not be confirmed as erased. The blocked layer is listed above.'
      : 'Your shop records and attached files have been removed.',
  });
});

async function recordRequest(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    shopId: string;
    userId: string;
    requestType: 'export' | 'erasure';
    scope: 'relational' | 'evidence_objects' | 'walrus_memory' | 'derived_text';
    status: string;
    detail: string;
    walrusBlobIds?: string[];
    blockedReason?: string | null;
  },
) {
  await admin.from('data_requests').insert({
    shop_id: input.shopId,
    requested_by: input.userId,
    request_type: input.requestType,
    scope: input.scope,
    status: input.status,
    detail: input.detail.slice(0, 2000),
    walrus_blob_ids: input.walrusBlobIds ?? [],
    blocked_reason: input.blockedReason ?? null,
    started_at: new Date().toISOString(),
    completed_at: input.status === 'complete' ? new Date().toISOString() : null,
  });
}

/**
 * GET /api/privacy/erase
 * Durable status record for the privacy screen. The user may navigate away and
 * return to this.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();

  const shopHeader = request.headers.get('x-vendra-shop');
  const context = await resolveShop(user.userId, shopHeader);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'privacy.export')) throw ApiError.forbidden();

  const admin = createAdminClient();
  const { data } = await admin
    .from('data_requests')
    .select('*')
    .eq('shop_id', context.shop.id)
    .order('requested_at', { ascending: false })
    .limit(40);

  return NextResponse.json({
    requests: (data ?? []).map((row) => ({
      id: row.id,
      type: row.request_type,
      scope: row.scope,
      status: row.status,
      detail: row.detail,
      blockedReason: row.blocked_reason,
      memoryReferenceCount: (row.walrus_blob_ids ?? []).length,
      requestedAt: row.requested_at,
      completedAt: row.completed_at,
    })),
    limits: DELETION_LIMITS,
    custody: custodyCopy(context.shop.memory_custody_mode),
  });
});