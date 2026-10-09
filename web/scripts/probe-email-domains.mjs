/**
 * Find out whether the failure is about the email *domain*, not about SMTP.
 *
 * Every test so far used an address at `example.test`, which RFC 2606 reserves
 * for documentation and which does not resolve. Supabase may be rejecting it as
 * an unroutable TLD long before any mail is attempted, which would make it look
 * exactly like an SMTP failure from the outside.
 *
 * This compares addresses that differ only in their domain part, using domains
 * that cannot deliver to a person:
 *
 *   example.test                      reserved, never resolves
 *   vendra-probe.invalid              reserved, never resolves
 *   <random>@<random>.com             real TLD, domain almost certainly unregistered
 *
 * If a real TLD behaves differently from the reserved ones, the reserved TLD was
 * the confounder and every previous result needs re-reading.
 *
 *   node scripts/probe-email-domains.mjs
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

const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = createClient(url, adminKey, { auth: { persistSession: false } });

const stamp = Date.now();
const password = `Vendra-domaintest-${stamp}-Aa1!`;

const candidates = [
  { label: 'reserved TLD, RFC 2606', email: `vendra-probe-${stamp}@example.test` },
  { label: 'reserved TLD .invalid', email: `vendra-probe-${stamp}@vendra-probe.invalid` },
  // A real TLD whose domain is almost certainly unregistered, so nothing can be
  // delivered even if the send succeeds.
  { label: 'real TLD, no such domain', email: `vendra-probe-${stamp}@vnd${stamp}x-probe.com` },
];

console.log('Comparing only the domain part. Anything that succeeds is cleaned up.\n');

for (const candidate of candidates) {
  const { data, error } = await anon.auth.signUp({
    email: candidate.email,
    password,
    options: { emailRedirectTo: 'http://localhost:3000/auth/confirm' },
  });

  const outcome = error
    ? `${error.code ?? '(no code)'} :: ${error.message}`
    : `ACCEPTED, session=${Boolean(data.session)}`;

  console.log(`${candidate.label.padEnd(28)} ${outcome}`);

  if (data?.user?.id) {
    await admin.auth.admin.deleteUser(data.user.id);
  }
}

console.log('');
console.log('If every line says the same thing, the domain part is not the confounder');
console.log('and the failure is in the mail path. If they differ, the reserved TLD was');
console.log('misleading every earlier result.');
