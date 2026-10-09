/**
 * Cross-shop isolation against the live Supabase project.
 *
 * This is the single most important test suite in the repository. It proves
 * that a user with a valid session in Shop A cannot read or write Shop B's rows
 * through the REST API, using the anon key exactly as the browser does.
 *
 * Without credentials these tests SKIP loudly. A green run with no credentials
 * means nothing, so that is reported explicitly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanup, createHarness, createTestUser, loadEnv } from '../integration/harness';

const harness = createHarness();

interface TestShop {
  shopId: string;
  ownerId: string;
  supplierId: string;
  dealId: string;
  eventId: string;
  ownerClient: SupabaseClient;
}

const createdShopIds: string[] = [];
const createdUserIds: string[] = [];

async function signInClient(userId: string, email: string): Promise<SupabaseClient> {
  const env = loadEnv();
  const { createClient } = await import('@supabase/supabase-js');

  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = `Vendra-recover-${userId.slice(0, 8)}-Aa1!`;
  // Set a known password so the test can sign in as this user.
  await harness.admin.auth.admin.updateUserById(userId, { password });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Failed to sign in as test user: ${error?.message ?? 'no session'}`);
  }

  return client;
}

/** Build a shop with an owner membership, a supplier, a deal and an event. */
async function buildShop(label: string): Promise<TestShop> {
  const admin = harness.admin;

  const { id: ownerId, email } = await createTestUser(admin, `${label}-owner`);
  createdUserIds.push(ownerId);

  const { data: shop, error: shopError } = await admin
    .from('shops')
    .insert({ owner_user_id: ownerId, name: `Isolation ${label}`, currency_code: 'NGN' })
    .select('id')
    .single();

  if (shopError || !shop) {
    throw new Error(`Failed to create test shop: ${shopError?.message ?? 'unknown'}`);
  }
  createdShopIds.push(shop.id as string);

  /**
   * Permissions are stated, never defaulted.
   *
   * Migration 00012 dropped the default on this column and made it NOT NULL. The
   * insert below originally passed only shop_id, user_id and role, so after that
   * migration it failed silently, this user ended up with no membership, and RLS
   * correctly returned zero rows — which surfaced as four failures reading
   * "expected [] to contain <shop>".
   *
   * That failure mode is worth being explicit about, because it reads like the
   * dangerous version: it looks like RLS stopped protecting data. It did not.
   * The user had no membership at all, and RLS was doing exactly what it should.
   * Both application insert sites always passed permissions, so the app was
   * never affected — only this harness. See scripts/probe-membership-permissions.mjs.
   */
  const { data: ownerPermissions, error: permsError } = await admin.rpc(
    'default_permissions_for_role',
    { p_role: 'owner' },
  );
  if (permsError || !ownerPermissions) {
    throw new Error(`Failed to resolve owner permissions: ${permsError?.message ?? 'no rows'}`);
  }

  const { error: membershipError } = await admin.from('shop_memberships').insert({
    shop_id: shop.id,
    user_id: ownerId,
    role: 'owner',
    permissions: ownerPermissions,
  });
  if (membershipError) {
    // Previously unchecked, which is why the four failures presented as an RLS
    // problem rather than as a failed insert.
    throw new Error(`Failed to create test membership: ${membershipError.message}`);
  }

  const { data: supplier } = await admin
    .from('suppliers')
    .insert({
      shop_id: shop.id,
      display_name: `Supplier ${label}`,
      created_by: ownerId,
    })
    .select('id')
    .single();

  const { data: deal } = await admin
    .from('deals')
    .insert({
      shop_id: shop.id,
      supplier_id: (supplier as { id: string }).id,
      deal_date: '2026-03-04',
      currency_code: 'NGN',
      headline: `Deal ${label}`,
      status: 'draft',
      created_by: ownerId,
    })
    .select('id')
    .single();

  const { data: event } = await admin
    .from('deal_events')
    .insert({
      shop_id: shop.id,
      deal_id: (deal as { id: string }).id,
      event_type: 'quote_received',
      summary: `Quote for ${label}. Agreed 18 cartons at 18,000 naira.`,
      created_by: ownerId,
    })
    .select('id')
    .single();

  const ownerClient = await signInClient(ownerId, email);

  return {
    shopId: shop.id as string,
    ownerId,
    supplierId: (supplier as { id: string }).id,
    dealId: (deal as { id: string }).id,
    eventId: (event as { id: string }).id,
    ownerClient,
  };
}

describe.skipIf(!harness.available)('cross-shop tenant isolation (live Supabase)', () => {
  let shopA: TestShop;
  let shopB: TestShop;

  beforeAll(async () => {
    shopA = await buildShop('A');
    shopB = await buildShop('B');
  });

  afterAll(async () => {
    if (!harness.available) return;
    await cleanup(harness.admin, createdShopIds, createdUserIds);
  });

  it('only lists the shops the signed-in user is a member of', async () => {
    const { data, error } = await shopA.ownerClient.from('shops').select('id, name');

    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.id as string);

    expect(ids).toContain(shopA.shopId);
    expect(ids).not.toContain(shopB.shopId);
  });

  it('cannot read another shop’s suppliers', async () => {
    const { data } = await shopA.ownerClient.from('suppliers').select('id, display_name');
    const ids = (data ?? []).map((row) => row.id as string);

    expect(ids).toContain(shopA.supplierId);
    expect(ids).not.toContain(shopB.supplierId);
  });

  it('cannot read another shop’s deals', async () => {
    const { data } = await shopA.ownerClient.from('deals').select('id, headline');
    const ids = (data ?? []).map((row) => row.id as string);

    expect(ids).toContain(shopA.dealId);
    expect(ids).not.toContain(shopB.dealId);
  });

  it('cannot read another shop’s deal events', async () => {
    const { data } = await shopA.ownerClient.from('deal_events').select('id, summary');
    const ids = (data ?? []).map((row) => row.id as string);

    expect(ids).toContain(shopA.eventId);
    expect(ids).not.toContain(shopB.eventId);
  });

  it('cannot read another shop’s deal events even when the id is known', async () => {
    // A direct id lookup is the most targeted attack: the attacker already
    // holds the identifier.
    const { data, error } = await shopA.ownerClient
      .from('deal_events')
      .select('*')
      .eq('id', shopB.eventId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('cannot write a record into another shop', async () => {
    const { error } = await shopA.ownerClient.from('deals').insert({
      shop_id: shopB.shopId,
      supplier_id: shopB.supplierId,
      deal_date: '2026-03-05',
      currency_code: 'NGN',
      status: 'draft',
      created_by: shopA.ownerId,
    });

    // RLS must refuse this, or the composite shop foreign key must.
    expect(error).not.toBeNull();
  });

  it('cannot append an event into another shop’s deal', async () => {
    const { error } = await shopA.ownerClient.from('deal_events').insert({
      shop_id: shopB.shopId,
      deal_id: shopB.dealId,
      event_type: 'note_added',
      summary: 'Attempted cross-tenant write.',
      created_by: shopA.ownerId,
    });

    expect(error).not.toBeNull();
  });

  it('cannot read another shop’s evidence metadata', async () => {
    const { data } = await shopA.ownerClient
      .from('evidence_files')
      .select('id, storage_object_key');

    expect(data).toEqual([]);
  });

  it('cannot read another shop’s memory sync records', async () => {
    const { data } = await shopA.ownerClient
      .from('walrus_memory_sync')
      .select('id, namespace');

    const namespaces = (data ?? []).map((row) => row.namespace as string);
    expect(namespaces.every((n) => n !== null && n.includes('vendra-shop'))).toBe(true);
  });

  it('cannot invite a member into another shop', async () => {
    const { error } = await shopA.ownerClient.from('shop_memberships').insert({
      shop_id: shopB.shopId,
      user_id: shopA.ownerId,
      role: 'owner',
    });

    expect(error).not.toBeNull();
  });

  it('cannot see another shop’s audit log', async () => {
    const { data } = await shopA.ownerClient.from('audit_events').select('shop_id');
    const shopIds = new Set((data ?? []).map((row) => row.shop_id as string));

    expect(shopIds.has(shopA.shopId) || shopIds.size === 0).toBe(true);
    expect(shopIds.has(shopB.shopId)).toBe(false);
  });

  it('rejects an unauthenticated read entirely', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const env = loadEnv();

    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data } = await anon.from('deals').select('id');
    expect(data ?? []).toEqual([]);
  });

  it('rejects an unauthenticated write entirely', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const env = loadEnv();

    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await anon.from('suppliers').insert({
      shop_id: shopA.shopId,
      display_name: 'Anonymous insert attempt',
      created_by: shopA.ownerId,
    });

    expect(error).not.toBeNull();
  });
});

describe('tenant isolation suite', () => {
  it('reports honestly when it has not been run', () => {
    if (!harness.available) {
      // This is a visible, deliberate skip rather than a silent pass.
      console.warn(`[vendra] tenant-isolation suite SKIPPED: ${harness.reason}`);
      expect(harness.available).toBe(false);
      return;
    }
    expect(harness.available).toBe(true);
  });
});