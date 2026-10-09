/**
 * Build a real shop for the demo film, entirely through the public API.
 *
 * The film needs a shop with history, because the film's argument is about time:
 * a deal recorded in the past, recalled in the present. That argument is only
 * worth making if the dates are real.
 *
 * **No service role, and no direct table writes.** Every row is created by the
 * retailer's own session through the same endpoints the browser calls. That is a
 * deliberate constraint, not a limitation:
 *
 *   - creating the shop through `POST /api/shops` is the only path that also
 *     provisions the Walrus namespace and writes the owner membership. A shop
 *     written with the service role has neither, and the owner then gets
 *     403 "You do not have access to that shop" on their own shop.
 *   - going through the API means Row Level Security, tenant derivation and
 *     permission checks all run. A shop seeded by bypassing them would prove
 *     nothing about the product.
 *
 * Every column and enum below was read from the migrations. The first attempt
 * guessed `slug`, `name` and event types that do not exist.
 *
 * Nothing here is fabricated output. If the recall answers badly, the film has to
 * deal with a bad answer.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const raw = fs.readFileSync('.env.local', 'utf8');
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  const f = v[0];
  if ((f === '"' || f === "'") && v[v.length - 1] === f) v = v.slice(1, -1);
  process.env[t.slice(0, i).trim()] = v;
}

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: node scripts/seed-demo-shop.mjs <email> <password>');
  process.exit(1);
}

const BASE = process.env.DEMO_BASE_URL ?? 'https://vendra-psycho-projects.vercel.app';

const browser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: signIn, error: signInError } = await browser.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error('sign-in failed:', signInError.message);
  process.exit(1);
}

async function captureSessionCookies(accessToken, refreshToken) {
  const captured = new Map();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (list) => {
          for (const c of list) captured.set(c.name, c.value);
        },
      },
    },
  );
  await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return captured;
}

const jar = await captureSessionCookies(signIn.session.access_token, signIn.session.refresh_token);
const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', cookie: cookie() },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const today = new Date();
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const at = (n, hhmm) => `${daysAgo(n)}T${hhmm}:00Z`;

/* ---------- a shop already seeded by an earlier run cannot be repaired ---------- */

const existingShops = await api('GET', '/api/shops');
const shopList = Array.isArray(existingShops) ? existingShops : (existingShops?.shops ?? []);
if (shopList.length > 0) {
  console.error(`This account already has ${shopList.length} shop(s), the first named "${shopList[0].name}".`);
  console.error('A shop created by the service role cannot be given a Walrus namespace after the fact,');
  console.error('because provisioning only runs on creation. Delete it and re-run:');
  console.error('  node scripts/seed-demo-shop.mjs --reset <email> <password>');
  process.exit(1);
}

/* ---------- create the shop the way the application does ---------- */

const created = await api('POST', '/api/shops', { name: 'Ojo Provisions', marketArea: 'Lagos' });
const shop = created.shop ?? created;
console.log(`shop        ${shop.id}  ${shop.name}`);
console.log(`  memory    ${shop.memoryStatus ?? '(not returned)'}`);

/* ---------- supplier ---------- */

const supplierRes = await api('POST', '/api/suppliers', {
  displayName: 'Segun Wholesale',
  phone: '+234 803 000 0000',
  notes: 'Tomato paste and provisions. Delivers Tuesdays.',
});
const supplier = supplierRes.supplier ?? supplierRes;
console.log(`supplier    ${supplier.id}  ${supplier.displayName}`);

/* ---------- the deal, recorded nine days ago ---------- */

const dealRes = await api('POST', '/api/deals', {
  shopId: shop.id,
  supplierId: supplier.id,
  dealDate: daysAgo(9),
  expectedDeliveryAt: `${daysAgo(2)}T09:00:00Z`,
  headline: 'Weekly provisions order',
  currencyCode: 'NGN',
  termsAgreed: true,
  lines: [
    {
      productLabel: 'Tomato paste',
      quotedQuantity: 6,
      agreedQuantity: 6,
      unitLabel: 'cartons',
      quotedUnitPrice: 3000,
      agreedUnitPrice: 2917,
    },
  ],
});
const deal = dealRes.deal ?? dealRes;
console.log(`deal        ${deal.id}  dated ${deal.dealDate}`);

/* ---------- the history, backdated ---------- */

const events = [
  { eventType: 'quote_received', occurredAt: at(9, '10:12'), summary: 'Quoted 6 cartons at 3,000 each, 18,000 total.', quotedTotal: 18000, currencyCode: 'NGN' },
  { eventType: 'terms_agreed', occurredAt: at(9, '16:40'), summary: 'Agreed 2,917 per carton after negotiation, 17,500 total.', agreedTotal: 17500, currencyCode: 'NGN' },
  { eventType: 'delivery_checked', occurredAt: at(2, '11:05'), summary: 'Four of six cartons arrived. Two missing.', receivedTotal: 11668, currencyCode: 'NGN', condition: 'two cartons missing' },
  { eventType: 'issue_opened', occurredAt: at(2, '11:30'), summary: 'Short delivery: two cartons missing from a six carton order.', issueType: 'short_delivery' },
  { eventType: 'resolution_recorded', occurredAt: at(1, '09:20'), summary: 'Supplier credited 3,500 for the two missing cartons. Closed.', resolutionOutcome: 'credited' },
];

for (const e of events) {
  const res = await api('POST', `/api/deals/${deal.id}/events`, { shopId: shop.id, ...e });
  const ev = res.event ?? res;
  console.log(`  ${e.eventType.padEnd(21)} ${e.occurredAt.slice(0, 10)}  ${ev.id?.slice(0, 8)}`);
}

const mem = await api('GET', `/api/shops/${shop.id}/memory`);
console.log(`\nmemory      ${mem.memoryStatus}  walrusConfigured=${mem.walrusConfigured}  namespaceReady=${mem.namespaceReady}`);
console.log('\nNow ask Vendra: "What did we agree with Segun Wholesale, and what went wrong?"');