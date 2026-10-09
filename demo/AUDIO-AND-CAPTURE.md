# Audio and capture: what was actually done

Both gaps in the film's first version are closed. Neither was closed by accepting
a limitation.

## Real screen capture

`analysis/capture-screens.mjs` drives headless Chromium against
`vendra-psycho-projects.vercel.app`, signs in through the real form, and captures
five screens including the live Ask Vendra answer with its seven sources.

The browser tooling used interactively was unreliable, which is why the first
version re-rendered the interface. That was the wrong answer to give: the fix was
a scriptable browser, not a smaller ambition.

Two capture bugs worth recording:

- `networkidle` fires while the page is still rendering skeletons, so the frame
  captured is a half-loaded page that looks like a successful screenshot. The fix
  is to wait for text that can only appear once real data has arrived.
- A plain `a[href^="/app/deals/"]` selector matches `/app/deals/new` first and
  navigates to the capture form. Real deal links carry a UUID.

## Voiceover

`analysis/voiceover.ts` holds the script. It was written against measured guidance
rather than taste — Nielsen Norman Group found objective language **+27%** on
usability over promotional copy, concise writing **+58%**, and all three together
**+124%**, on identical content. They also found readers detested "marketese".

So the script states what is on screen, uses numbers instead of adjectives
("seven sources", never "grounded"), claims only what the evidence carries, and
names no limitation the product does not actually have. 93 words, 37% density.

Generated with `gemini-3.8-flash-tts`, the same family as the project's text
model, using the Charon voice because the film is restrained and documentary and an
upbeat delivery would sell something the evidence does not support.

Generated per line, not as one pass. The first run hit a 429 after four lines, so
the generator backs off and resumes from generated files rather than re-spending
quota.

## Music

Synthesised, not sourced. A library track is CC-BY with an attribution a
hackathon video has no room for, or CC0 which is rarer than it looks; a
subscription seat covers an edit, not redistribution; and the reference films' own
audio is someone else's composition. Synthesising removes the question — the
generator *is* the provenance — and buys two things sampling could not: the bed is
locked to a measured tempo and its structure follows the film's, dropping out
through the gap beat.

`analysis/music.mjs`: 82 BPM, taken from the Ebbryn reference this film follows.
A pentatonic pad, a beat pulse with downbeat accents, and a **sidechain duck
derived from the measured duration of every narration line** rather than from an
estimate of when speech happens. The waveform confirms the duck is audible.

## What is still true

- The film shows **one shop**, recorded by the founder, and is not evidence of
  three users.
- A retailer cannot backdate an event, so the film claims the deal date, which is
  real, and does not claim "recorded days ago".