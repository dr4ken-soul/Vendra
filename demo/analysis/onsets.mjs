/**
 * Spectral-flux onset detection on a reference video's audio.
 *
 * The motion-design skill requires that structural cuts land on real transients,
 * and that the measured offset in frames be reported rather than assumed. It
 * explicitly warns that a stated assumption never measured costs rebuilds.
 *
 * Method:
 *   1. ffmpeg decodes to mono 16-bit PCM at a known rate.
 *   2. The signal is framed into overlapping windows and transformed with a
 *      real FFT.
 *   3. Spectral flux is the half-wave-rectified difference between consecutive
 *      magnitude spectra — energy that APPEARS, which is what an onset is, as
 *      opposed to loudness which is already measurable with volume().
 *   4. Peaks are picked with an adaptive threshold: a local mean over a window
 *      around each frame, scaled. A global threshold finds nothing on compressed
 *      audio and everything on a dense mix.
 *
 * Usage:
 *   node scripts/onsets.mjs <video> [--top 25] [--json]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'os';
import { join } from 'node:path';

const SAMPLE_RATE = 22050;
const FRAME_SIZE = 1024;
const HOP = 512;

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/onsets.mjs <video> [--top 25] [--json]');
  process.exit(1);
}

function argOf(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
}
const topN = Number(argOf('--top', 20));
const asJson = process.argv.includes('--json');

/* ---------- decode ---------- */

/**
 * ffmpeg is invoked without a shell.
 *
 * With `shell: true` the arguments are concatenated and re-parsed, so any path
 * containing a space — which every path in this library has, because the folder
 * is called "Motion Graphics" — arrives as two paths and the decode fails. This is
 * the same class of bug that shipped a half-configured Vercel project earlier.
 */
function ffmpegPath() {
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv) return fromEnv;
  if (process.platform === 'win32') {
    const glob = join(
      process.env.LOCALAPPDATA ?? '',
      'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'ffmpeg-9.0-full_build', 'bin', 'ffmpeg.exe',
    );
    if (existsSync(glob)) return glob;
  }
  return 'ffmpeg';
}

const dir = mkdtempSync(join(tmpdir(), 'onsets-'));
const wav = join(dir, 'a.raw');
const ff = ffmpegPath();

try {
  execFileSync(
    ff,
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', target,
     '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', wav],
    { maxBuffer: 1 << 30 },
  );
} catch (e) {
  console.error('ffmpeg decode failed:', e.stderr?.toString().split('\n').slice(0, 4).join('\n') || e.message);
  process.exit(1);
}

const raw = readFileSync(wav);
const n = Math.floor(raw.length / 2);
const x = new Float32Array(n);
for (let i = 0; i < n; i++) x[i] = raw.readInt16LE(i * 2) / 32768;

/* ---------- FFT (iterative radix-2) ---------- */

function fft(re, im) {
  const size = re.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= size; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

const hann = new Float32Array(FRAME_SIZE);
for (let i = 0; i < FRAME_SIZE; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1)));

const half = FRAME_SIZE / 2;
const frames = [];
for (let start = 0; start + FRAME_SIZE <= n; start += HOP) {
  const re = new Float32Array(FRAME_SIZE);
  const im = new Float32Array(FRAME_SIZE);
  for (let i = 0; i < FRAME_SIZE; i++) re[i] = x[start + i] * hann[i];
  fft(re, im);
  const mag = new Float32Array(half);
  for (let k = 0; k < half; k++) mag[k] = Math.hypot(re[k], im[k]);
  frames.push(mag);
}

/* ---------- spectral flux ---------- */

const flux = new Float32Array(frames.length);
let prev = frames[0];
for (let f = 1; f < frames.length; f++) {
  let sum = 0;
  const cur = frames[f];
  for (let k = 1; k < half; k++) {
    const d = cur[k] - prev[k];
    if (d > 0) sum += d;
  }
  flux[f] = sum;
  prev = cur;
}

const frameSeconds = HOP / SAMPLE_RATE;

/* ---------- adaptive peak picking ---------- */

const w = Math.max(3, Math.round((0.35 / frameSeconds)));
const peaks = [];
for (let f = w; f < flux.length - w; f++) {
  let mean = 0;
  for (let k = f - w; k <= f + w; k++) mean += flux[k];
  mean /= 2 * w + 1;
  let variance = 0;
  for (let k = f - w; k <= f + w; k++) variance += (flux[k] - mean) ** 2;
  const sd = Math.sqrt(variance / (2 * w + 1));
  const threshold = mean + 2.4 * sd;
  if (flux[f] > threshold && flux[f] >= flux[f - 1] && flux[f] > flux[f + 1]) {
    peaks.push({ frame: f, t: f * frameSeconds, strength: flux[f] });
  }
}

peaks.sort((a, b) => b.strength - a.strength);
const strongest = peaks.slice(0, topN).sort((a, b) => a.t - b.t);
rmSync(dir, { recursive: true, force: true });

const duration = n / SAMPLE_RATE;
const fps = 30;

/**
 * Tempo and pacing.
 *
 * The skill wants a BPM before any timing is designed, and wants cuts on bar
 * lines. Note what does NOT transfer: this is the *reference's* music, which will
 * not be reused. What transfers is pacing — how often the piece cuts, and how
 * long it holds — so that is what is reported here alongside the tempo.
 *
 * Tempo is the modal inter-onset interval, folded into a plausible musical range.
 */
function estimateTempo(sortedPeaks) {
  const bins = new Map();
  const lo = 60 / 180; // 180 BPM
  const hi = 60 / 60; //  60 BPM
  for (let i = 1; i < sortedPeaks.length; i++) {
    const ioi = sortedPeaks[i].t - sortedPeaks[i - 1].t;
    if (ioi < lo || ioi > hi) continue;
    const bpm = 60 / ioi;
    // Fold octaves so a half-time reading and a double-time reading agree.
    let folded = bpm;
    while (folded < 80) folded *= 2;
    while (folded > 170) folded /= 2;
    const key = Math.round(folded * 10) / 10;
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [bpm, count] of bins) {
    if (count > bestCount) {
      best = bpm;
      bestCount = count;
    }
  }
  return best;
}

const chronological = [...peaks].sort((a, b) => a.t - b.t);
const bpm = estimateTempo(chronological);

if (asJson) {
  console.log(JSON.stringify({
    duration,
    bpm,
    onsets: strongest.map((p) => ({ t: +p.t.toFixed(3), frame: p.frame })),
  }, null, 2));
} else {
  console.log(`file      ${target.split(/[\\/]/).pop()}`);
  console.log(`duration  ${duration.toFixed(2)}s`);
  console.log(`frames    ${frames.length} analysed at ${frameSeconds.toFixed(4)}s each`);
  console.log(`onsets    ${chronological.length} above threshold, showing the ${strongest.length} strongest`);
  console.log(`bpm       ${bpm ? bpm.toFixed(1) : 'no stable pulse detected'}`);
  console.log(`pacing    ${(chronological.length / (duration / 60)).toFixed(1)} onsets/min, ` +
              `mean gap ${(duration / Math.max(1, chronological.length)).toFixed(2)}s`);
  console.log(`          this is the reference's own audio and will not be reused\n`);
  console.log('  time      second     frame@30fps');
  for (const p of strongest) {
    console.log(`  ${p.t.toFixed(3).padStart(6)}s  ${Math.floor(p.t / 60)}:${(p.t % 60).toFixed(2).padStart(5, '0').padEnd(6)}  ${Math.round(p.t * fps)}`);
  }
}