/**
 * Can this account write on mainnet, or is the mainnet answer structurally 0?
 *
 * The submission form asks for a count of agents that have written blobs on
 * mainnet and requires a confirmation. Vendra is configured against the staging
 * relayer on testnet, so the honest answer is 0. Before that is treated as
 * final, this checks whether the account is *able* to write on the production
 * relayer, because if it can, the real fix is to make one write happen rather
 * than to argue with the form.
 *
 * It does not write. It asks the production relayer whether it recognises the
 * account, which is a read.
 *
 *   node scripts/can-we-write-mainnet.mjs
 */
import fs from 'node:fs';
import { MemWal } from '@mysten-incubation/memwal';

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

const accountId = env.WALRUS_MEMORY_ACCOUNT_ID;
const STAGING = env.WALRUS_MEMORY_API_URL;
const PRODUCTION = 'https://relayer.memory.walrus.xyz';

console.log(`\naccount  ${accountId}`);
console.log(`staging  ${STAGING}`);
console.log(`prod     ${PRODUCTION}\n`);

async function namespacesAt(url, label) {
  try {
    const client = MemWal.create({
      key: env.WALRUS_DELEGATE_PRIVATE_KEY,
      accountId,
      serverUrl: url,
    });
    const res = await client.listNamespaces();
    const list = res?.namespaces ?? [];
    console.log(`${label}`);
    console.log(`  namespaces: ${list.length}`);
    const total = list.reduce((n, ns) => n + (ns.memory_count ?? 0), 0);
    console.log(`  memories:   ${total}`);
    return { ok: true, count: list.length, total };
  } catch (err) {
    console.log(`${label}`);
    console.log(`  error: ${err.message.slice(0, 180)}`);
    return { ok: false, error: err.message };
  }
}

const staging = await namespacesAt(STAGING, 'STAGING (testnet, what Vendra uses)');
console.log('');
const prod = await namespacesAt(PRODUCTION, 'PRODUCTION (mainnet)');

console.log('\nverdict');
console.log('-------');
if (staging.ok && staging.count > 0 && !prod.ok) {
  console.log('The account exists on testnet only. The production relayer rejects it.');
  console.log('');
  console.log('That is not a configuration mistake. A Sui account and its delegate key are');
  console.log('network scoped. The account object does not exist on mainnet, so there is');
  console.log('nothing to write under and no way to make it exist without mainnet gas and a');
  console.log('mainnet deployment of the account.');
  console.log('');
  console.log('The honest mainnet answer is 0.');
} else if (prod.ok) {
  console.log('The production relayer recognises this account.');
  console.log('A real mainnet write may therefore be possible. Do it and the answer stops being 0.');
} else {
  console.log('Inconclusive. See the raw output above.');
}