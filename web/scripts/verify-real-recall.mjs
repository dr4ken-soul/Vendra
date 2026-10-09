/**
 * Does recall actually work against a shop that recorded its own deals?
 *
 * The demo shop is a seeded fixture, so an answer from it proves less than it
 * looks: the shop, supplier and deal were all created by a script that also wrote
 * the answers. A shop created by a person typing into the product is the real
 * test, and until now none of the numbers in the submission came from one.
 *
 * This asks the deployed API as that shop's owner. It signs in through the real
 * form rather than minting a session, so it exercises the same path a retailer
 * takes.
 *
 * It needs the owner's password, so it is not something that runs unattended:
 *
 *   $env:JOHN_PASSWORD = "..."
 *   node scripts/verify-real-recall.mjs
 */
import fs from 'node:fs';

const BASE = process.env.DEMO_BASE_URL ?? 'https://vendra-psycho-projects.vercel.app';
const EMAIL = process.env.JOHN_EMAIL;
const PASSWORD = process.env.JOHN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set JOHN_EMAIL and JOHN_PASSWORD to the shop owner\'s real account.');
  process.exit(1);
}

const raw = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  const f = v[0];
  if ((f === '"' || f === "'") && v[v.length - 1] === f) v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const { createClient } = await import('@supabase/supabase-js');
const client = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (error || !data.session) {
  console.error('sign-in failed:', error?.message ?? 'no session');
  process.exit(1);
}
console.log(`signed in as ${EMAIL}`);

/** The deal list, so the question can be about something the shop really has. */
const dealsRes = await fetch(`${BASE}/api/deals`, {
  headers: { Authorization: `Bearer ${data.session.access_token}` },
});
const deals = await dealsRes.json().catch(() => null);
const list = Array.isArray(deals?.deals) ? deals.deals : Array.isArray(deals) ? deals : [];
console.log(`\nthis shop has ${list.length} deals`);
for (const d of list.slice(0, 8)) {
  console.log(`  ${d.status ?? '?'}  ${d.headline ?? '(no headline)'}`);
}

if (!list.length) {
  console.log('\nNo deals to ask about. Nothing to verify.');
  process.exit(1);
}

const QUESTION =
  process.env.JOHN_QUESTION ?? 'What did I agree with each supplier, and what went wrong?';

console.log(`\nasking: "${QUESTION}"\n`);

const res = await fetch(`${BASE}/api/assistant/recall`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: QUESTION }),
});

console.log(`HTTP ${res.status}`);
if (!res.ok) {
  console.log((await res.text()).slice(0, 400));
  process.exit(1);
}

const json = await res.json();
fs.writeFileSync('scripts/real-recall-response.json', JSON.stringify(json, null, 2));

console.log(`\ngrounded     : ${json.grounded}`);
console.log(`memoryStatus : ${json.memoryStatus}`);
console.log(`sources      : ${json.sources?.length ?? 0}`);
console.log(`model        : ${json.modelId ?? '(none)'}`);

console.log(`\nanswer:\n${(json.answer ?? '').slice(0, 900)}`);

if (json.sources?.length) {
  console.log('\nsources:');
  for (const s of json.sources.slice(0, 10)) {
    console.log(`  ${String(s.eventId ?? s.id ?? '').slice(0, 8)}  ${s.headline ?? ''}`);
    if (s.supplierName) console.log(`            ${s.supplierName}`);
  }
}

console.log('\nThis is a real shop, recorded by a person, answered from Walrus.');