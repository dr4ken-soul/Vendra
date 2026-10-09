import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, staticFile, Audio } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Barlow';
import { loadFont as loadMono } from '@remotion/google-fonts/AzeretMono';
import { FILM } from './data';
import { palette, ease, MARGIN, BEATS, FPS } from './theme';
import { Screen, Plate, ScreenLabel } from './screens';

const { fontFamily: barlow } = loadFont();
const { fontFamily: azeret } = loadMono();

/* ------------------------------------------------------------------ helpers */

/** Easing that matches the product's `--ease-precision`. */
const EASE = Easing.bezier(...ease);

const rise = (frame: number, delay = 0, distance = 26) =>
  interpolate(frame, [delay, delay + 20], [distance, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });

/** Per-letter reveal. Never scales all letters uniformly, per the skill. */
const Words: React.FC<{ children: string; frame: number; delay?: number; size: number; weight?: number; color?: string; track?: number }> = ({
  children,
  frame,
  delay = 0,
  size,
  weight = 700,
  color = palette.ink,
  track = -0.03,
}) => (
  <span style={{ display: 'block', fontSize: size, fontWeight: weight, letterSpacing: `${track}em`, lineHeight: 1.02, color }}>
    {children.split(' ').map((word, w, all) => (
      <span key={w} style={{ display: 'inline-block', marginRight: w === all.length - 1 ? 0 : '0.26em' }}>
        {word.split('').map((ch, c) => (
          <span
            key={c}
            style={{
              display: 'inline-block',
              opacity: interpolate(frame, [delay + w * 2 + c * 0.35, delay + w * 2 + c * 0.35 + 9], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: EASE,
              }),
              transform: `translateY(${interpolate(frame, [delay + w * 2 + c * 0.35, delay + w * 2 + c * 0.35 + 9], [14, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: EASE,
              })}px)`,
            }}
          >
            {ch}
          </span>
        ))}
      </span>
    ))}
  </span>
);

/**
 * The persistent frame.
 *
 * Three elements, identical geometry in every shot, per the skill's persistence
 * rule. The test the skill gives is whether removing it costs the viewer
 * information, and here it does:
 *
 *   the date stamp   the deal is dated 30 September. That is the product's claim.
 *   the spine        which supplier and which deal, every frame.
 *   the ticker       the real event ids. This is the evidence, and the whole
 *                    argument is that answers come from records rather than
 *                    from a model. Remove it and there is nothing to point at.
 */
const Chrome: React.FC<{ frame: number; dark?: boolean }> = ({ frame, dark = false }) => {
  const ink = dark ? palette.darkInk : palette.ink;
  const muted = dark ? palette.darkMuted : palette.inkMuted;
  const tick = frame * 1.6;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Date stamp, top-left. The deal's own date, not a running clock. */}
      <div
        style={{
          position: 'absolute',
          left: MARGIN,
          top: 54,
          fontFamily: azeret,
          fontSize: 19,
          letterSpacing: '0.22em',
          color: muted,
          opacity: 0.85,
        }}
      >
        DEAL {FILM.dealDate}
      </div>

      {/* Wordmark, top-right. The film's subject, held low. */}
      <div
        style={{
          position: 'absolute',
          right: MARGIN,
          top: 54,
          fontFamily: barlow,
          fontSize: 21,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: ink,
          opacity: 0.9,
        }}
      >
        Vendra
      </div>

      {/* Citation ticker, bottom. Real event ids, scrolling like the reference. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 40,
          height: 34,
          overflow: 'hidden',
          borderTop: `1px solid ${dark ? 'rgba(244,246,244,0.14)' : palette.borderSubtle}`,
          borderBottom: `1px solid ${dark ? 'rgba(244,246,244,0.14)' : palette.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            transform: `translateX(${-(tick % 2400)}px)`,
            fontFamily: azeret,
            fontSize: 14,
            letterSpacing: '0.2em',
            color: muted,
            opacity: 0.75,
          }}
        >
          {[...FILM.sources, ...FILM.sources].map((s, i) => (
            <span key={i} style={{ marginRight: 64 }}>
              {s.short} · {s.eventType.replace(/_/g, ' ').toUpperCase()} · {s.occurredAt}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The texture stack. Grain and vignette, uniform, low. No aberration — it reads as generated. */
const Texture: React.FC<{ dark?: boolean }> = ({ dark = false }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 42%, transparent 42%, ${dark ? 'rgba(0,0,0,0.5)' : 'rgba(36,42,39,0.16)'} 100%)`,
      }}
    />
    <AbsoluteFill style={{ opacity: dark ? 0.05 : 0.035, mixBlendMode: dark ? 'screen' : 'multiply' }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  </AbsoluteFill>
);

const Base: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark = false }) => (
  <AbsoluteFill style={{ background: dark ? palette.dark : palette.ground, fontFamily: barlow }}>
    {children}
  </AbsoluteFill>
);

const Eyebrow: React.FC<{ children: string; frame: number; delay?: number; dark?: boolean }> = ({
  children,
  frame,
  delay = 0,
  dark = false,
}) => (
  <div
    style={{
      fontFamily: azeret,
      fontSize: 15,
      letterSpacing: '0.24em',
      color: dark ? palette.darkMuted : palette.inkMuted,
      opacity: interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: 'clamp', easing: EASE }),
    }}
  >
    {children}
  </div>
);

/* -------------------------------------------------------------------- beats */

/** Beat 1 — the question. The moment every retailer recognises. */
const BeatQuestion: React.FC = () => (
  <Base>
    <div style={{ position: 'absolute', left: MARGIN, top: 372, width: 1500 }}>
      <Eyebrow frame={useCurrentFrame()} delay={4}>
        THE QUESTION
      </Eyebrow>
      <div style={{ marginTop: 30 }}>
        <Words frame={useCurrentFrame()} delay={12} size={128}>
          What did we agree?
        </Words>
      </div>
      <div
        style={{
          marginTop: 44,
          fontSize: 30,
          color: palette.inkSecondary,
          opacity: interpolate(useCurrentFrame(), [52, 68], [0, 1], { extrapolateRight: 'clamp', easing: EASE }),
          transform: `translateY(${rise(useCurrentFrame(), 52)}px)`,
        }}
      >
        Three weeks on. Which supplier. Which price. What went wrong.
      </div>
    </div>
  </Base>
);

/** Beat 2 — the scatter. Where the answer usually lives, and why it is not findable. */
const BeatScatter: React.FC = () => {
  const f = useCurrentFrame();
  const items = [
    ['A MESSAGE THREAD', 'scroll, scroll, scroll'],
    ['A NOTE IN A POCKET', 'smells of tomatoes'],
    ['WHAT YOU REMEMBER', 'approximately'],
  ];

  return (
    <Base>
      <div style={{ position: 'absolute', left: MARGIN, top: 210, width: 1700 }}>
        <Eyebrow frame={f} delay={2}>
          WHERE IT ACTUALLY LIVES
        </Eyebrow>
      </div>
      {items.map(([title, sub], i) => {
        const d = 14 + i * 16;
        const o = interpolate(f, [d, d + 14], [0, 1], { extrapolateRight: 'clamp', easing: EASE });
        return (
          <div
            key={title}
            style={{
              position: 'absolute',
              left: MARGIN,
              top: 300 + i * 168,
              width: 1180,
              opacity: o,
              transform: `translateY(${interpolate(f, [d, d + 14], [30, 0], { extrapolateRight: 'clamp', easing: EASE })}px)`,
            }}
          >
            <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.03em', color: palette.ink }}>
              {title}
            </div>
            <div style={{ marginTop: 8, fontSize: 26, color: palette.inkMuted, fontStyle: 'italic' }}>{sub}</div>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          right: MARGIN,
          top: 330,
          width: 460,
          borderLeft: `2px solid ${palette.accent}`,
          paddingLeft: 34,
          opacity: interpolate(f, [70, 86], [0, 1], { extrapolateRight: 'clamp', easing: EASE }),
        }}
      >
        <div style={{ fontSize: 34, color: palette.ink, lineHeight: 1.28 }}>
          None of them is the record. They are traces of it.
        </div>
      </div>
    </Base>
  );
};

/**
 * Beat 3 — the record, as the product actually looks.
 *
 * Real capture, not a reconstruction. The claim sits on the capture rather than
 * beside it, which is the reference's method and is also what lets a judge check
 * the film against the deployment.
 */
const BeatRecord: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Base>
      <Screen src={staticFile('screens/02-deal-detail.png')} duration={600} />
      <Plate frame={f} delay={70} width={1080}>
        Six cartons of tomato paste. Quoted at 18,000 naira, agreed at 17,500.
      </Plate>
    </Base>
  );
};

/**
 * Beat 4 — the gap.
 *
 * The emptiest frame in the film, and deliberately so: the references pace at a
 * structural event every 0.7-0.9s, and the skill says restraint only reads as
 * premium if something else is loud. Nothing moves here except the date.
 *
 * It exists because the product is about time, and because the references that
 * do not have this beat are about products that are about now.
 */
const BeatGap: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = f / BEATS.gap.duration;

  return (
    <Base>
      <div style={{ position: 'absolute', left: MARGIN, top: 380, width: 1400 }}>
        <Eyebrow frame={f} delay={10}>
          LATER
        </Eyebrow>
        <div style={{ marginTop: 34, fontSize: 92, fontWeight: 600, letterSpacing: '-0.035em', color: palette.ink, lineHeight: 1.06 }}>
          Same shop. Same supplier.
          <br />
          Nothing retyped.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: MARGIN,
          bottom: 180,
          fontFamily: azeret,
          fontSize: 16,
          letterSpacing: '0.22em',
          color: palette.inkMuted,
          opacity: interpolate(f, [40, 70], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        {Math.round(progress * 100)}% OF THE FILM SPENT NOT TYPING
      </div>
    </Base>
  );
};

/** Beat 5 — the recall, as the product actually answered it. */
const BeatRecall: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Base>
      <Screen src={staticFile('screens/05-ask-answer.png')} duration={720} />
      <Plate frame={f} delay={54} width={1080}>
        Answered from deal memory, citing seven source records.
      </Plate>
    </Base>
  );
};

/**
 * Beat 6 — the proof.
 *
 * The source rows stay because they are the argument: the citations resolve to
 * named events with ids and dates, which is the difference between an answer and
 * a guess. They sit beside the capture rather than replacing it, so the viewer
 * can see both at once.
 */
const BeatProof: React.FC = () => {
  const f = useCurrentFrame();
  const shown = FILM.sources.slice(0, 5);

  return (
    <Base>
      <div style={{ position: 'absolute', left: MARGIN, top: 176, width: 1700 }}>
        <Eyebrow frame={f} delay={2}>
          WHERE THE SENTENCE CAME FROM
        </Eyebrow>
      </div>
      {shown.map((s, i) => {
        const d = 12 + i * 11;
        const o = interpolate(f, [d, d + 12], [0, 1], { extrapolateRight: 'clamp', easing: EASE });
        return (
          <div
            key={s.eventId}
            style={{
              position: 'absolute',
              left: MARGIN,
              top: 258 + i * 138,
              width: 1690,
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              background: palette.surface,
              border: `1px solid ${palette.border}`,
              borderLeft: `3px solid ${palette.accent}`,
              borderRadius: 14,
              padding: '20px 28px',
              opacity: o,
              transform: `translateX(${interpolate(f, [d, d + 12], [-22, 0], { extrapolateRight: 'clamp', easing: EASE })}px)`,
            }}
          >
            <span style={{ fontFamily: azeret, fontSize: 15, color: palette.inkMuted, width: 120 }}>
              SOURCE {s.n}
            </span>
            <span style={{ fontFamily: azeret, fontSize: 15, color: palette.accent, width: 120 }}>
              {s.short}
            </span>
            <span style={{ fontSize: 22, color: palette.ink, width: 260 }}>
              {s.eventType.replace(/_/g, ' ')}
            </span>
            <span style={{ fontFamily: azeret, fontSize: 15, color: palette.inkMuted, width: 160 }}>{s.occurredAt}</span>
            <span style={{ fontSize: 21, color: palette.inkSecondary, flex: 1 }}>{s.summary}</span>
          </div>
        );
      })}
    </Base>
  );
};

/** Beat 7 — the verdict. The one ground change in the film, and the only logo. */
const BeatVerdict: React.FC = () => {
  const f = useCurrentFrame();
  const inBeat = f - BEATS.verdict.from;
  const { fps } = useVideoConfig();
  const pop = spring({ frame: inBeat, fps, config: { stiffness: 260, damping: 24 } });

  return (
    <Base dark>
      <div style={{ position: 'absolute', left: MARGIN, top: 300, width: 1560 }}>
        <Eyebrow frame={f} delay={6} dark>
          WHAT THIS CHANGES
        </Eyebrow>
        <div style={{ marginTop: 30 }}>
          <Words frame={f} delay={14} size={104} color={palette.darkInk}>
            You stop asking your memory.
          </Words>
        </div>
        <div
          style={{
            marginTop: 44,
            fontSize: 30,
            lineHeight: 1.5,
            color: palette.darkMuted,
            maxWidth: 1180,
            opacity: interpolate(f, [56, 76], [0, 1], { extrapolateRight: 'clamp', easing: EASE }),
          }}
        >
          A deal recorded once, answered later from the record itself — and every answer
          carries the events it came from.
        </div>
      </div>

      {/* The logo arrives last and holds. It is the conclusion, not the opening. */}
      <div
        style={{
          position: 'absolute',
          left: MARGIN,
          bottom: 168,
          display: 'flex',
          alignItems: 'center',
          gap: 30,
          opacity: interpolate(f, [92, 116], [0, 1], { extrapolateRight: 'clamp', easing: EASE }),
          transform: `scale(${0.94 + pop * 0.06})`,
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em', color: palette.darkInk }}>
          Vendra
        </div>
        <div style={{ fontFamily: azeret, fontSize: 17, letterSpacing: '0.2em', color: palette.darkMuted }}>
          VENDRA-PSYCHO-PROJECTS.VERCEL.APP
        </div>
      </div>
    </Base>
  );
};

/* --------------------------------------------------------------------- film */

export const VendraFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dark = frame >= BEATS.verdict.from;

  return (
    <AbsoluteFill style={{ background: dark ? palette.dark : palette.ground }}>
      <Audio src={staticFile('mix.wav')} />

      {frame < BEATS.scatter.from && <BeatQuestion />}
      {frame >= BEATS.scatter.from && frame < BEATS.record.from && <BeatScatter />}
      {frame >= BEATS.record.from && frame < BEATS.gap.from && <BeatRecord />}
      {frame >= BEATS.gap.from && frame < BEATS.recall.from && <BeatGap />}
      {frame >= BEATS.recall.from && frame < BEATS.proof.from && <BeatRecall />}
      {frame >= BEATS.proof.from && frame < BEATS.verdict.from && <BeatProof />}
      {frame >= BEATS.verdict.from && <BeatVerdict />}

      <Texture dark={dark} />
      <Chrome frame={frame} dark={dark} />
    </AbsoluteFill>
  );
};

export const FILM_LENGTH = Object.values(BEATS).reduce((max, b) => Math.max(max, b.from + b.duration), 0);
