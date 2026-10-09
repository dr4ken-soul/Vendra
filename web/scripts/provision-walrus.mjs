/**
 * Provision a Walrus Memory account on Sui and register a delegate key for it.
 *
 * This is the one-time operator step. It produces the two values Vendra needs at
 * runtime: a MemWalAccount object id and an Ed25519 delegate private key.
 *
 * After this runs, set in web/.env.local:
 *
 *   WALRUS_MEMORY_ACCOUNT_ID   the MemWalAccount object id
 *   WALRUS_DELEGATE_PRIVATE_KEY the delegate key in hex
 *   WALRUS_NETWORK              testnet
 *   WALRUS_MEMORY_API_URL       https://relayer-staging.memory.walrus.xyz
 *
 * The account is owned by the Sui wallet in SUI_PRIVATE_KEY. The delegate key is
 * what the server actually signs with, so the operator can rotate the server's
 * access without moving ownership: add a new key, redeploy, then remove the old
 * one from the chain.
 *
 * IMPORTANT: one account per Sui address, enforced by the contract. Run it twice
 * by accident and the second call fails with EAccountAlreadyExists (error 3).
 *
 *   node scripts/provision-walrus.mjs --dry-run   # print IDs, send nothing
 *   node scripts/provision-walrus.mjs             # create the account
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');

const dryRun = process.argv.includes('--dry-run');

/**
 * Network IDs for the public Walrus Memory deployments.
 * Source: https://docs.wal.app/walrus-memory/contract/overview#network-ids
 *
 * These are deployment parameters of the Move package on each network, not
 * credentials. They are published, and hardcoding them is correct. The account id
 * and delegate key produced by this script are the secrets.
 */
const NETWORKS = {
  testnet: {
    packageId: '0x0a625e2db2af6f591a4c80a3d8551ddf11656089cc3a20c5e9e7f8fb75b9265c',
    registryId: '0x736aef9906798fca4460490ccdf8e8502ef170122dc26ecae32111b78c6b42dd',
    relayerUrl: 'https://relayer-staging.memory.walrus.xyz',
    explorer: 'https://suiscan.xyz/testnet',
  },
  mainnet: {
    packageId: '0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5',
    registryId: '0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f',
    relayerUrl: 'https://relayer.memory.walrus.xyz',
    explorer: 'https://suiscan.xyz/mainnet',
  },
};

function loadEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    const f = v[0];
    if ((f === '"' || f === "'") && v[v.length - 1] === f) v = v.slice(1, -1);
    values[t.slice(0, i).trim()] = v;
  }
  return values;
}

const env = loadEnvFile(path.join(webRoot, '.env.local'));

const networkName = (process.env.WALRUS_NETWORK || env.WALRUS_NETWORK || 'testnet').trim();
const network = NETWORKS[networkName];

if (!network) {
  console.error(`Unknown WALRUS_NETWORK "${networkName}". Use testnet or mainnet.`);
  process.exit(1);
}

console.log(`network        ${networkName}`);
console.log(`package id     ${network.packageId}`);
console.log(`registry id    ${network.registryId}`);
console.log(`relayer        ${network.relayerUrl}`);
console.log(`registry       ${network.explorer}/object/${network.registryId}`);
console.log('');

if (dryRun) {
  console.log('dry run: no transaction will be sent, and no key is needed.');
  console.log('');
  console.log('To provision for real, re-run without --dry-run and with SUI_PRIVATE_KEY set.');
  process.exit(0);
}

// The Sui wallet that will OWN the account. This is a real key: it is read from
// the environment and never written anywhere.
const suiPrivateKey = process.env.SUI_PRIVATE_KEY || env.SUI_PRIVATE_KEY;

if (!suiPrivateKey) {
  console.error(
    [
      'SUI_PRIVATE_KEY is not set, so this script cannot sign the account-creation',
      'transaction. It is read from the environment and never written to disk.',
      '',
      'For a testnet wallet the key looks like:',
      '  suiprivkey1...',
      '',
      'Export it for this shell only, then unset it afterwards:',
      '  $env:SUI_PRIVATE_KEY = "suiprivkey1..."   # PowerShell',
      '  export SUI_PRIVATE_KEY=suiprivkey1...    # bash',
    ].join('\n'),
  );
  process.exit(1);
}

/**
 * Build a Sui client for the target network.
 *
 * @mysten/sui v2 no longer exports a SuiClient from the package root, so the
 * MemWal SDK cannot construct one itself and asks for `suiClient` in its options.
 * It also cannot use JSON-RPC: public fullnodes deprecated it, so gRPC is the
 * transport that actually works against a public endpoint.
 */
async function buildSuiClient() {
  const { SuiGrpcClient } = await import('@mysten/sui/grpc');
  const baseUrl =
    networkName === 'mainnet'
      ? 'https://fullnode.mainnet.sui.io:443'
      : 'https://fullnode.testnet.sui.io:443';

  const client = new SuiGrpcClient({ network: networkName, baseUrl });

  // Fail before sending anything if the wallet cannot pay for gas.
  const address = await addressOf(suiPrivateKey);
  const { balance } = await client.core.getBalance({ owner: address });
  const mist = BigInt(balance.balance);
  console.log(`wallet         ${address}`);
  console.log(`balance        ${mist} MIST (${Number(mist) / 1e9} SUI)`);

  if (mist === 0n) {
    throw new Error(
      `This wallet has no ${networkName} SUI, so it cannot pay for the account-creation transaction.\n` +
        `Get testnet SUI from https://faucet.sui.io using this address:\n  ${address}`,
    );
  }

  return client;
}

const { createAccount, addDelegateKey, generateDelegateKey } = await import(
  '@mysten-incubation/memwal/account'
);

const suiClient = await buildSuiClient();
console.log('');

console.log('generating a delegate keypair...');
const delegate = await generateDelegateKey();
console.log(`  delegate sui address  ${delegate.suiAddress}`);
console.log(`  delegate public key   ${Buffer.from(delegate.publicKey).toString('hex').slice(0, 16)}...`);
console.log('');

console.log('creating the MemWalAccount on chain (this costs gas)...');
let account;

try {
  account = await createAccount({
    packageId: network.packageId,
    registryId: network.registryId,
    suiPrivateKey,
    suiClient,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (/already exists|already has an account|EAccountAlreadyExists/i.test(message)) {
    console.error('');
    console.error('This Sui address already has a Walrus Memory account.');
    console.error('The contract allows exactly one account per address, so this script');
    console.error('cannot create a second one.');
    console.error('');
    console.error('Find the existing account id in the Sui explorer for your address:');
    console.error(`  ${network.explorer}/address/${await addressOf(suiPrivateKey)}`);
    console.error('');
    console.error('Then set WALRUS_MEMORY_ACCOUNT_ID to that object id and re-run to');
    console.error('register a delegate key.');
    process.exit(1);
  }

  console.error('account creation failed:', message);
  console.error('');
  console.error('Most likely causes:');
  console.error('  - the wallet has no testnet SUI (faucet: https://faucet.sui.io)');
  console.error('  - the wallet is on the wrong network');
  console.error('  - the registry or package id is for the other network');
  process.exit(1);
}

console.log(`  account id  ${account.accountId}`);
console.log(`  owner       ${account.owner}`);
console.log(`  digest      ${account.digest}`);
console.log('');

console.log('registering the delegate key...');
const added = await addDelegateKey({
  packageId: network.packageId,
  registryId: network.registryId,
  accountId: account.accountId,
  publicKey: delegate.publicKey,
  label: 'vendra-server',
  suiPrivateKey,
  suiClient,
});

console.log(`  delegate address  ${added.suiAddress}`);
console.log(`  digest            ${added.digest}`);
console.log('');

console.log('='.repeat(70));
console.log('Add these to web/.env.local:');
console.log('='.repeat(70));
console.log(`WALRUS_NETWORK=${networkName}`);
console.log(`WALRUS_MEMORY_API_URL=${network.relayerUrl}`);
console.log(`WALRUS_MEMORY_ACCOUNT_ID=${account.accountId}`);
console.log(`WALRUS_DELEGATE_PRIVATE_KEY=${delegate.privateKey}`);
console.log(`WALRUS_OWNER_SIGNING_MODE=service_custodian`);
console.log('');
console.log('Then verify the account on chain:');
console.log(`  ${network.explorer}/object/${account.accountId}`);
console.log('');
console.log('The delegate private key is printed once and is not recoverable. Store it');
console.log('in the same place as the Supabase service role key: a secrets manager,');
console.log('never in version control.');

/** Read the wallet address out of a bech32 private key, for explorer links. */
async function addressOf(key) {
  try {
    // @mysten/sui v2 bundles the keypair implementations; the standalone
    // @mysten/keypairs.js package is not a dependency here.
    const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
    return Ed25519Keypair.fromSecretKey(key).getPublicKey().toSuiAddress();
  } catch {
    return '(address could not be derived)';
  }
}
