/**
 * Verify the X posts are exactly 280 characters.
 *
 * The brief requires exactly 280, and "close enough" is how a post silently fails
 * to post. Counted the way X counts: Unicode code points, not UTF-16 units and
 * not bytes, so an em dash does not shift the number.
 *
 * Every post ends with the required suffix, so what actually has to be tuned is
 * the body. The script reports the body length against its budget rather than
 * making that subtraction a guess.
 *
 *   node analysis/count-x.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TARGET = 280;
// The bodies already end with @WalrusProtocol, so only the hashtag is appended
// at post time. Counting the handle here as well would budget 30 characters for
// text that is already in the body, and every post would be tuned 15 too long.
const SUFFIX = ' #WalrusMemory';

// One level up: the posts are demo content, the counter is a demo tool.
const raw = fs.readFileSync(path.join(here, '..', 'x-posts.txt'), 'utf8');

const blocks = raw
  .split(/^---$/m)
  .map((b) => b.trim())
  .filter(Boolean);

const len = (s) => [...s].length;
const bodyBudget = TARGET - len(SUFFIX);

let allPass = true;

console.log(`target ${TARGET} · suffix ${len(SUFFIX)} · body budget ${bodyBudget}\n`);

blocks.forEach((block, i) => {
  const lines = block.split('\n');
  const label = lines[0].replace(/^#\s*/, '');
  const body = lines.slice(1).join('\n').trim();

  // The suffix is appended at post time, so the body is what gets measured here.
  const total = len(body) + len(SUFFIX);
  const delta = total - TARGET;
  const ok = delta === 0;
  if (!ok) allPass = false;

  console.log(
    `post ${i + 1}: body ${String(len(body)).padStart(3)} (${ok ? 'exact' : `${delta > 0 ? '+' : ''}${delta}`})  ${label}`,
  );

  if (!ok) {
    console.log(`         ${Math.abs(delta)} ${delta > 0 ? 'fewer' : 'more'} characters needed`);
  }
  if (!body.includes('@WalrusProtocol')) console.log('         MISSING @WalrusProtocol');
  if (!body.includes('#WalrusMemory')) console.log('         MISSING #WalrusMemory');
});

console.log(`\n${allPass ? `all posts exactly ${TARGET} characters` : 'not yet at target'}`);