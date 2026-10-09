/**
 * Assemble the voiceover onto the film's timeline.
 *
 * Every line is delayed to its beat in `analysis/voiceover.ts` and mixed, so the
 * narration lands where the picture cuts rather than wherever the speech
 * happened to end. Durations are measured from the generated files with ffprobe,
 * not estimated from the mime type: the TTS endpoint returns raw PCM for some
 * lines and WAV for others, so a size-based estimate is only right half the time.
 *
 * Line level is lowered because a voice sitting on top of a music bed at unity
 * gains would sound like a voiceover pasted over a film rather than mixed into
 * one. The bed is built separately in music.mjs and brought up underneath.
 *
 *   node analysis/voiceover/assemble.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const AUDIO = path.join(here, 'audio');
const FILM_SECONDS = 100;
const FPS = 30;
const SAMPLE_RATE = 48000;

const manifest = JSON.parse(fs.readFileSync(path.join(here, 'voiceover-manifest.json'), 'utf8'));

function ffprobeDuration(file) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
      { encoding: 'utf8' },
    ).trim();
    const v = Number(out);
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    /* raw PCM has no container, so it falls through to the size estimate */
  }
  return fs.statSync(file).size / 2 / 24000;
}

const lines = manifest
  .map((l) => {
    const file = path.join(AUDIO, l.file);
    return { ...l, file, startSec: l.at / FPS, duration: ffprobeDuration(file) };
  })
  .filter((l) => fs.existsSync(l.file))
  .sort((a, b) => a.startSec - b.startSec);

console.log(`lines ${lines.length}`);
let speech = 0;
for (const l of lines) {
  const end = l.startSec + l.duration;
  const over = end > FILM_SECONDS;
  console.log(
    `  ${String(l.at).padStart(4)}f ${l.startSec.toFixed(2).padStart(6)}s  ${l.duration.toFixed(2)}s  ends ${end.toFixed(2)}s${over ? '  <- PAST FILM END' : ''}`,
  );
  speech += l.duration;
}
console.log(`\nspeech ${speech.toFixed(1)}s of ${FILM_SECONDS}s, ${((speech / FILM_SECONDS) * 100).toFixed(0)}% density`);

/* ---------- build each line as a positioned stem ---------- */

const stems = [];
for (const [i, l] of lines.entries()) {
  const delayMs = Math.round(l.startSec * 1000);
  const stem = path.join(AUDIO, `stem-${String(i).padStart(2, '0')}.wav`);
  // adelay is per-channel; the input is mono so one value is enough.
  execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', l.file,
     '-af', `adelay=${delayMs}|${delayMs}`,
     '-ar', String(SAMPLE_RATE), '-ac', '1', stem],
  );
  stems.push(stem);
}

/* ---------- mix down ---------- */

const out = path.join(here, 'voiceover.wav');
execFileSync(
  'ffmpeg',
  ['-hide_banner', '-loglevel', 'error', '-y',
   ...stems.flatMap((s) => ['-i', s]),
   '-filter_complex',
   // amix normalize=0 keeps each stem at its own level; a peak limiter then
   // catches the moments where two lines are close enough to sum past 0dBFS.
   `${stems.map((_, i) => `[${i}]`).join('')}amix=inputs=${stems.length}:normalize=0,alimiter=limit=0.95,aresample=${SAMPLE_RATE}[out]`,
   '-map', '[out]',
   '-t', String(FILM_SECONDS),
   out],
);

const size = Math.round(fs.statSync(out).size / 1024);
console.log(`\nwrote ${out}  ${size}KB`);
console.log(`${FILM_SECONDS}s, ${SAMPLE_RATE}Hz mono`);