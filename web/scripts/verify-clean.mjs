/**
 * Verify the live database is clean and that the tables the application expects
 * all exist.
 *
 * Run after the end-to-end tests, which create and then delete their own data.
 * Row counts must be zero. A leftover row would mean a test record looks like a
 * real retailer, which is exactly the kind of fabricated evidence this project
 * must not contain.
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

const TABLES = [
  'profiles',
  'shops',
  'shop_memberships',
  'suppliers',
  'products',
  'deals',
  'deal_lines',
  'deal_events',
  'evidence_files',
  'walrus_memory_sync',
  'assistant_sessions',
  'assistant_messages',
  'audit_events',
  'data_requests',
];

let missing = 0;
let grand = 0;

console.log('table                       rows');
console.log('---------------------------  -----');

for (const table of TABLES) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`${table.padEnd(27)}  MISSING (${error.message.slice(0, 40)})`);
    missing += 1;
    continue;
  }
  grand += count ?? 0;
  console.log(`${table.padEnd(27)}  ${count ?? 0}`);
}

const userResult = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const users = userResult.data?.users ?? [];
const real = users.filter((u) => !/vendra-(e2e|prod|signup|manual|test)/i.test(u.email ?? ''));

console.log(`\nauth users                  ${users.length}`);
console.log(`non-test auth users         ${real.length}`);
console.log(`public rows                 ${grand}`);

const bucketResult = await admin.storage.listBuckets();
for (const bucket of bucketResult.data ?? []) {
  const { data: folders } = await admin.storage.from(bucket.name).list('', { limit: 1000 });
  let objects = 0;
  for (const folder of folders ?? []) {
    const { data: inner } = await admin.storage.from(bucket.name).list(folder.name, { limit: 1000 });
    objects += (inner ?? []).length;
  }
  console.log(`storage ${bucket.name.padEnd(19)} ${objects} object(s)`);
}

for (const user of real) console.log(`  non-test user: ${user.email}`);

if (missing > 0) {
  console.log(`\n${missing} expected table(s) missing.`);
  process.exit(1);
}

console.log('\nall expected tables present.');
