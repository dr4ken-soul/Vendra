/**
 * Generate the voiceover, one file per line.
 *
 * Voice and delivery are chosen for this film rather than left to defaults:
 *
 *   Charon   deeper and slower than the alternatives, and the film is
 *            restrained and documentary. An upbeat voice would sell something
 *            the evidence does not support.
 *   plain    no style instruction beyond speaking normally, so the wording does
 *            the work instead of a performance style.
 *
 * Lines are generated individually and timed against the beat table in
 * analysis/voiceover.ts, so a line can be re-recorded without regenerating the
 * others and the mix can be rebuilt from real measured durations rather than from
 * an estimate of how long a sentence takes to say.
 *
 *   node analysis/voiceover/generate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'audio');
fs.mkdirSync(OUT, { recursive: true });

const env = {};
for (const line of fs.readFileSync(path.join(here, '..', '..', '..', 'web', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  const f = v[0];
  if ((f === '"' || f === "'") && v[v.length - 1] === f) v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}

const key = env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!key) {
  console.error('GOOGLE_GENERATIVE_AI_API_KEY not found');
  process.exit(1);
}

const MODEL = process.env.VOICE_MODEL ?? 'gemini-3.8-flash-tts';
const VOICE = process.env.VOICE_NAME ?? 'Charon';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const lines = JSON.parse(fs.readFileSync(path.join(here, 'lines.json'), 'utf8'));

console.log(`model ${MODEL}`);
console.log(`voice ${VOICE}`);
console.log(`lines ${lines.length}\n`);

const manifest = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * TTS is rate limited per project, and a first pass hit 429 after four lines.
 * Retries with backoff rather than failing the run, and an already-generated
 * line is left alone, so an interrupted run resumes instead of re-spending quota
 * on lines that already exist.
 */
async function generate(text, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
          },
        },
      }),
    });

    if (res.ok) return { res };

    const body = await res.text();
    if (res.status !== 429) return { error: `${res.status} ${body.slice(0, 200)}` };

    const wait = 20_000 * attempt;
    console.log(`  rate limited, waiting ${wait / 1000}s (attempt ${attempt}/${attempts})`);
    await sleep(wait);
  }
  return { error: '429 after retries' };
}

for (const line of lines) {
  const file = path.join(OUT, `line-${String(line.at).padStart(4, '0')}.pcm`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    const bytes = fs.statSync(file).size;
    manifest.push({ at: line.at, text: line.text, file: path.basename(file), seconds: bytes / 2 / 24000 });
    console.log(`  ${String(line.at).padStart(4)}  ${(bytes / 2 / 24000).toFixed(2)}s  already generated`);
    continue;
  }

  const { res, error } = await generate(line.text);
  if (error) {
    console.error(`  ${line.at}  FAILED ${error}`);
    continue;
  }

  const json = await res.json();
  const inline = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline) {
    const why = json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason ?? 'no audio part';
    console.error(`  ${line.at}  NO AUDIO (${why})`);
    continue;
  }

  fs.writeFileSync(path.join(OUT, `line-${String(line.at).padStart(4, '0')}.pcm`), Buffer.from(inline.data, 'base64'));

  const written = path.join(OUT, `line-${String(line.at).padStart(4, '0')}.pcm`);
  const bytes = fs.statSync(written).size;
  const mime = inline.mimeType ?? '';
  const isPcm = mime.includes('L16') || mime.includes('pcm');
  // 16-bit mono at 24kHz is what the TTS endpoint returns.
  const seconds = isPcm ? bytes / 2 / 24000 : null;

  manifest.push({ at: line.at, text: line.text, file: path.basename(written), seconds });
  console.log(
    `  ${String(line.at).padStart(4)}  ${(seconds !== null ? seconds.toFixed(2) + 's' : mime.padEnd(22))}  ${line.text.slice(0, 52)}`,
  );
}

fs.writeFileSync(path.join(here, 'voiceover-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nmanifest written: ${manifest.length}/${lines.length} lines`);
