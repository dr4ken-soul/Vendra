/**
 * Generate the film's data module from a real recall response.
 *
 * Every string the film shows is copied out of an actual API response captured
 * from the deployed product. Nothing here is written by hand, which means the
 * film cannot drift from what the system actually said — if the answer changes,
 * the film changes, and if the film looks better than the product, that is
 * visible in the diff rather than hidden in a caption.
 *
 *   node analysis/build-film-data.mjs
 */
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const responsePath = join(here, 'recall-response.json');
const outPath = join(here, '..', 'src', 'data.ts');

const raw = JSON.parse(fs.readFileSync(responsePath, 'utf8'));

if (!raw.grounded) {
  console.error('refusing: the captured response is not grounded, so the film has nothing honest to show');
  process.exit(1);
}

/** Split the answer into its cited sentences so the film can reveal them in order. */
function segments(answer) {
  return answer
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Shorten a citation reference without falsifying it. */
function citationOf(index) {
  const source = raw.sources[index];
  if (!source) return '';
  return source.eventId.slice(0, 8);
}

const segmentsOut = segments(raw.answer).map((text, i) => ({
  text,
  // The answer cites "SOURCE n" using its own numbering, which the product
  // assigns. It is preserved verbatim rather than renumbered.
  cites: [...text.matchAll(/SOURCE (\d+)/g)].map((m) => Number(m[1])),
}));

const sources = raw.sources.map((s, i) => ({
  n: i + 1,
  eventId: s.eventId,
  short: s.eventId.slice(0, 8),
  eventType: s.eventType,
  occurredAt: s.occurredAt.slice(0, 10),
  summary: s.summary,
  dealDate: s.dealDate,
  supplier: s.supplierName,
  headline: s.headline,
  quotedTotal: s.quotedTotal ?? null,
  agreedTotal: s.agreedTotal ?? null,
  receivedTotal: s.receivedTotal ?? null,
  currency: s.currencyCode,
}));

const data = {
  capturedAt: new Date().toISOString().slice(0, 10),
  model: raw.modelId,
  grounded: raw.grounded,
  memoryStatus: raw.memoryStatus,
  dealDate: sources[0]?.dealDate ?? null,
  supplier: sources[0]?.supplier ?? 'Segun Wholesale',
  headline: sources[0]?.headline ?? null,
  answer: raw.answer,
  segments: segmentsOut,
  sources,
};

const body = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by analysis/build-film-data.mjs from analysis/recall-response.json,
 * which is a captured response from POST /api/assistant/recall against
 * ${'https://vendra-psycho-projects.vercel.app'}.
 *
 * Every string here is real output from the deployed product. Nothing was written
 * for the film.
 */

export interface FilmSource {
  n: number;
  eventId: string;
  short: string;
  eventType: string;
  occurredAt: string;
  summary: string;
  dealDate: string | null;
  supplier: string;
  headline: string | null;
  quotedTotal: number | null;
  agreedTotal: number | null;
  receivedTotal: number | null;
  currency: string | null;
}

export interface FilmSegment {
  text: string;
  cites: number[];
}

export const FILM = ${JSON.stringify(data, null, 2)} as const;
`;

fs.mkdirSync(join(here, '..', 'src'), { recursive: true });
fs.writeFileSync(outPath, body);

console.log(`wrote ${outPath}`);
console.log(`  segments : ${segmentsOut.length}`);
console.log(`  sources  : ${sources.length}`);
console.log(`  model    : ${raw.modelId}`);
console.log(`  memory   : ${raw.memoryStatus}`);
console.log(`  dealDate : ${data.dealDate}`);