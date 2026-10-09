/**
 * Who actually exists in production, and what they have actually recorded.
 *
 * This exists because "three users with ten memories each" is the one
 * requirement that cannot be met by effort and has to be verified. Every other
 * claim in the submission can be produced by doing the work; this one can only be
 * met by other people using the product.
 *
 * It reads through the service role, because the question is about what exists,
 * not about what a given session can see. RLS is verified separately in
 * tests/tenant-isolation.
 *
 * This reports. It does not clean up, and it never deletes an account: the
 * founder's own account exists because sign-up was verified by hand, and
 * deleting a real account to make a number look tidier is exactly the behaviour
 * this repository avoids.
 *
 *   node scripts/audit-real-usage.mjs
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: users, error: userError } = await db.auth.admin.listUsers({ perPage: 200 });
if (userError) {
  console.error('could not list users:', userError.message);
  process.exit(1);
}

const { data: shops } = await db.from('shops').select('id, name, owner_user_id, created_at');
const { data: memberships } = await db.from('shop_memberships').select('shop_id, user_id, role');
const { data: deals } = await db.from('deals').select('id, shop_id, headline, status, created_at');
const { data: events } = await db.from('deal_events').select('id, shop_id, deal_id, event_type');
const { data: memory } = await db.from('walrus_memory_sync').select('id, shop_id, status');

const FOUNDER_EMAIL = 'web3psycho000@gmail.com';

const membersByShop = new Map();
for (const m of memberships ?? []) {
  if (!membersByShop.has(m.shop_id)) membersByShop.set(m.shop_id, []);
  membersByShop.get(m.shop_id).push(m);
}

console.log(`\nauth users: ${users.users.length}\n`);

const rows = [];
for (const u of users.users) {
  const shopsForUser = (memberships ?? []).filter((m) => m.user_id === u.id);
  const dealsForUser = [];
  const eventsForUser = [];
  const memoryForUser = [];

  for (const m of shopsForUser) {
    dealsForUser.push(...(deals ?? []).filter((d) => d.shop_id === m.shop_id));
    eventsForUser.push(...(events ?? []).filter((e) => e.shop_id === m.shop_id));
    memoryForUser.push(...(memory ?? []).filter((x) => x.shop_id === m.shop_id));
  }

  const confirmed = Boolean(u.email_confirmed_at);
  rows.push({
    email: u.email,
    isFounder: u.email === FOUNDER_EMAIL,
    confirmed,
    shops: shopsForUser.length,
    deals: dealsForUser.length,
    events: eventsForUser.length,
    memories: memoryForUser.length,
    joined: u.created_at?.slice(0, 10) ?? '?',
  });
}

rows.sort((a, b) => b.memories - a.memories || b.deals - a.deals);

console.log(
  ['email', 'shops', 'deals', 'events', 'memories', 'joined'].join('\t'),
);
for (const r of rows) {
  console.log(
    [
      r.email + (r.isFounder ? '  <- founder' : '') + (r.confirmed ? '' : '  (UNCONFIRMED)'),
      r.shops,
      r.deals,
      r.events,
      r.memories,
      r.joined,
    ].join('\t'),
  );
}

/* ------------------------------------------------------------------ verdict */

console.log('\nrequirement: three real users, ten memories each\n');

const qualifying = rows.filter((r) => r.confirmed && r.memories >= 10 && !r.isFounder);
console.log(`users meeting the bar alone : ${qualifying.length}`);
if (qualifying.length) for (const r of qualifying) console.log(`   ${r.email}  ${r.memories}`);

const realUsers = rows.filter((r) => r.confirmed && !r.isFounder);
console.log(`\nconfirmed users other than the founder : ${realUsers.length}`);
if (realUsers.length) for (const r of realUsers) {
  console.log(`   ${r.email}  deals ${r.deals}  events ${r.events}  memories ${r.memories}`);
}

const ready = realUsers.filter((r) => r.memories >= 10);
console.log(`\nverified: ${ready.length} non-founder users with >= 10 memories`);

if (ready.length < 3) {
  console.log('\nThis is NOT met. It cannot be met by doing more work here.');
  console.log('It needs more people recording real deals on their own accounts.');
}

const pending = (memory ?? []).filter((m) => m.status !== 'active').length;
console.log(`\nmemory rows not active: ${pending}`);
