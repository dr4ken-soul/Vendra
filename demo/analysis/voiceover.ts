/**
 * The voiceover script.
 *
 * Written against measured guidance rather than taste.
 *
 * Nielsen Norman Group measured writing style against task performance and
 * found, on identical content:
 *
 *   promotional ("marketese")            baseline
 *   concise, ~half the word count         +58% usability
 *   scannable layout                      +47%
 *   objective language                    +27%
 *   all three combined                    +124%
 *
 * They also found readers "detested marketese" — boastful subjective claims —
 * and that objective language measurably reduced time, errors and memory load,
 * not just readability. That is the same audience as a hackathon judge reading a
 * demo: they are skimming under time pressure and they are specifically
 * looking for the thing that has been overclaimed.
 *
 * So: no adjectives doing the work, no "revolutionary", no "seamless", no claim
 * the evidence does not carry. Each line says what is on screen, and the screen
 * is the proof. Where a real limitation exists it is said, because a demo that
 * admits one thing is trusted about everything else.
 *
 * Timings are frame offsets from src/theme.ts, so a line cannot drift away from
 * the beat it belongs to.
 */

export interface Line {
  /** Frame in the composition where this line starts. */
  at: number;
  text: string;
  /** Why the line exists, for whoever edits it later. */
  note: string;
}

export const VOICEOVER: Line[] = [
  {
    at: 30,
    text: 'What did we agree?',
    note: 'The question, asked in the retailer\'s own words. No setup before it.',
  },
  {
    at: 480,
    text: 'Three weeks later, the answer is in a thread, a note, or memory.',
    note: 'Names the three places a real answer actually lives. Concrete, not abstract.',
  },
  {
    at: 900,
    text: 'Vendra records the deal once.',
    note: 'Shortest possible statement of the mechanism.',
  },
  {
    at: 1090,
    text: 'Six cartons of tomato paste. Quoted at eighteen thousand naira, agreed at seventeen and a half.',
    note: 'Real figures from the seeded deal. The numbers are the proof, not a claim about accuracy.',
  },
  {
    at: 1500,
    text: 'Later.',
    note: 'The gap. One word. The frame is almost empty and the line must be too.',
  },
  {
    at: 1620,
    text: 'Nothing was retyped.',
    note: 'States the product claim that is actually true and provable.',
  },
  {
    at: 1800,
    text: 'Ask it what was agreed, and what went wrong.',
    note: 'The question a retailer would actually type. Not a marketing sentence.',
  },
  {
    at: 1980,
    text: 'It answers with seven sources, each one a real event in the record.',
    note: 'Numbers again. "Grounded" would be an adjective; "seven sources" is a fact.',
  },
  {
    at: 2250,
    text: 'Four of six cartons arrived. Two were missing. The supplier credited three and a half thousand.',
    note: 'The actual answer, in the order it happened. No commentary over the top.',
  },
  {
    at: 2520,
    text: 'Every sentence names the event it came from.',
    note: 'The product\'s differentiator, stated as what the viewer can see.',
  },
  {
    at: 2880,
    text: 'You stop asking your memory.',
    note: 'The verdict, and the film\'s only line of argument. It is the claim the rest earned.',
  },
];

/** Words, for pacing checks against duration. */
export const WORD_COUNT = VOICEOVER.reduce(
  (n, l) => n + l.text.trim().split(/\s+/).length,
  0,
);