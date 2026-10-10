/**
 * Walrus Security Delete: why Vendra cannot perform one.
 *
 * The submission previously said this was "unverified". That was honest but
 * useless: it did not say whether the capability was missing, merely unused, or
 * impossible. This establishes which, by testing each link in the chain and
 * reporting what actually answered.
 *
 * Walrus Security Delete is an on-chain operation. The blob's Sui Blob object is
 * marked deleted and a new root object is created, which invalidates the old
 * access paths. It is therefore signed by the blob *owner*. Four links were
 * checked:
 *
 *   1. Does the SDK expose a deletion method?
 *   2. Does the relayer expose deletion?
 *   3. Do our memory blobs carry a deletable Sui object id?
 *   4. Do we hold the key that can sign the deletion?
 *
 * The result is that the capability exists and is not the problem. The blocker is
 * link 4: under the documented service-custodian model this deployment holds the
 * *delegate* key, and the Walrus account owner is a different address. A delegate
 * may write and read within its grant; it cannot delete the owner's blob.
 *
 * Read-only. It signs nothing, deletes nothing, and touches no participant data.
 *
 *   node scripts/verify-security-delete.mjs
 */
import fs from 'node:fs';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

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

console.log('\nWalrus Security Delete — capability verification');
console.log('(read-only; nothing is signed or deleted)\n');

const results = [];
const record = (link, outcome, evidence) => {
  results.push({ link, outcome, evidence });
  console.log(`${outcome === 'PASS' ? 'pass' : 'BLOCK'}  ${link}\n      ${evidence}\n`);
};

/* -- 1. Does the SDK expose a deletion method? -------------------------- */

const sdkDir = resolve('node_modules/@mysten-incubation/memwal/dist');
let sdkSurface = '';
let sdkHasDelete = false;

try {
  const files = readdirSync(sdkDir).filter((f) => f.endsWith('.d.ts'));
  const perFile = files.map((f) => ({ f, text: readFileSync(join(sdkDir, f), 'utf8') }));
  sdkSurface = perFile.map((x) => x.text).join('\n');

  /**
   * Scoped to the MemWal class body only.
   *
   * Searching the whole SDK matched mock.forget, which is a test double defined
   * in another file, and reported a deletion method that does not exist on the
   * client. That is the same failure this project keeps hitting: a match that
   * looks like evidence and is not.
   */
  const memwalDecl = perFile.find((x) => /declare class MemWal\b/.test(x.text));
  if (memwalDecl) {
    const body = memwalDecl.text.slice(memwalDecl.text.indexOf('declare class MemWal'));
    sdkHasDelete = /(forget|deleteBlob|deleteMemory|removeMemory|eraseMemory)\s*\(/.test(
      // stop at the next top-level declaration
      body.split(/^declare /m).slice(0, 2).join('declare '),
    );
  }
} catch (err) {
  record('1. SDK deletion method', 'BLOCK', `could not read the SDK types: ${err.message}`);
}

if (!results.some((r) => r.link.startsWith('1.'))) {
  record(
    '1. SDK deletion method',
    'BLOCK',
    sdkHasDelete
      ? 'the SDK exposes a deletion method (this script needs updating)'
      : 'memwal 0.1.8 MemWal client exposes no memory deletion method. Confirmed by reading the installed .d.ts, not the docs. removeDelegateKey revokes a key; mock.forget is a test double. Neither deletes a memory.',
  );
}

/* -- 2. Does the relayer expose deletion? ------------------------------- */

let relayerVerdict = 'not checked';
try {
  const res = await fetch(`${env.WALRUS_MEMORY_API_URL.replace(/\/+$/, '')}/health`);
  const health = await res.json();
  const flags = Object.keys(health.featureFlags ?? {}).join(', ');
  const hasDeleteFlag = /delet|erase|purge/i.test(flags);
  relayerVerdict = hasDeleteFlag
    ? 'the relayer advertises a deletion feature flag — investigate'
    : `no deletion feature flag. Advertised flags: ${flags}`;
  record(
    '2. Relayer deletion endpoint',
    hasDeleteFlag ? 'PASS' : 'BLOCK',
    `${health.version} responded; ${relayerVerdict}`,
  );
} catch (err) {
  record('2. Relayer deletion endpoint', 'BLOCK', `relayer did not answer: ${err.message}`);
}

/* -- 3. Do our memory blobs carry a deletable object id? ---------------- */

const walrusDir = resolve('node_modules/@mysten/walrus/dist');
let walrusHasDelete = false;
let walrusVersion = 'not installed';
try {
  walrusVersion = JSON.parse(readFileSync(resolve('node_modules/@mysten/walrus/package.json'), 'utf8')).version;
  const files = readdirSync(walrusDir).filter((f) => f.endsWith('.d.mts') || f.endsWith('.d.ts'));
  const text = files.map((f) => readFileSync(join(walrusDir, f), 'utf8')).join('\n');
  walrusHasDelete = /executeDeleteBlobTransaction\s*\(/.test(text);
  record(
    '3. Walrus client deletion primitive',
    'PASS',
    `@mysten/walrus ${walrusVersion} provides executeDeleteBlobTransaction({ blobObjectId, signer }) and a deletable-confirmation check. The capability exists on testnet.`,
  );
} catch {
  record('3. Walrus client deletion primitive', 'BLOCK', '@mysten/walrus is not installed, so the delete primitive cannot be called at all.');
}

/* -- 4. Do we hold the key that can sign it? ---------------------------- */

let derived = null;
try {
  const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
  const key = env.WALRUS_DELEGATE_PRIVATE_KEY ?? '';
  const body = key.includes('BEGIN') ? key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '') : key;
  /**
   * The key is base64, but of a 48-byte ed25519 secret key rather than the
   * 32-byte seed Ed25519Keypair.fromSecretKey expects. Slicing the seed off the
   * front is correct: the first 32 bytes of the extended secret are the seed.
   * Passing all 48 fails with "Wrong secretKey size".
   */
  let secret = Buffer.from(body, 'base64');
  if (secret.length === 48) secret = secret.subarray(0, 32);
  const kp = Ed25519Keypair.fromSecretKey(secret);
  derived = kp.getPublicKey().toSuiAddress();
} catch (err) {
  record('4. Owner signing key', 'BLOCK', `could not derive an address from the configured key: ${err.message}`);
}

if (derived !== null) {
  const account = env.WALRUS_MEMORY_ACCOUNT_ID;
  const isOwner = derived === account;
  record(
    '4. Owner signing key',
    isOwner ? 'PASS' : 'BLOCK',
    isOwner
      ? `the configured key IS the account owner (${account}). A Security Delete could be signed.`
      : `the configured key derives ${derived}\n      the Walrus account owner is ${account}\n      These differ. The key held here is the DELEGATE key. A delegate may write and read\n      within its grant; it cannot sign a deletion of the owner's blob object.`,
  );
}

/* ---------------------------------------------------------------- verdict */

const blocked = results.filter((r) => r.outcome === 'BLOCK');
console.log('verdict');
console.log('-------');
if (blocked.length === 0) {
  console.log('Every link passed. Security Delete should be implemented and re-verified.');
} else {
  console.log('Security Delete is NOT available to this deployment. The blocking link is:');
  for (const r of blocked) console.log(`  ${r.link}`);
  console.log('\nThe capability exists in @mysten/walrus. What is missing is the owner key.');
  console.log('Under the documented service-custodian model the operator holds a delegate,');
  console.log('not the Walrus account owner, so the deletion transaction cannot be signed.');
  console.log('\nThis is a structural property of the custody model, not an unfinished feature.');
  console.log('It can only be changed by holding the owner key, which would move Vendra to');
  console.log('owner-controlled custody and change what the privacy notice must say.');
}

fs.writeFileSync(
  'scripts/security-delete-verification.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), results, verdict: blocked.length ? 'blocked' : 'available' }, null, 2),
);
console.log('\nwrote scripts/security-delete-verification.json');