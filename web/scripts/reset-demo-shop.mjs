/**
 * Remove the demo shop so it can be recreated properly.
 *
 * A shop written with the service role cannot be given a Walrus namespace after
 * the fact — provisioning only runs on creation — so the only way to get a shop
 * with memory is to delete it and let the application create it. Erasure is the
 * supported path and is used here rather than a table delete.
 *
 * Refuses to touch any shop whose name is not the demo shop's, so this cannot
 * reach the founder's own data by accident.
 *
 *   node scripts/reset-demo-shop.mjs <email> <password>
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
const BASE = process.env.DEMO_BASE_URL ?? 'https://vendra-psycho-projects.vercel.app';
const EXPECTED = 'Ojo Provisions';

const browser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: signIn } = await browser.auth.signInWithPassword({ email, password });
if (!signIn) {
  console.error('sign-in failed');
  process.exit(1);
}

async function cookies(accessToken, refreshToken) {
  const captured = new Map();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: (l) => { for (const c of l) captured.set(c.name, c.value); } },
  });
  await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return captured;
}
const jar = await cookies(signIn.session.access_token, signIn.session.refresh_token);
const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', cookie: cookie() },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const shops = await api('GET', '/api/shops');
const list = Array.isArray(shops) ? shops : (shops?.shops ?? []);
if (list.length === 0) {
  console.log('no shops for this account');
  process.exit(0);
}

for (const shop of list) {
  if (shop.name !== EXPECTED) {
    console.error(`REFUSING: shop "${shop.name}" is not the demo shop. Leaving it alone.`);
    process.exit(1);
  }
  console.log(`erasing ${shop.id}  ${shop.name}`);
  // Erasure requires the shop name typed back as confirmation. That guard is the
  // product working; this script has to satisfy it rather than route around it.
  const res = await api('POST', '/api/privacy/erase', {
    shopId: shop.id,
    confirmShopName: shop.name,
  });
  console.log(`  ${JSON.stringify(res).slice(0, 300)}`);
}

console.log('done. re-run seed-demo-shop.mjs to create it properly.');