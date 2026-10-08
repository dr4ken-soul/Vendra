/**
 * Create a confirmed account so the sign-in UI can be exercised in a real
 * browser.
 *
 * Sign-up through the UI currently fails with over_email_send_rate_limit: the
 * project requires email confirmation and the hourly outbound email quota is
 * exhausted. That is a project setting, not an application defect. Creating the
 * user with the service role confirms the address without sending an email, so
 * the sign-in path itself can still be verified.
 *
 *   node scripts/create-confirmed-user.mjs <email> <password>
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

const email = process.argv[2] ?? `vendra-manual-${Date.now()}@example.test`;
const password = process.argv[3] ?? `Vendra-manual-${Date.now()}-Aa1!`;

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: 'Manual Test Owner' },
});

if (error) {
  console.log('could not create the user:', error.message);
  process.exit(1);
}

console.log('created confirmed user');
console.log('  email   :', email);
console.log('  password:', password);
console.log('  id      :', data.user.id);
console.log('');
console.log('Sign in at http://localhost:3000/sign-in with those credentials.');
console.log('Delete it afterwards so no test account is left behind.');
