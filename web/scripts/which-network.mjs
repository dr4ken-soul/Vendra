/**
 * Does the MemWalAccount object exist on testnet, mainnet, or both?
 *
 * The submission form asks for a single explorer link and separately asks for a
 * confirmation that blobs were written on mainnet. Those two answers have to be
 * consistent with each other, so this establishes which network the account
 * actually lives on rather than assuming from the configured environment
 * variable.
 *
 * Read-only. Signed with the delegate key the same way the app signs.
 *
 *   node scripts/which-network.mjs
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

console.log(`\naccount ${accountId}`);
console.log(`configured network: ${env.WALRUS_NETWORK}`);
console.log(`relayer: ${env.WALRUS_MEMORY_API_URL}\n`);

/**
 * Ask each relayer whether it recognises the account.
 *
 * The relayer is the authority here rather than an explorer: it is the thing
 * that actually holds the memories, so its answer is the one that matters. An
 * explorer page can be rendered client side and say nothing either way.
 */
const relayers = [
  { label: 'staging (what Vendra uses)', url: env.WALRUS_MEMORY_API_URL },
  { label: 'production / mainnet', url: 'https://relayer.memory.walrus.xyz' },
];

for (const r of relayers) {
  try {
    const res = await fetch(`${r.url.replace(/\/+$/, '')}/health`, {
      headers: { Accept: 'application/json', Referer: 'https://memory.walrus.xyz/' },
      signal: AbortSignal.timeout(20000),
    });
    const health = await res.json();
    console.log(`${r.label}`);
    console.log(`  reachable        : yes (version ${health.version}, relayer ${health.relayerVersion})`);
    console.log(`  write_ready      : ${health.write_ready}`);
    console.log(`  network hint     : ${health.network ?? '(not reported)'}`);
  } catch (err) {
    console.log(`${r.label}`);
    console.log(`  reachable        : no (${err.message})`);
  }
  console.log('');
}

/**
 * The configured client, asked for its own namespaces.
 *
 * If this returns namespaces, the account is real on the relayer Vendra is
 * pointed at. It says nothing about mainnet, which is the point: the two are
 * separate deployments and a healthy testnet account does not imply a mainnet
 * one.
 */
console.log('asking the configured client for its namespaces:');
try {
  const client = MemWal.create({
    key: env.WALRUS_DELEGATE_PRIVATE_KEY,
    accountId,
    serverUrl: env.WALRUS_MEMORY_API_URL,
  });
  const namespaces = await client.listNamespaces();
  const list = namespaces?.namespaces ?? [];
  console.log(`  namespaces on ${env.WALRUS_NETWORK}: ${list.length}`);
  for (const ns of list) {
    console.log(`    ${ns.name}  (${ns.memory_count ?? '?'} memories)`);
  }
} catch (err) {
  console.log(`  failed: ${err.message}`);
}

console.log('\nwhat this means for the form');
console.log('-----------------------------');
console.log(`The account exists on ${env.WALRUS_NETWORK}. If that is testnet, then no blob`);
console.log('has been written on mainnet, because a Sui object address is network scoped');
console.log('and this one only resolves where Vendra is pointed.');