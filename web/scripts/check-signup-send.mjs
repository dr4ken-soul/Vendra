/**
 * Check whether sign-up gets past Supabase's mailer.
 *
 * Three distinct failures have looked identical from inside the application, and
 * this separates them by the code Supabase returns:
 *
 *   email_address_invalid              the built-in sender, team addresses only
 *   over_email_send_rate_limit         the project's hourly cap
 *   Error sending confirmation email   custom SMTP active, provider refused
 *
 * Acceptance is a real result: Supabase Auth reports send failures rather than
 * swallowing them, so no error means the configured provider took the message.
 *
 * Acceptance is not delivery. Whether a message lands in an inbox is the
 * receiving server's judgement and is not observable from here. A test address
 * with no mailbox cannot confirm it, because a bounce proves nothing either way.
 *
 *   node scripts/check-signup-send.mjs [address]
 *
 * The address is optional. Any account created is deleted before the script exits.
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
  console.log('  This is the meaningful result. Supabase Auth reports a send failure');
  console.log('  explicitly, so acceptance means the configured provider took the');
  console.log('  message rather than refusing it.');
  console.log('');
  console.log('  What this does NOT prove: that the message arrived. Deliverability is');
  console.log('  the receiving inbox\'s judgement, not Supabase\'s. The address above');
  console.log('  has no mailbox, so a bounce proves nothing either way.');
  console.log('');
  console.log('  The real test is a sign-up with a deliverable address and a correct');
  console.log('  code, which starts a session.');
}

if (data?.user?.id) {
  const admin = createClient(url, adminKey, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(data.user.id);
  console.log('');
  console.log('(cleaned up the test account)');
}
