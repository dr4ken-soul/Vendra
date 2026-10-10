/**
 * Final proof of the X posts: assemble each one exactly as it will be pasted and
 * verify the pasted string, not the body.
 *
 * The body budget is easy to satisfy and the pasted result to get wrong — one
 * missing space before the hashtag turns a valid 280 into 279. This checks the
 * thing that actually gets posted.
 *
 *   node analysis/assemble-x.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(here, '..', 'x-posts.txt'), 'utf8');

const blocks = raw
  .split(/^---$/m)
  .map((b) => b.trim())
  .filter(Boolean);

let ok = true;

blocks.forEach((block, i) => {
  const lines = block.split('\n');
  const label = lines[0].replace(/^#\s*/, '');
  const body = lines.slice(1).join('\n').trim();

  // Exactly what gets pasted: body, then the required hashtag.
  const post = `${body} #WalrusMemory`;
  const n = [...post].length;
  const good = n === 280;

  if (!good) ok = false;

  console.log(`\n=== post ${i + 1} — ${label} — ${n} chars ${good ? 'EXACT' : 'WRONG'}`);
  console.log(post);
  if (!good) console.log(`  (needs ${280 - n > 0 ? '+' : ''}${280 - n})`);

  const tags = ['@WalrusProtocol', '#WalrusMemory'].filter((t) => post.includes(t));
  if (tags.length !== 2) {
    ok = false;
    console.log(`  MISSING TAGS: has ${tags.join(', ') || 'none'}`);
  }
});

console.log(`\n${ok ? 'ALL SIX POSTS READY: 280 characters, both tags present' : 'NOT READY'}`);