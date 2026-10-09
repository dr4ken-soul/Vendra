# Reference analysis — Mode A

Six reference videos in `C:\Users\Paul\Videos\Motion Graphics\Hackathon Demo`.
Per the skill's A2, numbers here are **measured from the files**. Visual
observations are **interpreted from contact sheets**, not observed in motion, and
are labelled as such.

## Measured — A1, items 1 and 11

| File | Duration | Resolution | fps | Video | Audio |
|---|---:|---:|---:|---|---|
| `nerom_…kibble…` | 56.0s | 1280×720 | 60 | h264 | aac |
| `JDollar_…entering_a_stock_trade…` | 109.5s | 1280×720 | ~24 | h264 | aac |
| `Roninxx_…How_to_make_a_demo_video…` | 146.2s | 1920×1080 | 30 | h264 | aac |
| `JDollar_…proof_of_exploit…` | 146.5s | 1280×720 | ~22 | h264 | aac |
| `MystiqueMide_…Ebbryn…` | 164.1s | 1920×1080 | 30 | h264 | aac |
| `JDollar_…we_built_Plinth…` | 210.3s | 1280×720 | 30 | h264 | aac |

Five of six sit in the 90–210s band the skill classifies as repeated
claim → evidence → verdict cycles.

Scene detection at threshold 0.2 found **zero hard cuts** in the 56s reference.
Not a detection failure: the contact sheet shows the same world in all twelve
sampled frames. Transitions are dissolves and state changes, never cuts.

## Measured — audio onset detection

`onsets.mjs` decodes the audio to mono PCM, transforms it with an FFT, and takes
spectral flux — half-wave-rectified frame-to-frame magnitude difference, which is
energy that *appears* — then picks peaks against an adaptive local threshold.

| File | Onsets | BPM (modal IOI, octave-folded) | Pacing |
|---|---:|---:|---|
| `Ebbryn` | 232 | 80.7 | 84.9 /min, mean gap 0.71s |
| `kibble` | 83 | 89.1 | 88.9 /min, mean gap 0.68s |
| `Plinth` | 234 | 107.7 | 66.8 /min, mean gap 0.90s |

**Pacing clusters tightly: a structural event every 0.7–0.9 seconds**, across
pieces of 56s, 164s and 210s. That is the number worth carrying — it says these
pieces never idle, and it holds across duration, which is not true of every
design.

**Tempo does not transfer.** These are three different tracks and none will be
reused. The BPM column is recorded because the skill asks for it to be measured
rather than assumed, not because 80.7 is a target.

## The library contains three opposite systems, not one

Contact sheets: `ref-kibble-contact-sheet.png`, `ref-plinth-sheet.png`,
`ref-ebbryn-sheet.png`.

**kibble — dark cinematic world.** Persistent illustrated night skyline and
starfield in every frame. Diegetic clock advancing `17:30:18 → 09:30:08` across
the story. Huge condensed hero claims left-aligned. One acid accent, well under
10% of pixels. Scrolling mono ticker along the bottom. Camera locked. Two colour
worlds: warm sunset bookends, deep night body.

**Plinth — light editorial, screenshot-led.** Near-white ground with dark panels
reserved for proof, code and agent output, so **ground alternation is a semantic
switch**. Real product screenshots framed as cards. Claim left, proof right.
Captions as mono chips on dark plates. Stat cards for numerals. Persistent
product nav bar as furniture.

**Ebbryn — real screen capture with claims over it.** This is the closest match to
Vendra's situation, by a distance.

- The imagery **is** the product, captured live, **cursor visible** doing the
  clicking. Nothing is illustrated or mocked.
- Hero claims are overlaid on the footage, left-aligned and tight:
  *"81,600.00 ready, 46,800.00 parked."*, *"This plan didn't pass."*
- Closed captions sit in black mono chips, so the piece reads muted.
- **It shows a failure on purpose.** "This plan didn't pass" is in the cut, not
  hidden. The brief demands honest limits and the reference meets it in the edit.
- Dark end card with wordmark and URL, held.

## Principle kept, property discarded — A3

| Principle (generalise) | Source-specific (do not reproduce) |
|---|---|
| A persistent layer in every frame makes a sequence a place | Any one reference's illustration |
| Ground change carries meaning — proof, code, failure | Their palette values |
| Narration as caption plates, legible muted | Their exact chip shapes |
| Numerals oversized with a mono label, repeated as a family | Their typefaces |
| Claim left, proof right, for detail-dense demos | Their copy |
| Show the failure in the cut | Their product names |
| Locked camera; a moving camera makes nothing feel important | Their colour accent |
| A real cursor proves the capture is real | Their wordmark |
| Structural event every 0.7–0.9s | Their music entirely |

## Recommendation for Vendra

**Follow Ebbryn, not Kibble.**

Vendra's demo will be real screen capture of a real product, which is exactly
Ebbryn's position. Copying its *structure* is legitimate and its cursor-visible
authenticity is an advantage for a memory product whose whole claim is that the
answers came from somewhere real.

Kibble's illustrated world is the wrong model: it would make the demo look like a
film about a product rather than the product.

Two adaptations, because Vendra has something Kibble had and Ebbryn did not:

**Diegetic time, taken from kibble.** Ebbryn has no clock because its story is
about now. Vendra's claim is about *across time* — a deal recorded days ago,
answered today. A real date stamp advancing across the piece is not decoration
here; it is the argument, and it is true because the dates are real.

**The ticker, taken from kibble.** Ebbryn's persistent element is a product nav
bar. Vendra's equivalent should carry **actual source citations** — the deal-event
references the product promises. That converts the most decorative slot in the
reference into the thing judges are actually looking for.

## Outstanding limits

- Three of six references are deconstructed; `entering_a_stock_trade`,
  `proof_of_exploit` and `Roninxx` are measured only.
- All visual claims are interpreted from stills. **Easing, stagger and transition
  behaviour remain unmeasured**, so motion vocabulary must not be described as
  matched.
- Onset detection ran on three of six; no audio analysis on the remainder.
- No reference audio will be reused, so the "cuts land on transients" requirement
  applies to Vendra's own music once chosen, not to these.