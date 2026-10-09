/**
 * Why tests/tenant-isolation/isolation.test.ts was failing.
 *
 * Migration 00012 dropped the default on shop_memberships.permissions and made
 * the column NOT NULL. Both application insert sites pass permissions
 * explicitly, so the app was never broken. The test harness does not — it
 * inserts a membership with only shop_id, user_id and role. That insert now
 * fails, the user ends up with no membership at all, and RLS correctly returns
 * zero rows.
 *
 * So the four failures were the test being out of date with the schema, not a
 * regression in isolation. This script demonstrates that directly rather than
 * asserting it, because the distinction matters: the alternative reading is
 * that RLS silently stopped protecting data, which would be a serious bug.
 *
 *   node scripts/probe-membership-permissions.mjs
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const raw = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  const f = v[0];
  if ((f === '"' || f === "'") && v[v.length - 1] === f) v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const stamp = Date.now();
const email = `probe-perm-${stamp}@vendra-probe.test`;

const { data: user, error: userError } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  password: 'Vendra-probe-Aa1!',
});
if (userError) {
  console.error('createUser failed:', userError.message);
  process.exit(1);
}
const userId = user.user.id;

const { data: shop, error: shopError } = await admin
  .from('shops')
  .insert({ owner_user_id: userId, name: 'Perm Probe', currency_code: 'NGN' })
  .select('id')
  .single();
if (shopError) {
  console.error('shop insert failed:', shopError.message);
  process.exit(1);
}

console.log('probe shop      ', shop.id);

/* What the failing test does: no permissions column. */
const { error: noPerms } = await admin
  .from('shop_memberships')
  .insert({ shop_id: shop.id, user_id: userId, role: 'owner' });
console.log(
  'insert WITHOUT permissions ->',
  noPerms ? `REJECTED (${noPerms.code}) ${noPerms.message}` : 'accepted',
);

const { data: rows } = await admin
  .from('shop_memberships')
  .select('id, role, permissions')
  .eq('user_id', userId);
console.log('membership rows created  ', rows?.length ?? 0);

/* What the app does: permissions stated, derived from the role. */
const { data: rpc } = await admin.rpc('default_permissions_for_role', { p_role: 'owner' });
console.log('default_permissions_for_role(owner) ->', JSON.stringify(rpc));

const { error: withPerms } = await admin.from('shop_memberships').insert({
  shop_id: shop.id,
  user_id: userId,
  role: 'owner',
  permissions: rpc ?? [],
});
console.log('insert WITH permissions    ->', withPerms ? `REJECTED (${withPerms.message})` : 'accepted');

const { data: rows2 } = await admin
  .from('shop_memberships')
  .select('id, role, permissions')
  .eq('user_id', userId);
console.log('membership rows now        ', rows2?.length ?? 0);

/* Cleanup. Service role bypasses RLS, so this cannot strand rows. */
await admin.from('shops').delete().eq('id', shop.id);
await admin.auth.admin.deleteUser(userId);
console.log('\nprobe shop and user removed');