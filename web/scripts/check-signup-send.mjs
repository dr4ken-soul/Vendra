/**
 * Check whether sign-up now gets past Supabase's built-in sender.
 *
 * Before custom SMTP was configured, every sign-up failed with
 * `email_address_invalid`, because the built-in sender only delivers to
 * addresses belonging to the Supabase organisation's team.
 *
 * This reports the exact error, if any. It does NOT prove an email arrived: that
 * depends on Resend accepting the send and the recipient's spam filter accepting
 * it, neither of which is observable from here.
 *
 *   node scripts/check-signup-send.mjs
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2] ?? `vendra-sendcheck-${Date.now()}@example.test`;
const password = `Vendra-sendcheck-${Date.now()}-Aa1!`;

const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await anon.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: 'http://localhost:3000/auth/confirm' },
});

console.log('address  :', email);
console.log('');

if (error) {
  console.log('signUp FAILED');
  console.log('  code   :', error.code ?? '(none)');
  console.log('  message:', error.message);
  console.log('');

  if (error.code === 'email_address_invalid') {
    console.log('  This is the built-in sender still refusing the address.');
    console.log('  Custom SMTP is not active for this project yet.');
  } else if (error.code === 'over_email_send_rate_limit') {
    console.log('  SMTP is active, because this is Supabase\'s own cap rather than');
    console.log('  the built-in sender. Raise it under Authentication > Rate Limits.');
  } else {
    console.log('  A different error. Check Authentication > SMTP Settings.');
  }
} else {
  console.log('signUp ACCEPTED by Supabase Auth.');
  console.log('  session returned:', Boolean(data.session));
  console.log('');
  console.log('  A verification email was handed to Resend. Whether it arrives is');
  console.log('  now a question of Resend and the recipient\'s spam filter, not of');
  console.log('  Supabase. Check the address above for an email from "Vendra".');
}

if (data?.user?.id) {
  const admin = createClient(url, adminKey, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(data.user.id);
  console.log('');
  console.log('(cleaned up the test account)');
}
