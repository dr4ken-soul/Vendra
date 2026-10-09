/**
 * Emit the script as JSON for the voice generator.
 *
 * The script lives in voiceover.ts so it is readable and editable, and the
 * generator reads JSON so it does not need a TypeScript loader. This is the one
 * place the two are joined, so they cannot silently drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

const src = fs.readFileSync(path.join(here, 'voiceover.ts'), 'utf8');

/**
 * Parse the VOICEOVER array out of the source.
 *
 * Deliberately a narrow read rather than importing the module: the generator is a
 * plain .mjs script run outside the demo's tsconfig, and pulling a TS entry into
 * it for eleven strings would be more machinery than the strings are worth.
 */
const body = src.slice(src.indexOf('export const VOICEOVER'));
const entries = [];
const re = /\{\s*at:\s*(\d+),\s*text:\s*'((?:[^'\\]|\\.)*)',/g;
let m;
while ((m = re.exec(body)) !== null) {
  entries.push({ at: Number(m[1]), text: m[2].replace(/\\'/g, "'") });
}

if (entries.length === 0) {
  console.error('parsed 0 lines from voiceover.ts — the shape changed');
  process.exit(1);
}

fs.writeFileSync(path.join(here, 'voiceover', 'lines.json'), JSON.stringify(entries, null, 2));
console.log(`${entries.length} lines written`);

const words = entries.reduce((n, l) => n + l.text.trim().split(/\s+/).length, 0);
console.log(`${words} words total`);

// ~150 words per minute is a normal documentary read. This is a pacing check, not
// a measurement: it catches a script that is obviously too long for 100 seconds.
const at150 = (words / 150) * 60;
console.log(`at 150 wpm that is ${at150.toFixed(0)}s of speech in a 100s film`);