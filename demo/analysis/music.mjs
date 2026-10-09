/**
 * The music bed, synthesised rather than sourced.
 *
 * Licensing is the reason. A track pulled from a library is either CC-BY, which
 * obliges the submission to carry an attribution the film has no room for, or
 * CC0, which is rarer than it looks and often comes from a catalogue rather than
 * a specific track. Generating it removes the question entirely and is verifiable:
 * this file is the provenance.
 *
 * It also buys something sampling could not. The bed's structure is the film's
 * own structure — it drops out during the gap beat, which is the one frame the
 * direction calls the emptiest — and it is locked to the tempo the references
 * measured, so the pulse and the cuts are the same clock.
 *
 * Tempo: 82 BPM, taken from the Ebbryn reference, which is the reference this
 * film follows. Measured at 80.7; rounded to a whole tempo because a bed built on
 * a measured 80.7 drifts against any grid it is later checked against.
 *
 *   beat 0.7317s   bar 2.9270s   100s is 34.16 bars
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'music');
fs.mkdirSync(OUT, { recursive: true });

const SR = 48000;
const SECONDS = 100;
const BPM = 82;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const N = SR * SECONDS;

const n = new Float32Array(N);

/** Deterministic noise, so two runs produce an identical file. */
let seed = 20261009;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};

/* ---------------------------------------------------------------- pitch set */

/**
 * A minor-pentatonic bed. The film's register is restrained and documentary, and
 * pentatonic avoids the intervals that make a loop sound like a jingle.
 */
const ROOT = 146.83; // D3
const scale = [1, 1.2, 1.5, 1.8, 2, 2.4]; // minor pentatonic across two octaves
const hz = (mul) => ROOT * mul;

/* ------------------------------------------------------------------ the pad */

const padVoices = [hz(1), hz(1.2), hz(1.5)];

/**
 * A sustained pad under the whole piece.
 *
 * It never rests completely, because a bed that stops is a bed that announces
 * itself stopping. Instead it ducks through the gap and comes back, which the
 * film asks for as an absence rather than an event.
 */
for (let i = 0; i < N; i++) {
  const t = i / SR;

  // Section weighting, matching the film's beats.
  const inGap = t >= 48 && t < 58;
  const late = t >= 94;
  let level = inGap ? 0.16 : late ? 0.5 : 1;

  // Slow breathing so the pad never sits perfectly still.
  level *= 0.85 + 0.15 * Math.sin((2 * Math.PI * t) / 19.2);

  for (const [v, f] of padVoices.entries()) {
    const detune = 1 + (v - 1) * 0.0016;
    // Two partials per voice: a fundamental and a quiet octave.
    const s =
      Math.sin(2 * Math.PI * f * detune * t) * 0.7 +
      Math.sin(2 * Math.PI * f * 2 * detune * t + 0.6) * 0.16;
    n[i] += s * 0.05 * level / padVoices.length;
  }
}

/* ------------------------------------------------------------- the pulse */

/**
 * A soft filtered-noise pulse on the beat.
 *
 * The references pace a structural event every 0.7 to 0.9 seconds, and this
 * pulse is that same clock made audible. Downbeats are accented, which is what
 * gives the bed a bar structure without a drum kit.
 */
for (let b = 0; b * BEAT < SECONDS; b++) {
  const start = Math.floor(b * BEAT * SR);
  const isDownbeat = b % 4 === 0;
  const t0 = (b * BEAT) % 8;

  for (let i = 0; i < SR * 0.5 && start + i < N; i++) {
    const t = i / SR;
    const env = Math.exp(-t * (isDownbeat ? 16 : 26));
    const body = Math.sin(2 * Math.PI * (isDownbeat ? 88 : 132) * t) * 0.5;
    const noise = rand() * 0.5;
    n[start + i] += (body + noise) * env * (isDownbeat ? 0.16 : 0.07);
  }

  // Occasional high shimmer on the second beat of a bar, sparse enough to read
  // as texture rather than as a pattern the viewer can count.
  if (isDownbeat && Math.floor(t0) % 4 === 0) {
    const s = start + Math.floor(BEAT * SR);
    for (let i = 0; i < SR * 0.35 && s + i < N; i++) {
      const t = i / SR;
      n[s + i] += Math.sin(2 * Math.PI * hz(scale[3]) * t) * Math.exp(-t * 12) * 0.05;
    }
  }
}

/* --------------------------------------------------------------- the duck */

/**
 * Sidechain the bed under the voiceover.
 *
 * A continuous bed under speech is the single most common reason a demo sounds
 * amateur. Rather than hand-mixing levels, the bed is attenuated wherever a line
 * plays, which is derived from the measured voiceover manifest rather than from
 * an estimate of when speech "probably" happens.
 */
const manifestPath = path.join(here, 'voiceover', 'voiceover-manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
const FPS = 30;
let ducked = 0;

for (const line of manifest) {
  const file = path.join(here, 'voiceover', 'audio', line.file);
  if (!fs.existsSync(file)) continue;
  const dur = line.seconds ?? fs.statSync(file).size / 2 / 24000;
  const start = Math.floor(line.at / FPS * SR);
  const attack = Math.floor(SR * 0.35);
  const release = Math.floor(SR * 0.6);
  for (let i = -attack; i < Math.ceil(dur * SR) + release && start + i < N; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= N) continue;
    let g = 1;
    if (i < 0) g = 1 + i / attack;
    else if (i > dur * SR) g = Math.max(0, 1 - (i - dur * SR) / release);
    // Down to 45% under speech, which is a duck the ear reads as space.
    n[idx] *= 1 - 0.55 * g;
    ducked++;
  }
}

/* ------------------------------------------------------------ normalise */

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(n[i]));
const gain = peak > 0 ? 0.72 / peak : 1;
for (let i = 0; i < N; i++) n[i] *= gain;

/* ------------------------------------------------------------ write WAV */

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + N * 2, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(N * 2, 40);

const body = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, n[i]));
  body.writeInt16LE(Math.round(v * 32767), i * 2);
}

const file = path.join(OUT, 'bed.wav');
fs.writeFileSync(file, Buffer.concat([header, body]));

console.log(`tempo    ${BPM} BPM  (beat ${BEAT.toFixed(4)}s, bar ${BAR.toFixed(4)}s)`);
console.log(`length   ${SECONDS}s, ${(SECONDS / BAR).toFixed(2)} bars`);
console.log(`lines ducked under  ${manifest.length}`);
console.log(`wrote    ${file}  ${Math.round(fs.statSync(file).size / 1024)}KB`);
console.log(`\nThis is the provenance. The bed is synthesised from this file, so the`);
console.log('submission carries no third-party music licence.');