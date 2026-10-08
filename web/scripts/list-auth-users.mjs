/**
 * List every auth account, separating recognisable automated test accounts from
 * anything that looks like a real person.
 *
 * Read-only. Used to confirm that no test account is left behind in the live
 * project after a test run.
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

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (error) {
  console.log('could not list users:', error.message);
  process.exit(1);
}

const users = data.users ?? [];
const isTest = (email) => /@example\.test$/i.test(email ?? '') || /vendra-(e2e|prod|test|signup|manual)/i.test(email ?? '');

console.log(`${users.length} auth account(s)\n`);

for (const user of users) {
  const flag = isTest(user.email) ? 'test ' : 'REAL ';
  console.log(`${flag} ${user.email}  created=${user.created_at}`);
}

const real = users.filter((u) => !isTest(u.email));
console.log(`\n${users.length - real.length} test account(s), ${real.length} real account(s).`);

if (real.length > 0) {
  console.log('\nReal accounts present. Delete any that were created for testing:');
  for (const user of real) console.log(`  ${user.id}  ${user.email}`);
}
