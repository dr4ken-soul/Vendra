/**
 * Turn on deal memory for a shop, then prove recall still works.
 *
 * The demo film's argument needs memory **active**, not merely grounded answers.
 * A shop created through the service role has no Walrus namespace, so recall falls
 * back to the relational record and reports `memoryStatus: unavailable` — which is
 * honest and also not the thing the film is about.
 *
 *   node scripts/enable-demo-memory.mjs <email> <password>
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
  console.error('usage: node scripts/enable-demo-memory.mjs <email> <password>');
  process.exit(1);
}

const BASE = process.env.DEMO_BASE_URL ?? 'https://vendra-psycho-projects.vercel.app';

const browser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: signIn, error } = await browser.auth.signInWithPassword({ email, password });
if (error) {
  console.error('sign-in failed:', error.message);
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

async function call(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', cookie: cookie(), ...(init?.headers ?? {}) },
    redirect: 'manual',
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const shops = await call('/api/shops', { method: 'GET' });
const shopId = shops.body?.[0]?.id ?? shops.body?.shops?.[0]?.id;
if (!shopId) {
  console.error('no shop for this account:', JSON.stringify(shops.body).slice(0, 300));
  process.exit(1);
}
console.log('shop', shopId, shops.body[0]?.name ?? shops.body?.shops?.[0]?.name);

const before = await call(`/api/shops/${shopId}/memory`, { method: 'GET' });
console.log('before  ', JSON.stringify(before.body));

const retry = await call('/api/memory/retry', { method: 'POST', body: JSON.stringify({ shopId }) });
console.log('retry   ', retry.status, JSON.stringify(retry.body).slice(0, 400));

const after = await call(`/api/shops/${shopId}/memory`, { method: 'GET' });
console.log('after   ', JSON.stringify(after.body));