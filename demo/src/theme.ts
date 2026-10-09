/**
 * The film's design tokens.
 *
 * Every value is **measured from the product**, not chosen. They are read out of
 * `web/src/app/globals.css` and `web/src/app/layout.tsx`:
 *
 *   --bg-primary   #f4f6f4   --text-primary  #242a27
 *   --accent       #b9402e   --text-secondary #59635e
 *   --text-muted   #69726d   --success        #2f7654
 *   Barlow (display and body)   Azeret Mono (machine voice)
 *
 * A film that recoloured the product would advertise a version of it that does
 * not exist, and a judge comparing the demo against the live site would see two
 * different products. That is the reason these are not design choices.
 */

export const palette = {
  ground: '#f4f6f4',
  groundDeep: '#ecefed',
  surface: '#fbfcfb',
  ink: '#242a27',
  inkSecondary: '#59635e',
  inkMuted: '#69726d',
  accent: '#b9402e',
  accentSoft: 'rgba(185, 64, 46, 0.10)',
  accentBorder: 'rgba(185, 64, 46, 0.28)',
  success: '#2f7654',
  successSoft: 'rgba(47, 118, 84, 0.10)',
  border: 'rgba(36, 42, 39, 0.13)',
  borderSubtle: 'rgba(36, 42, 39, 0.07)',
  /** The one ground change in the film, at the verdict. */
  dark: '#161d1a',
  darkInk: '#f4f6f4',
  darkMuted: '#8d9a94',
} as const;

/**
 * The product's own easing, `--ease-precision`. Reusing it means motion in the
 * film decelerates the way the interface decelerates, rather than having a second,
 * unrelated idea of how things move.
 */
export const ease = [0.16, 1, 0.3, 1] as const;

/** Margins, 6% of frame width, unbroken across every shot. */
export const MARGIN = 115;

/**
 * Beat durations in frames, from the DIRECTION.md table. They sum to 3000, which
 * is exactly 100 seconds at 30fps.
 */
export const BEATS = {
  question: { from: 0, duration: 420 }, //    0 - 14s
  scatter: { from: 420, duration: 420 }, //  14 - 28s
  record: { from: 840, duration: 600 }, //   28 - 48s
  gap: { from: 1440, duration: 300 }, //     48 - 58s
  recall: { from: 1740, duration: 720 }, //  58 - 82s
  proof: { from: 2460, duration: 360 }, //   82 - 94s
  verdict: { from: 2820, duration: 180 }, // 94 - 100s
} as const;

export const FPS = 30;