/**
 * Did migration 00012 actually apply?
 *
 * Read the live column default rather than trusting that a query was pasted and
 * run, because the SQL editor keeps an unsaved tab that looks identical to a
 * saved one until you look at the dot.
 *
 * `information_schema` is not reachable through PostgREST, so this tests the
 * property behaviourally instead: insert a membership **omitting permissions**
 * and see what the database does.
 *
 *   default still present -> insert succeeds, and the row silently gets the
 *                            staff set, which is the bug
 *   default dropped        -> insert fails on NOT NULL, which is the fix
 *
 * The probe row is deleted either way, so it leaves nothing behind.
 *
 *   node scripts/check-permissions-default.mjs
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const OWNER_PERMISSIONS = [
  'deal.view', 'deal.create', 'deal.edit', 'deal.event', 'evidence.view', 'evidence.upload',
  'supplier.manage', 'assistant.ask', 'memory.retry', 'team.view', 'team.manage',
  'settings.manage', 'privacy.export', 'privacy.erase',
];

const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const demo = (users?.users ?? []).find((u) => u.email === 'demo.shop@vendra-demo.test');
if (!demo) {
  console.error('needs the demo account. Create it first with create-confirmed-user.mjs.');
  process.exit(1);
}

const { data: shop } = await admin
  .from('shops')
  .select('id,name')
  .eq('owner_user_id', demo.id)
  .is('deleted_at', null)
  .limit(1)
  .maybeSingle();

if (!shop) {
  console.error('no live shop for the demo account');
  process.exit(1);
}

console.log(`probing against shop ${shop.name}`);

// Deliberately omits `permissions`.
const { data: inserted, error } = await admin
  .from('shop_memberships')
  .insert({ shop_id: shop.id, user_id: demo.id, role: 'staff' })
  .select('id, role, permissions')
  .single();

if (error) {
  console.log('');
  console.log(`insert omitting permissions -> REJECTED: ${error.message}`);
  console.log('');
  console.log('00012 IS APPLIED. The column has no default, so a caller that forgets');
  console.log('permissions fails loudly instead of silently getting the staff set.');
  process.exit(0);
}

const got = inserted.permissions ?? [];
console.log('');
console.log(`insert omitting permissions -> SUCCEEDED, got: ${got.join(', ')}`);
console.log('');

const isStaffSet = OWNER_PERMISSIONS.length > got.length && !got.includes('privacy.erase');
if (isStaffSet) {
  console.log('00012 has NOT been applied. The staff default is still in place, so an owner');
  console.log('inserted without permissions would silently be under-privileged.');
}

await admin.from('shop_memberships').delete().eq('id', inserted.id);
console.log('(probe row deleted)');