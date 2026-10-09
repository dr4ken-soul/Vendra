/**
 * Create an unconfirmed account, so the code step can be exercised for real.
 *
 * Sign-up itself cannot mint a usable code while the project has no email
 * service, but an unconfirmed account makes the same code step reachable by a
 * different, honest route: signing in with an address that exists but has never
 * been confirmed. That is a state a real retailer can genuinely land in, and it
 * drives the same branch the form uses.
 *
 *   node scripts/create-unconfirmed-user.mjs <email> <password>
 *
 * Prints the credentials. Delete the account when finished.
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

const email = process.argv[2] ?? `vendra-unconfirmed-${Date.now()}@example.test`;
const password = process.argv[3] ?? `Vendra-unconfirmed-${Date.now()}-Aa1!`;

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: false,
  user_metadata: { display_name: 'Unconfirmed Test' },
});

if (error) {
  console.log('could not create the account:', error.message);
  process.exit(1);
}

console.log('created an unconfirmed account');
console.log('  email   :', email);
console.log('  password:', password);
console.log('  id      :', data.user.id);
console.log('  confirmed:', Boolean(data.user.email_confirmed_at));
console.log('');
console.log('Signing in with it now shows the code step, because the address exists');
console.log('but was never confirmed. That is the same branch a successful sign-up uses.');
