/**
 * Did the values pushed to Vercel arrive intact?
 *
 * Compares lengths and equality only. No secret is printed, hashed in a way that
 * could be brute forced, or written anywhere. The question is only whether the
 * shell mangled the value on the way through `execFileSync(..., { shell: true })`,
 * which is what a 401 from the Walrus relayer would look like.
 */
import fs from 'node:fs';

function parse(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    const f = v[0];
    if ((f === '"' || f === "'") && v[v.length - 1] === f) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

const local = parse('.env.local');
const remote = parse(process.argv[2]);

const keys = ['WALRUS_DELEGATE_PRIVATE_KEY', 'WALRUS_MEMORY_ACCOUNT_ID', 'WALRUS_NETWORK', 'WALRUS_MEMORY_API_URL'];

console.log('key                          local  remote  equal  remoteShape');
console.log('-'.repeat(78));

for (const k of keys) {
  const l = local[k] ?? '';
  const r = remote[k] ?? '';
  const same = l === r && l !== '';
  const suspicious = /[^A-Za-z0-9:_\-./]/.test(r) || r.includes("'") || r.includes('"');
  console.log(
    `${k.padEnd(28)} ${String(l.length).padStart(5)}  ${String(r.length).padStart(6)}  ${String(same).padEnd(6)}  ${
      suspicious ? 'CHECK CHARS' : 'plain'
    }`,
  );
  if (!same && l && r) {
    // Report only the first differing position, never the characters themselves.
    const n = Math.max(l.length, r.length);
    let at = -1;
    for (let i = 0; i < n; i += 1) {
      if (l[i] !== r[i]) { at = i; break; }
    }
    console.log(`${''.padEnd(28)} first difference at index ${at}`);
    console.log(`${''.padEnd(28)} local  has ${/[^A-Za-z0-9:_\-./]/.test(l) ? 'unusual characters' : 'only plain chars'}`);
    console.log(`${''.padEnd(28)} remote has ${/[^A-Za-z0-9:_\-./]/.test(r) ? 'unusual characters' : 'only plain chars'}`);
  }
}

console.log('');
console.log('No value was printed.');