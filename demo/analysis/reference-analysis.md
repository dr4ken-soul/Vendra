# Reference analysis — Mode A

Six reference videos in `C:\Users\Paul\Videos\Motion Graphics\Hackathon Demo`.
Per the skill's A2, the numbers below are **measured from the files**, not
estimated. Visual observations are **interpreted from contact sheets at 5-second
intervals**, not from motion, and are labelled as such.

## Measured

| File | Duration | Resolution | fps | Video | Audio |
|---|---:|---:|---:|---|---|
| `nerom_…kibble…` | 56.0s | 1280×720 | 60 | h264 | aac |
| `JDollar_…entering_a_stock_trade…` | 109.5s | 1280×720 | ~24 | h264 | aac |
| `Roninxx_…How_to_make_a_demo_video…` | 146.2s | 1920×1080 | 30 | h264 | aac |
| `JDollar_…proof_of_exploit…` | 146.5s | 1280×720 | ~22 | h264 | aac |
| `MystiqueMide_…Ebbryn…` | 164.1s | 1920×1080 | 30 | h264 | aac |
| `JDollar_…we_built_Plinth…` | 210.3s | 1280×720 | 30 | h264 | aac |

Five of six sit in the 90–210s band, which the skill classifies as
**repeated claim → evidence → verdict cycles**. One is 56s, a compressed
narrative arc. None is under 30s.

Scene-change detection at threshold 0.2 found **zero hard cuts** in the 56s
reference. That is not a detection failure — the contact sheet shows the same
world in all twelve sampled frames. Transitions are dissolves and state changes,
not cuts. This is the single most transferable fact in the library.

## Interpreted from contact sheets — the 56s reference

Twelve frames at 5s intervals, tiled. Observed:

- **One persistent world in every frame.** A night skyline silhouette with a
  starfield, never leaving. The piece reads as a place, not a list.
- **Diegetic clock.** The top-left timestamp advances with the story:
  `17:30:18 → 18:55:39 → 19:46:49 → 20:00:58 → 03:10:11 → 05:02:15 →
  06:09:48 → 07:22:26 → 09:30:08`. Montage reads as chronology.
- **Three-tier hierarchy, every frame.** Eyebrow (tiny mono caps, dim) → hero
  claim (huge condensed sans, left-aligned) → meta (scrolling mono ticker along
  the bottom edge).
- **One acid accent per frame.** A single yellow-green used for emphasis words,
  well under 10% of pixels, never on the world.
- **Ground changes carry meaning.** The opening and closing frames are warm
  sunset; the body is deep night. Two colour worlds, and the change marks the
  argument's bookends.
- **Camera locked.** No camera movement anywhere in the sheet.
- **Data gets its own treatment repeatedly.** Oversized numerals — `16:00:01`,
  `$49.97`, `$52.53` — with the label in mono caps underneath. Same treatment each
  time, so data reads as a family.

## Principle kept, property discarded

Per A3.

| Principle (keep, generalise) | Source-specific (do not reproduce) |
|---|---|
| A persistent world in every frame turns a sequence into a place | The city skyline illustration |
| An on-screen clock that advances with the story makes montage read as chronology | Their exact timestamp format |
| One accent per frame, rationed under ~10% of pixels | Their specific yellow-green |
| Three tiers: eyebrow → hero → meta. Never four | Their wordmark and character set |
| Locked camera; a moving camera makes nothing feel important | Their headline copy |
| Numerals oversized with a mono label, repeated as a family | Their typefaces |
| Scrolling mono ticker carrying live state | Their product and exchange names |
| Two colour worlds, changed at the bookends | Their palette values |

## What this means for Vendra

The mapping is unusually clean, because Vendra already has a real equivalent for
each slot.

**Persistent world → the shop's record.** Not an illustration. A fixed frame that
holds the shop's deal spine in every shot, so the piece is one place rather than a
sequence of screens.

**Diegetic clock → the real gap between recording and recall.** This is the
product's actual claim: a deal recorded days ago, answered today. A clock that
advances across the piece is not decoration here; it *is* the argument, and it is
true because the dates are real.

**Bottom ticker → source citations.** In this reference the ticker is decoration.
In Vendra it would carry actual deal-event references — the thing the product
promises. That upgrades the reference's least load-bearing element into its most
important one.

**Accent → the product's existing accent.** Vendra already ships a palette and
type system. A reference palette would make the demo look like a template rather
than like the product it is demonstrating.

**Camera locked.** Directly from the reference.

## Honest limits of this analysis

- The 56s reference was analysed in depth. The other five were measured for
  duration, resolution, frame rate and codecs but **not** deconstructed frame by
  frame; doing so is the next step if the first cut needs calibrating against a
  second reference.
- All visual claims are **interpreted from stills**, not observed in motion.
  Motion vocabulary — easing, stagger, transitions as state changes — is
  therefore still unmeasured and must not be treated as matched.
- Audio was confirmed present and codec-identified but **no onset detection was
  run**, so the skill's requirement that cuts land on real transients is
  outstanding.