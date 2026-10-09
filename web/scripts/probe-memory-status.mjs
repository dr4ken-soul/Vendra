/**
 * Why audit-real-usage reported "memory rows not active: 24".
 *
 * The audit counts a memory as usable only when its status is exactly 'active'.
 * That is the right test for the submission's claim, because the recall endpoint
 * refuses to answer from anything else — but it means a status value this project
 * never anticipated would show up as silently absent evidence rather than as an
 * error. This prints the actual distribution so the number can be read.
 *
 *   node scripts/probe-memory-status.mjs
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

const { data: rows, error } = await db
  .from('walrus_memory_sync')
  .select('id, shop_id, deal_id, status, memory_version, job_id, memory_blob_id, last_error_code, updated_at');

if (error) {
  console.error(error.message);
  process.exit(1);
}

const byStatus = new Map();
for (const r of rows ?? []) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);

console.log(`\n${rows?.length ?? 0} memory rows\n`);
console.log('status distribution:');
for (const [status, n] of [...byStatus].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(status).padEnd(12)} ${n}`);
}

console.log('\nnon-active rows:');
for (const r of (rows ?? []).filter((x) => x.status !== 'active')) {
  console.log(
    `  ${r.status.padEnd(10)} v${r.memory_version ?? '?'}  deal ${String(r.deal_id).slice(0, 8)}  ` +
      `error=${r.last_error_code ?? '-'}  updated=${String(r.updated_at).slice(0, 19)}`,
  );
}

const { data: shops } = await db.from('shops').select('id, name');
console.log('\nby shop:');
for (const s of shops ?? []) {
  const n = (rows ?? []).filter((r) => r.shop_id === s.id);
  const active = n.filter((r) => r.status === 'active').length;
  console.log(`  ${String(s.name).slice(0, 26).padEnd(26)} ${active}/${n.length} active`);
}