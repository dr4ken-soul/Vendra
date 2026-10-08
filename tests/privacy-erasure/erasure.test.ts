/**
 * Privacy erasure, verified against the live project.
 *
 * This suite exists because erasure was silently broken and reported as
 * complete. The append-only trigger on deal_events refused every delete, the
 * route never checked its delete results, and the retailer was told their records
 * were gone while every row survived.
 *
 * Two guarantees are proved here:
 *
 *   1. Erasure removes the shop and every row that belonged to it, and the status
 *      it reports matches what is actually left in the database.
 *   2. deal_events stays append-only outside the erasure window. A correction is a
 *      new row, never a rewrite, and the destructive SQL function is not reachable
 *      by the anon key.
 *
 * Skips loudly without credentials, because a green run that never exercised
 * erasure would be a false pass on the one promise that must never be broken.
 */
import { describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from '../integration/harness';

const env = loadEnv();

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminKey = env.SUPABASE_SERVICE_ROLE_KEY;

/** The origin under test. Set E2E_BASE_URL to run the same suite against a deployment. */
const target = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

const configured = Boolean(url && anonKey && adminKey);

if (!configured) {
  console.error(
    '[vendra] privacy-erasure suite SKIPPED: live Supabase credentials are not configured. Erasure is UNVERIFIED.',
  );
}

const admin: SupabaseClient = createClient(url ?? 'http://localhost', adminKey ?? 'x', {
  auth: { autoRefreshToken: false, persistSession: false },
});

const jar = new Map<string, string>();

async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (jar.size > 0) {
    headers.set('cookie', [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '));
  }

  const response = await fetch(`${target}${path}`, { ...options, headers, redirect: 'manual' });

  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }

  const text = await response.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body };
}

async function countRows(table: string, shopId: string): Promise<number> {
  const { count } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId);
  return count ?? 0;
}

async function totalRows(shopId: string): Promise<number> {
  const tables = [
    'deal_events',
    'deal_lines',
    'deals',
    'suppliers',
    'shop_memberships',
    'evidence_files',
    'assistant_sessions',
    'walrus_memory_sync',
  ] as const;

  let total = 0;
  for (const table of tables) total += await countRows(table, shopId);

  const { count } = await admin
    .from('shops')
    .select('*', { count: 'exact', head: true })
    .eq('id', shopId);
  return total + (count ?? 0);
}

/** Sign a test user in and present the same session cookies the browser would. */
async function signIn(email: string, password: string) {
  const { createServerClient } = await import('@supabase/ssr');
  const browser = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await browser.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed: ${error.message}`);

  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (list) => {
        for (const cookie of list) jar.set(cookie.name, cookie.value);
      },
    },
  });
  await ssr.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return data.user;
}

const SHOP_NAME = 'Erasure Test Shop';

describe.skipIf(!configured)('privacy erasure removes what it claims to remove', () => {
  it('erases a shop completely while keeping deal_events append-only', async () => {
    const stamp = Date.now();
    const email = `vendra-erase-${stamp}@example.test`;
    const password = `Vendra-erase-${stamp}-Aa1!`;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw new Error(`could not create the fixture user: ${createError.message}`);

    let shopId = '';

    try {
      await signIn(email, password);

      // ---- Build a shop with the full lifecycle recorded -------------------
      const shopCreate = await api('/api/shops', {
        method: 'POST',
        body: JSON.stringify({ name: SHOP_NAME, timezone: 'Africa/Lagos' }),
      });
      expect(shopCreate.status, JSON.stringify(shopCreate.body).slice(0, 200)).toBe(201);
      shopId = shopCreate.body.shop.id as string;

      const supplier = await api('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify({ shopId, displayName: 'Erasure Supplier' }),
      });
      expect(supplier.status).toBe(201);

      const deal = await api('/api/deals', {
        method: 'POST',
        body: JSON.stringify({
          shopId,
          supplierId: supplier.body.supplier.id,
          dealDate: '2026-10-01',
          headline: 'Erasure deal',
          termsAgreed: true,
          lines: [
            {
              productLabel: 'Tomato paste',
              quotedQuantity: 10,
              quotedUnitPrice: 18000,
              agreedQuantity: 10,
              agreedUnitPrice: 18000,
              unitLabel: 'carton',
            },
          ],
        }),
      });
      expect(deal.status, JSON.stringify(deal.body).slice(0, 200)).toBe(201);
      const dealId = deal.body.deal.id as string;

      const event = await api(`/api/deals/${dealId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          shopId,
          eventType: 'delivery_checked',
          summary: 'All ten cartons arrived.',
          condition: 'complete',
          // A delivery check that does not record what arrived is not one.
          receivedLines: [{ lineId: deal.body.lines[0].id, receivedQuantity: 10 }],
        }),
      });
      expect(event.status, JSON.stringify(event.body).slice(0, 200)).toBe(201);

      const before = await totalRows(shopId);
      expect(before).toBeGreaterThan(0);

      // ---- Append-only must still hold outside the erasure window ----------
      const { error: updateError } = await admin
        .from('deal_events')
        .update({ summary: 'rewritten behind the scenes' })
        .eq('id', event.body.event.id as string);
      expect.soft(updateError, 'the service role was able to rewrite a recorded event').not.toBeNull();

      const { error: deleteError } = await admin
        .from('deal_events')
        .delete()
        .eq('id', event.body.event.id as string);
      expect.soft(deleteError, 'deal_events was deletable outside the erasure window').not.toBeNull();

      expect.soft(await totalRows(shopId), 'the refused deletes changed something').toBe(before);

      // ---- The destructive function must not be reachable by the public key
      const anonAttempt = await fetch(`${url}/rest/v1/rpc/erase_shop_records`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_shop_id: shopId }),
      });
      expect.soft(anonAttempt.status, 'the anon key reached the erasure function').toBeGreaterThanOrEqual(400);

      // ---- A wrong confirmation must delete nothing ------------------------
      const wrongName = await api('/api/privacy/erase', {
        method: 'POST',
        body: JSON.stringify({ confirmShopName: 'Definitely Not The Shop Name', scope: 'shop' }),
      });
      // Any 4xx is a refusal. Asserting one exact code would test the error mapper
      // rather than the guarantee, which is that a wrong name deletes nothing.
      expect.soft(wrongName.status).toBeGreaterThanOrEqual(400);
      expect.soft(wrongName.status).toBeLessThan(500);
      expect.soft(await totalRows(shopId), 'a refused erasure deleted rows').toBe(before);

      // ---- Erase for real --------------------------------------------------
      const erase = await api('/api/privacy/erase', {
        method: 'POST',
        body: JSON.stringify({ confirmShopName: SHOP_NAME, scope: 'shop' }),
      });
      expect(erase.status, JSON.stringify(erase.body).slice(0, 200)).toBe(200);

      const layers = (erase.body.results ?? []) as Array<{ scope: string; status: string }>;
      const relational = layers.find((layer) => layer.scope === 'relational');
      expect.soft(relational, 'the response did not report the relational layer').toBeDefined();

      // The assertion that would have caught the original bug: what the route
      // reports must match what is actually left behind.
      const leftover = await totalRows(shopId);
      expect.soft(leftover, 'rows survived an erasure reported as complete').toBe(0);
      expect.soft(relational?.status).toBe(leftover === 0 ? 'complete' : 'blocked');

      // The erased shop must no longer resolve for its former owner.
      const dealsAfter = await api('/app/deals');
      expect(dealsAfter.status).toBe(307);
    } finally {
      // Best effort: clear anything the assertions did not remove.
      // supabase-js query builders are thenables rather than real Promises, so
      // they have no .catch. Awaiting inside try/catch is the reliable form.
      try {
        await admin.rpc('erase_shop_records', { p_shop_id: shopId });
      } catch {
        // nothing to clean up, or already gone
      }
      await admin.from('shop_memberships').delete().eq('user_id', created.user.id);
      await admin.from('shops').delete().eq('owner_user_id', created.user.id);
      await admin.auth.admin.deleteUser(created.user.id);
    }
  }, 180_000);
});
