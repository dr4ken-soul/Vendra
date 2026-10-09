/**
 * Why are 17 memory rows sitting at `processing`?
 *
 * `processing` means the write was accepted by the relayer and the row is waiting
 * for confirmation. reconcilePendingWrites promotes it to `ready`, but only when
 * the Ask or Settings screen loads. So a retailer who records deals and never
 * opens Ask sees "memory syncing" forever, even if the write succeeded hours ago.
 *
 * Two possibilities with very different fixes:
 *
 *   1. The writes succeeded and nobody reconciled. The data is fine, the UI is
 *      lying. Fix: reconcile on any load, or on a schedule.
 *   2. The writes genuinely never completed. The shop's deal memory does not hold
 *      what the shop believes it holds, and no UI change fixes that.
 *
 * This asks the relayer directly so the answer does not depend on which it is.
 *
 * Signed with the delegate key, the same scheme as the app. Read-only apart from
 * promoting rows to ready, which is precisely what the app's own reconcile does.
 *
 *   node scripts/probe-stuck-memory.mjs             # report only
 *   node scripts/probe-stuck-memory.mjs --reconcile # also promote ready rows
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
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

const reconcile = process.argv.includes('--reconcile');

const { data: rows, error } = await db
  .from('walrus_memory_sync')
  .select('id, shop_id, deal_id, status, job_id, namespace, last_error_code, updated_at')
  .in('status', ['queued', 'processing']);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const { data: shops } = await db.from('shops').select('id, name');
const shopName = new Map((shops ?? []).map((s) => [s.id, s.name]));

console.log(`\n${rows?.length ?? 0} rows awaiting confirmation`);
console.log(`relayer: ${env.WALRUS_MEMORY_API_URL}\n`);
if (!rows?.length) process.exit(0);

/**
 * Sign and call the same status endpoint the app uses.
 *
 * Private key handling mirrors lib/memory/walrus.ts: the key is read from the
 * env, used to sign, and never written anywhere or logged.
 */
/**
 * Ask the relayer through the app's own SDK.
 *
 * The first version of this script hand-rolled the signing and failed with an
 * OpenSSL decoder error, because the delegate key is not a plain PKCS#8 PEM and
 * the SDK does more than wrap it. Reimplementing a signing scheme to check a
 * status is exactly the wrong trade: if the two implementations disagree, the
 * answer is wrong in a way nobody can see. The SDK is the app's, so the answer
 * is the app's.
 */
const { MemWal } = await import('@mysten-incubation/memwal');

/** Exactly the client lib/memory/walrus.ts builds, with the same arguments. */
function buildClient(namespace) {
  return MemWal.create({
    key: env.WALRUS_DELEGATE_PRIVATE_KEY,
    accountId: env.WALRUS_MEMORY_ACCOUNT_ID,
    serverUrl: env.WALRUS_MEMORY_API_URL,
    namespace,
  });
}

async function checkJob(namespace, jobId) {
  const status = await buildClient(namespace).getRememberStatus(jobId);
  switch (status.status) {
    case 'done':
    case 'uploaded':
      return { state: 'ready', blobId: status.blob_id ?? null };
    case 'pending':
    case 'running':
      return { state: 'processing' };
    case 'failed':
      return { state: 'failed', errorCode: 'job_failed' };
    default:
      return { state: 'unknown', errorCode: 'job_not_found' };
  }
}

let ready = 0;
let failed = 0;
let other = 0;

for (const r of rows) {
  const name = String(shopName.get(r.shop_id) ?? r.shop_id).slice(0, 20).padEnd(20);

  if (!r.job_id) {
    console.log(`  ${r.status.padEnd(11)} ${name} NO JOB ID - never left the queue`);
    other++;
    continue;
  }

  let result;
  try {
    result = await checkJob(r.namespace, r.job_id);
  } catch (err) {
    console.log(`  ${r.status.padEnd(11)} ${name} could not ask: ${err.message}`);
    other++;
    continue;
  }

  if (result.state === 'ready') {
    ready++;
    console.log(`  ${r.status.padEnd(11)} ${name} -> READY   the write succeeded; nobody reconciled it`);
    if (reconcile) {
      await db
        .from('walrus_memory_sync')
        .update({ status: 'ready', memory_blob_id: result.blobId, verified_at: new Date().toISOString() })
        .eq('id', r.id);
    }
  } else if (result.state === 'failed') {
    failed++;
    console.log(`  ${r.status.padEnd(11)} ${name} -> FAILED  ${result.errorCode}  the write did not complete`);
  } else {
    other++;
    console.log(`  ${r.status.padEnd(11)} ${name} -> ${result.state}  ${result.errorCode ?? ''}`);
  }
}

console.log(`\nready ${ready}   failed ${failed}   other ${other}`);
if (ready && !reconcile) console.log('Re-run with --reconcile to promote the ready ones.');
if (ready && reconcile) console.log(`\n${ready} rows promoted to ready. The data was there all along.`);