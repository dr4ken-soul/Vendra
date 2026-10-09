# Audio and capture: what was actually done

## Real screen capture

`analysis/capture-screens.mjs` drives headless Chromium against
`vendra-psycho-projects.vercel.app`, signs in through the real form, and captures
five screens including the live Ask Vendra answer with its seven sources.

The interactive browser tooling was unreliable, which is why the first version
re-rendered the interface. That was the wrong answer to give: the fix was a
scriptable browser, not a smaller ambition.

Four bugs, all of which produced frames that looked like successful captures:

- `networkidle` fires while the page is still rendering skeletons, so the frame
  captured is a half-loaded page. Waiting for text that can only appear once real
  data has arrived is what makes a screenshot evidence of anything.
- A plain `a[href^="/app/deals/"]` selector matches `/app/deals/new` first.
- The script called `path.join` while only importing `join`. The `ReferenceError`
  was swallowed by a bare `catch`, so the run continued with no deal id and wrote
  a frame of nothing.
- **The captured frame was an empty capture form while the film's caption claimed
  real figures.** The route `/app/deals/:dealId` was a verbatim copy of
  `/app/deals/new`. The film would have shipped a claim over an empty form.

That last one is now a product fix, not just a capture fix. The capture refuses
to write the frame unless it is on the deal route and not the capture form.

## Voiceover

`analysis/voiceover.ts` holds the script, written against measurement rather
than taste. Nielsen Norman Group found objective language **+27%** on usability
over promotional copy, concise writing **+58%**, and all three together **+124%**,
on identical content. They also found readers detested "marketese".

So the script states what is on screen, uses numbers instead of adjectives
("seven sources", never "grounded"), claims only what the evidence carries, and
names no limitation the product does not actually have. 93 words, 37% density.

Generated with `gemini-3.8-flash-tts`, the same family as the project's text
model, using the Charon voice because the film is restrained and documentary and
an upbeat delivery would sell something the evidence does not support.

Generated per line, not as one pass. The first run hit a 429 after four lines, so
the generator backs off and resumes from generated files rather than re-spending
quota.

## Music — both, so the choice is made by listening

Synthesising is not automatically right. It is right when it works, and it is
also a way of avoiding the harder problem of choosing a track on its merits. So
both options exist, mixed identically, and the choice is made by ear.

### Option A — synthesised (`analysis/music.mjs`)

82 BPM, taken from the Ebbryn reference this film follows. A pentatonic pad, a
beat pulse with downbeat accents, and a **sidechain duck derived from the
measured duration of every narration line** rather than from an estimate of when
speech happens. Dropping out through the gap beat, because that is where the film
drops out. The generator *is* the provenance.

### Option B — sourced CC0 (`analysis/source-music.mjs`)

Queries ccMixter's API and accepts a track only if the API reports the CC0 deed
URL (`creativecommons.org/publicdomain/zero/1.0`) **and** the record's systags
carry `cczero`. Both must agree. ccMixter also carries BY, BY-NC, SA and ND
tracks and the site itself is BY-NC, so a plausible-looking result is not
evidence of a licence.

`sourced-licences.json` records every record considered, its licence, and why
rejected ones were dropped. That file is the provenance.

Four things about ccMixter that cost time and are worth knowing:

| Thing | What happens | Why it is dangerous |
|---|---|---|
| No `Referer` header | Every audio download returns 403 | Reads exactly like "these files are unavailable" |
| `dataview=info` in URL context | Silently truncates to **one** record | A valid 200, a valid array, a shortlist of one |
| `dataview=links` | Pages correctly | Use this to list, hydrate each by id |
| Connection resets | Intermittent `fetch failed` | Retrying separates "no CC0 tracks" from "the network hiccuped" |

### Mixing either one

Same treatment, so they are comparable by ear rather than one being mixed
properly and the other not. Each candidate is trimmed to 100s, faded at both
ends, level-matched to its tempo, and ducked under the measured narration.

```bash
node analysis/source-music.mjs --mix          # fetch, verify, download, build beds
# listen to demo/music/sourced/*.wav and demo/music/bed.wav
ffmpeg -i music/sourced/<chosen>.wav -i analysis/voiceover/voiceover.wav \
  -filter_complex "[0:a]volume=0.85[b];[1:a]volume=1.3[v];[b][v]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]" \
  -map "[a]" -t 100 -ar 48000 -ac 1 public/mix.wav
npx remotion render src/index.ts VendraFilm out/vendra-demo.mp4 --codec=h264 --crf=18 --audio-codec=aac
```

## What is still true

- The film shows **one shop**, recorded by the founder, and is not evidence of
  three users.
- A retailer cannot backdate an event, so the film claims the deal date, which is
  real, and does not claim "recorded days ago".