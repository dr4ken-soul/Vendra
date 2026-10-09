/**
 * Remove one account by email, and only that one.
 *
 * Written because a seeded demo shop cannot be repaired after the fact — Walrus
 * provisioning only runs at creation — so the account has to be discarded and
 * remade. Refuses anything that is not an obvious throwaway.
 *
 *   node scripts/remove-account.mjs <email>
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

const email = process.argv[2];
if (!email) {
  console.error('usage: node scripts/remove-account.mjs <email>');
  process.exit(1);
}

/** Only obvious throwaways. This script must never reach real retailer data. */
const THROWAWAY = /(^demo\.|@vendra-demo\.test$|probe|focuscheck|guard\.check)/i;
if (!THROWAWAY.test(email)) {
  console.error(`REFUSING: ${email} does not look like a throwaway account.`);
  process.exit(1);
}

/**
 * `shop_memberships.permissions` defaults to `default_permissions_for_role('staff')`,
 * so a row inserted with `role = 'owner'` and no `permissions` is an owner with
 * staff rights. That creates a deadlock on removal: erasure needs
 * `privacy.erase`, which the membership does not have, and deleting the account
 * is blocked by the very rows erasure would remove.
 *
 * Both application insert sites pass permissions explicitly and are therefore
 * unaffected. This is only a hazard for hand-written seeds.
 */
const OWNER_PERMISSIONS = [
  'deal.view', 'deal.create', 'deal.edit', 'deal.event', 'evidence.view', 'evidence.upload',
  'supplier.manage', 'assistant.ask', 'memory.retry', 'team.view', 'team.manage',
  'settings.manage', 'privacy.export', 'privacy.erase',
];

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listError) {
  console.error(listError.message);
  process.exit(1);
}

const user = (data.users ?? []).find((u) => u.email === email);
if (!user) {
  console.log(`${email} is not present.`);
  process.exit(0);
}

// Repair owner permissions before anything else, so the erasure that deletion
// depends on is actually permitted.
const { data: memberships } = await admin
  .from('shop_memberships')
  .select('id, role, permissions')
  .eq('user_id', user.id);

for (const m of memberships ?? []) {
  if (m.role !== 'owner') continue;
  const missing = OWNER_PERMISSIONS.filter((p) => !(m.permissions ?? []).includes(p));
  if (missing.length === 0) continue;
  await admin.from('shop_memberships').update({ permissions: OWNER_PERMISSIONS }).eq('id', m.id);
  console.log(`repaired membership ${m.id.slice(0, 8)}: added ${missing.join(', ')}`);
}

const { error } = await admin.auth.admin.deleteUser(user.id);
if (error) {
  console.error(`FAILED ${email}: ${error.message}`);
  console.error('If this is the restrict error, the shop still has rows. Use reset-demo-shop.mjs,');
  console.error('which erases through the supported path instead of deleting the account outright.');
  process.exit(1);
}
console.log(`removed ${email}. Shops cascade from the account.`);