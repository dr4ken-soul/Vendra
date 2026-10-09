/**
 * What does Supabase actually return for a wrong six-digit code?
 *
 * The UI showed "Vendra cannot send verification email to that address right now.
 * Supabase's built-in email sender only delivers to the operator's own email
 * address" after a code was entered. Custom SMTP is connected, so that sentence
 * cannot be right. This prints the real code and message so the mapping is
 * written against what Supabase sends rather than against what it is assumed to
 * send.
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

const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const email = `vendra-otpprobe-${Date.now()}@vnd-otp-probe.com`;
const password = `Vendra-otpprobe-${Date.now()}-Aa1!`;

const { data, error: signUpError } = await anon.auth.signUp({ email, password });
console.log(`signUp        : ${signUpError ? `FAILED ${signUpError.code ?? ''} ${signUpError.message}` : 'accepted'}`);

if (signUpError) process.exit(1);

const userId = data.user?.id;

for (const [label, code] of [
  ['wrong code      ', '000000'],
  ['plausible wrong ', '380515'],
]) {
  const { error } = await anon.auth.verifyOtp({ email, token: code, type: 'signup' });
  console.log('');
  console.log(`${label}`);
  console.log(`  code    : ${error?.code ?? '(none)'}`);
  console.log(`  message : ${error?.message ?? '(none)'}`);
  console.log(`  /is invalid/i matches message : ${/is invalid/i.test(error?.message ?? '')}`);
  console.log(`  -> which branch fires today   : ${
    error?.code === 'email_address_invalid' || /is invalid/i.test(error?.message ?? '')
      ? 'WRONG: built-in sender message'
      : 'otp/other'
  }`);
}

const { error: again } = await anon.auth.signUp({ email, password });
console.log('');
console.log(`duplicate signUp: code=${again?.code ?? '(none)'} message=${again?.message ?? '(none)'}`);

if (userId) {
  await admin.auth.admin.deleteUser(userId);
  console.log('\n(cleaned up)');
}