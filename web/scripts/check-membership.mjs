/**
 * Inspect one shop membership's effective permissions.
 *
 * Written because of a seed defect that is easy to miss and looks like an
 * authorisation bug: `shop_memberships.permissions` has a column default of
 * `default_permissions_for_role('staff')`. Inserting a row with `role = 'owner'`
 * but **omitting** `permissions` therefore produces an owner with staff
 * permissions, and every owner-only action fails with a message about ownership
 * rather than about permissions.
 *
 *   node scripts/check-membership.mjs <shopId>
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

const shopId = process.argv[2];
if (!shopId) {
  console.error('usage: node scripts/check-membership.mjs <shopId>');
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: shop, error: shopError } = await admin
  .from('shops')
  .select('id,name,owner_user_id,deleted_at,memory_status')
  .eq('id', shopId)
  .single();

if (shopError) {
  console.error(shopError.message);
  process.exit(1);
}
console.log(`shop            ${shop.name}  (owner ${shop.owner_user_id.slice(0, 8)}, deleted=${shop.deleted_at ?? 'no'})`);

const { data: memberships } = await admin
  .from('shop_memberships')
  .select('id,user_id,role,permissions')
  .eq('shop_id', shopId);

if (!memberships || memberships.length === 0) {
  console.log('memberships   none');
  process.exit(0);
}

for (const m of memberships) {
  console.log(`membership      role=${m.role}  user=${m.user_id.slice(0, 8)}`);
  console.log(`permissions     ${(m.permissions ?? []).join(', ') || '(none)'}`);
  console.log(`privacy.erase   ${(m.permissions ?? []).includes('privacy.erase') ? 'granted' : 'MISSING'}`);
}