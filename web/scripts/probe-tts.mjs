/**
 * Can this project's Gemini key produce speech?
 *
 * A voiceover is only "premium" if the voice is good, and there is no point
 * writing a script that will be spoken by something that sounds like a 1990s
 * navigation system. So before any script is written, this checks what voices
 * are actually reachable, and prints the real model list rather than assuming a
 * TTS model exists.
 *
 *   node scripts/probe-tts.mjs
 */
import fs from 'node:fs';

const raw = fs.readFileSync('.env.local', 'utf8');
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  const f = v[0];
  if ((f === '"' || f === "'") && v[v.length - 1] === f) v = v.slice(1, -1);
  process.env[t.slice(0, i).trim()] = v;
}

const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const base = process.env.GOOGLE_API_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta';
if (!key) {
  console.error('GOOGLE_GENERATIVE_AI_API_KEY is not set.');
  process.exit(1);
}

console.log(`configured model : ${process.env.GOOGLE_MODEL_ID ?? '(unset)'}`);
console.log('');

const res = await fetch(`${base}/models?key=${key}&pageSize=200`);
if (!res.ok) {
  console.error(`model list failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
const { models = [] } = await res.json();

const tts = models.filter((m) => /tts|speech|audio|voice/i.test(`${m.name} ${m.supportedGenerationMethods?.join(' ')}`));
console.log(`models reachable : ${models.length}`);
console.log(`speech-capable   : ${tts.length}`);
console.log('');

for (const m of tts.slice(0, 12)) {
  console.log(`  ${m.name.replace('models/', '')}`);
  console.log(`    methods: ${(m.supportedGenerationMethods ?? []).join(', ')}`);
}

if (tts.length === 0) {
  console.log('No speech model is reachable with this key.');
  console.log('');
  console.log('Windows SAPI is the only local fallback and it is not usable for a');
  console.log('submission, so a voiceover would have to be recorded by a person.');
}