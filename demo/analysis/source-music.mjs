/**
 * Source a CC0 music bed as an alternative to the synthesised one.
 *
 * This exists because synthesising is not automatically the right answer. It is
 * the right answer when it works and it is also a way of avoiding the harder
 * problem of choosing a track on its merits. Both options should exist, mixed
 * the same way, so the choice is made by listening rather than by default.
 *
 * Licensing is checked before anything is downloaded, not after. ccMixter
 * carries BY, BY-NC, SA and ND tracks alongside genuine CC0, and the site itself
 * is BY-NC — so a plausible-looking result is not evidence of anything. A track
 * is only accepted if the API reports the CC0 deed URL, and the verdict is
 * recorded in sourced-licences.json next to the audio. That file is the
 * provenance: it says which tracks were considered, what licence each carried,
 * and why the rejected ones were rejected.
 *
 *   node analysis/source-music.mjs            # fetch candidates
 *   node analysis/source-music.mjs --mix BED  # also build the mix
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'music', 'sourced');
fs.mkdirSync(OUT, { recursive: true });

const FILM_SECONDS = 100;
const SR = 48000;

/** The only licence accepted. Everything else is recorded and skipped. */
const CC0 = 'creativecommons.org/publicdomain/zero/1.0';

/**
 * Ambient and restrained: the film is documentary, not a trailer. `instrumental`
 * is required so no vocal competes with the narration, and `bpm` near the
 * reference tempo keeps the pulse from fighting the cuts.
 */
const QUERIES = [
  { tags: 'ambient', label: 'ambient' },
  { tags: 'instrumental', label: 'instrumental' },
  { tags: 'ambient+instrumental', label: 'ambient instrumental' },
  { tags: 'piano+ambient', label: 'piano ambient' },
  { tags: 'downtempo', label: 'downtempo' },
];

/** Shortlisting cap: enough to choose from, not a library dump. */
const SHORTLIST = 8;

const API = 'https://ccmixter.org/api/query';

/**
 * `dataview=info` silently truncates to a single record in URL context, so it
 * cannot be used to find candidates — it will happily return one track and let
 * you conclude there is only one. `dataview=links` pages properly, so that is
 * used to list candidates and each one is then hydrated individually.
 *
 * This is recorded because the failure is invisible: the response is a valid
 * array, the status is 200, and the only symptom is a shortlist of one.
 */
async function listCandidates(params) {
  const url = `${API}?${new URLSearchParams({
    f: 'json',
    dataview: 'links',
    lic: 'pd',
    limit: '15',
    sort: 'score',
    ord: 'DESC',
    ...params,
  })}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Referer: 'https://ccmixter.org/' },
  });
  if (!res.ok) throw new Error(`query ${params.tags} -> ${res.status}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).filter((r) => r.upload_id ?? r.file_page_url);
}

/** The upload id from either shape of record. */
const idOf = (r) => r.upload_id ?? Number(r.file_page_url?.match(/\/(\d+)$/)?.[1]);

/** One record with full licence, BPM and file detail. */
async function hydrate(id) {
  const url = `${API}?${new URLSearchParams({ f: 'json', dataview: 'info', ids: String(id) })}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Referer: 'https://ccmixter.org/' },
  });
  if (!res.ok) throw new Error(`hydrate ${id} -> ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function verdict(record) {
  const url = record?.license_url ?? '';
  if (!url.includes(CC0)) {
    return { ok: false, why: `licence is ${record?.license_name ?? 'unstated'} (${url || 'no url'})` };
  }
  if (!/cczero/i.test(record?.upload_extra?.systags ?? record?.upload_tags ?? '')) {
    // Belt and braces: the deed URL and the systag should agree. If they do not,
    // something about the record is not what it appears.
    return { ok: false, why: `deed URL says CC0 but systags do not carry cczero` };
  }
  const bpm = record.upload_extra?.bpm ?? null;
  return { ok: true, bpm, artist: record.user_real_name, title: record.upload_name };
}

/** The largest file on the record: the finished mix, not a stem or a sample. */
function mainFile(record) {
  const files = (record.files ?? []).filter((f) => /audio|mpeg/i.test(f.file_format_info?.mime_type ?? ''));
  const finished = files.filter((f) => !/sample|rough/i.test(f.file_extra?.type ?? ''));
  const pool = finished.length ? finished : files;
  return pool.sort((a, b) => (b.file_rawsize ?? 0) - (a.file_rawsize ?? 0))[0] ?? null;
}

console.log(`querying ccMixter for CC0 only\n`);

const considered = [];
const candidates = [];

/**
 * The API intermittently resets the connection, and a reset is not a verdict on
 * the query. Retrying is what separates "this tag has no CC0 tracks" from "the
 * network hiccuped", and the distinction matters when the output is a licence
 * decision.
 */
async function withRetry(fn, label, attempts = 4) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, 1200 * i));
    }
  }
  throw last;
}

const seen = new Set();

for (const q of QUERIES) {
  let rows = [];
  try {
    rows = await withRetry(() => listCandidates({ tags: q.tags }), q.label);
  } catch (err) {
    console.log(`  ${q.label.padEnd(22)} query failed after retries: ${err.message}`);
    continue;
  }
  console.log(`  ${q.label.padEnd(22)} ${rows.length} listed`);

  let kept = 0;
  for (const stub of rows) {
    const id = idOf(stub);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    // Hydrate one at a time: this is the call that returns the licence, and the
    // licence is the whole reason for the exercise.
    let record;
    try {
      record = await withRetry(() => hydrate(id), q.label);
    } catch {
      continue;
    }
    if (!record) continue;

    const file = mainFile(record);
    const v = verdict(record);
    const entry = {
      query: q.label,
      title: record.upload_name,
      artist: record.user_real_name,
      licence: record.license_name,
      licenceUrl: record.license_url,
      page: record.file_page_url,
      bpm: v.bpm ?? null,
      duration: file?.file_format_info?.ps ?? null,
      file: file?.file_name ?? null,
      bytes: file?.file_rawsize ?? null,
      download: file?.download_url ?? null,
      accepted: v.ok,
      reason: v.ok ? 'CC0 confirmed' : v.why,
    };
    considered.push(entry);

    if (!v.ok) {
      console.log(`  ${q.label.padEnd(22)} drop  ${String(entry.title).slice(0, 30).padEnd(30)} ${v.why}`);
      continue;
    }
    if (!file?.download_url) {
      console.log(`  ${q.label.padEnd(22)} drop  ${String(entry.title).slice(0, 30).padEnd(30)} no downloadable audio`);
      continue;
    }
    if (candidates.length >= SHORTLIST) continue;
    candidates.push(entry);
    kept++;
    console.log(
      `  ${q.label.padEnd(22)} KEEP  ${String(entry.title).slice(0, 32).padEnd(32)} ${String(entry.bpm ?? '?').padStart(3)}bpm  ${entry.duration}`,
    );
  }
  console.log(`  ${q.label.padEnd(22)} ${kept} kept`);
}

console.log(`\n${candidates.length} CC0 candidates, ${considered.length} records considered`);

if (!candidates.length) {
  console.log('\nNothing to download. The synthesised bed stands.');
  fs.writeFileSync(
    path.join(here, 'sourced-licences.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), accepted: 0, considered }, null, 2),
  );
  process.exit(0);
}

/* ---------------------------------------------------------------- download */

fs.writeFileSync(
  path.join(here, 'sourced-licences.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), accepted: candidates.length, considered }, null, 2),
);

const downloaded = [];
for (const c of candidates) {
  const safe = `${c.artist}_${c.title}`.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
  const dest = path.join(OUT, `${safe}.mp3`);
  process.stdout.write(`  downloading ${safe}.mp3 ... `);
  try {
    // A Referer is required. Without it ccMixter's CDN returns 403 for every
    // download while the API itself answers normally, which reads exactly like
    // "these files are not available" and is not.
    const res = await fetch(c.download, {
      headers: { 'User-Agent': 'Mozilla/5.0 (vendra-demo/1.0)', Referer: 'https://ccmixter.org/' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100_000) throw new Error(`suspiciously small (${buf.length}b)`);
    fs.writeFileSync(dest, buf);
    downloaded.push({ ...c, local: path.basename(dest), size: buf.length });
    console.log(`${Math.round(buf.length / 1024 / 1024)}MB`);
  } catch (err) {
    console.log(`FAILED ${err.message}`);
  }
}

console.log(`\ndownloaded ${downloaded.length}/${candidates.length}`);
fs.writeFileSync(
  path.join(here, 'sourced-candidates.json'),
  JSON.stringify(downloaded, null, 2),
);
console.log(`wrote sourced-licences.json and sourced-candidates.json`);

/* ------------------------------------------------------------------- mix */

if (process.argv.includes('--mix') && downloaded.length) {
  /**
   * Each candidate is trimmed to the film length, faded at both ends, and
   * ducked under the voiceover from the measured manifest — the same treatment
   * the synthesised bed gets, so the two are comparable by ear rather than by
   * one being mixed properly and the other not.
   */
  const manifest = fs.existsSync(path.join(here, 'voiceover', 'voiceover-manifest.json'))
    ? JSON.parse(fs.readFileSync(path.join(here, 'voiceover', 'voiceover-manifest.json'), 'utf8'))
    : [];

  for (const d of downloaded) {
    const src = path.join(OUT, d.local);
    const out = path.join(OUT, d.local.replace(/\.mp3$/, '.wav'));

    const volume = d.bpm && d.bpm >= 95 ? '0.55' : d.bpm && d.bpm <= 70 ? '0.9' : '0.72';
    let filter = `volume=${volume},afade=t=in:st=0:d=2.5,afade=t=out:st=${FILM_SECONDS - 3}:d=3`;

    // Sidechain from the real measured line durations.
    const delays = manifest
      .map((l) => {
        const file = path.join(here, 'voiceover', 'audio', l.file);
        if (!fs.existsSync(file)) return null;
        const bytes = fs.statSync(file).size;
        const dur = l.seconds ?? bytes / 2 / 24000;
        const start = Math.round((l.at / 30) * 1000);
        return `between(t,${(start / 1000).toFixed(2)},${((start + dur * 1000) / 1000).toFixed(2)})`;
      })
      .filter(Boolean);

    if (delays.length) {
      const g = delays.join('+');
      // volume=enable with the duck expression, capped at 0.45 under speech.
      filter = `volume='0.45+0.55*(1-(${g}))',${filter}`;
    }

    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', src,
      '-af', `${filter},aresample=${SR}`,
      '-t', String(FILM_SECONDS),
      '-ac', '1', out,
    ]);
    console.log(`  mixed ${path.basename(out)}`);
  }
  console.log(`\nEach candidate is now a 100s ducked bed in music/sourced/`);
  console.log('Listen, choose one, then:');
  console.log('  ffmpeg -i music/sourced/<chosen>.wav -i analysis/voiceover/voiceover.wav \\');
  console.log('    -filter_complex "[0:a]volume=0.85[b];[1:a]volume=1.3[v];[b][v]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]" \\');
  console.log('    -map "[a]" -t 100 -ar 48000 -ac 1 public/mix.wav');
}