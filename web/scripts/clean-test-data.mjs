/**
 * Remove leftover automated test accounts and everything their shops contain.
 *
 * The end-to-end scripts delete their own accounts, but a run that fails partway
 * or is interrupted leaves rows behind, and the tenant-isolation suite leaves its
 * fixtures in place by design. This clears them so the live project contains no
 * records that could be mistaken for real retailer data.
 *
 * It refuses to touch anything that does not look like a test account unless
 * BOTH --force-all and --confirm-delete-real-accounts are passed.
 *
 *   node scripts/clean-test-data.mjs                    # test accounts only
 *   node scripts/clean-test-data.mjs --dry-run
 *   node scripts/clean-test-data.mjs --force-all --confirm-delete-real-accounts
 *
 * **Two flags, deliberately.** `--force-all` alone used to be enough, and that was
 * used to delete the founder's own live accounts and their shop while tidying up
 * after a test run. The accounts looked like leftovers because they had just been
 * listed by verify:clean, and the habit of cleaning up after a test run was
 * stronger than any thought about the founder. One flag was too easy to reach for
 * while thinking about something else, so destroying real data now needs a second
 * flag that cannot be typed by accident and says what it does.
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

const dryRun = process.argv.includes('--dry-run');
const forceAll = process.argv.includes('--force-all');
const confirmedRealAccounts = process.argv.includes('--confirm-delete-real-accounts');

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const isTest = (email) =>
  /@example\.test$/i.test(email ?? '') || /vendra-(e2e|prod|test|signup|manual)/i.test(email ?? '');

const { data: userData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listError) {
  console.log('could not list users:', listError.message);
  process.exit(1);
}

const users = userData.users ?? [];
const realAccounts = users.filter((u) => !isTest(u.email));
const willDeleteRealAccounts = forceAll && realAccounts.length > 0;

if (willDeleteRealAccounts && !confirmedRealAccounts) {
  console.error(`\nREFUSING to delete ${realAccounts.length} real account(s).`);
  console.error('These are not test accounts and their shops contain real records:\n');
  for (const user of realAccounts) console.error(`  ${user.email}`);
  console.error('\nIf you are certain these should go, re-run with:');
  console.error('  --force-all --confirm-delete-real-accounts');
  process.exit(1);
}

const targets = forceAll ? users : users.filter((u) => isTest(u.email));
const skipped = users.length - targets.length;

console.log(`${users.length} account(s) found.`);
console.log(`${targets.length} selected for deletion, ${skipped} kept.`);
if (skipped > 0) {
  console.log('\nkept (do not look like test accounts):');
  for (const user of users.filter((u) => !targets.includes(u))) {
    console.log(`  ${user.email}`);
  }
  console.log('\nPass --force-all --confirm-delete-real-accounts to delete these as well.');
}

if (targets.length === 0) {
  console.log('\nnothing to do.');
  process.exit(0);
}

if (dryRun) {
  console.log('\ndry run. would delete:');
  for (const user of targets) console.log(`  ${user.email}`);
  process.exit(0);
}

/**
 * Remove storage objects first. Shops cascade from auth.users, but a storage
 * object is not covered by any database foreign key, so it has to go explicitly.
 */
const shopIds = [];
for (const user of targets) {
  const { data: shops } = await admin.from('shops').select('id').eq('owner_user_id', user.id);
  shopIds.push(...(shops ?? []).map((s) => s.id));
}

if (shopIds.length > 0) {
  const bucket = 'evidence';
  for (const shopId of shopIds) {
    const { data: files } = await admin
      .from('evidence_files')
      .select('storage_object_key')
      .eq('shop_id', shopId);

    for (const file of files ?? []) {
      const { error: removeError } = await admin.storage.from(bucket).remove([file.storage_object_key]);
      if (removeError) console.log(`  could not remove object: ${removeError.message}`);
    }
  }
}

/**
 * Remove a user's records, then the account.
 *
 * Deleting rows table by table does not work: deal_events is protected by an
 * append-only trigger, and the erasure window it needs is transaction-local, so it
 * cannot span separate requests. erase_shop_records does the whole cascade in one
 * transaction and opens the window itself, so that is what this calls.
 *
 * The auth account is deleted only after its rows are gone. suppliers.created_by,
 * deals.created_by, deal_events.created_by and evidence_files.uploaded_by are
 * declared `on delete restrict`, so Supabase refuses to delete an account that
 * still owns records and reports only "Database error deleting user". That is the
 * schema working as intended.
 */
async function removeUserRecords(admin, userId) {
  const { data: owned } = await admin.from('shops').select('id').eq('owner_user_id', userId);

  for (const shop of owned ?? []) {
    // Storage objects are not covered by any database foreign key, so they are
    // removed explicitly first.
    const { data: files } = await admin
      .from('evidence_files')
      .select('storage_object_key')
      .eq('shop_id', shop.id);

    for (const file of files ?? []) {
      await admin.storage.from('evidence').remove([file.storage_object_key]);
    }

    await admin.rpc('erase_shop_records', { p_shop_id: shop.id });
  }

  // A user may also be a member of, or have authored rows in, shops they do not own.
  await admin.from('shop_memberships').delete().eq('user_id', userId);
  await admin.from('deals').delete().eq('created_by', userId);
  await admin.from('deal_events').delete().eq('created_by', userId);
  await admin.from('suppliers').delete().eq('created_by', userId);
  await admin.from('evidence_files').delete().eq('uploaded_by', userId);
  await admin.from('data_requests').delete().eq('requested_by', userId);
  await admin.from('audit_events').delete().eq('actor_user_id', userId);
  await admin.from('profiles').delete().eq('id', userId);
}

let failed = 0;
for (const user of targets) {
  try {
    await removeUserRecords(admin, user.id);
  } catch (error) {
    console.log(`  could not clear records for ${user.email}: ${error.message}`);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.log(`  FAILED ${user.email}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\ndeleted ${targets.length - failed}/${targets.length} account(s) and their shops.`);
process.exit(failed > 0 ? 1 : 0);
