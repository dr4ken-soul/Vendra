import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { palette, ease, MARGIN } from './theme';

/**
 * Real screen capture, the way the Ebbryn reference does it.
 *
 * The film previously re-rendered the interface in the product's design system.
 * Every number in those frames was real, but the frames were not pixels of the
 * live site, and a judge comparing the film to the deployment would be looking at
 * two different products. These frames are screenshots of
 * vendra-psycho-projects.vercel.app, signed in as a real account with a real
 * shop, captured by analysis/capture-screens.mjs.
 *
 * The reference's method is capture plus a claim laid over it, so the capture
 * fills the frame and the film's line sits on top of it rather than beside it.
 * A slow push-in stands in for the reference's cursor: it is camera movement, so
 * it has to justify itself by revealing something.
 */

const EASE = Easing.bezier(...ease);

export const Screen: React.FC<{
  src: string;
  /** Frames the push-in runs for. Slow, continuous, never looping. */
  duration?: number;
  /** How far the frame travels, in percent. Small. */
  travel?: number;
  radius?: number;
}> = ({ src, duration = 600, travel = 2.4, radius = 18 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, duration], [0, 1], { extrapolateRight: 'clamp', easing: EASE });

  /**
   * The capture is contained rather than bled.
   *
   * A full-bleed screenshot ran under the persistent ticker and pushed the
   * Sources panel — the thing the film is arguing for — off the right edge.
   * It is fitted inside the margin system, anchored top so the product's own
   * header survives the crop, and stopped short of the ticker.
   */
  const boxTop = 96;
  const boxHeight = 890;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: MARGIN,
          top: boxTop,
          width: 1920 - MARGIN * 2,
          height: boxHeight,
          overflow: 'hidden',
          borderRadius: radius,
          border: `1px solid ${palette.border}`,
          boxShadow: '0 26px 70px rgba(36,42,39,0.13)',
          transform: `scale(${1 + (travel / 100) * t})`,
          transformOrigin: '50% 45%',
        }}
      >
        <img
          src={src}
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: `translateX(-50%) scale(${1 + (travel / 100) * t})`,
            transformOrigin: '50% 40%',
            width: '100%',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * A caption plate over the capture.
 *
 * The skill's rule that narration may be graphic: mono text in a chip anchored to
 * a margin, persisting across a shot. It stays legible muted, which is what makes
 * a voiceover optional rather than required.
 */
export const Plate: React.FC<{
  children: React.ReactNode;
  frame: number;
  delay?: number;
  bottom?: number;
  width?: number;
}> = ({ children, frame, delay = 0, bottom = 128, width = 980 }) => (
  <div
    style={{
      position: 'absolute',
      left: MARGIN,
      bottom,
      width,
      background: 'rgba(22,33,29,0.94)',
      color: '#f4f6f4',
      borderRadius: 14,
      padding: '20px 28px',
      fontSize: 27,
      lineHeight: 1.34,
      opacity: interpolate(frame, [delay, delay + 16], [0, 1], { extrapolateRight: 'clamp', easing: EASE }),
      transform: `translateY(${interpolate(frame, [delay, delay + 16], [22, 0], {
        extrapolateRight: 'clamp',
        easing: EASE,
      })}px)`,
    }}
  >
    {children}
  </div>
);

/** The label that makes a capture honest about being a capture. */
export const ScreenLabel: React.FC<{ children: string; frame: number; delay?: number }> = ({
  children,
  frame,
  delay = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      left: MARGIN,
      top: 118,
      fontFamily: 'ui-monospace, monospace',
      fontSize: 14,
      letterSpacing: '0.24em',
      color: palette.inkMuted,
      opacity: interpolate(frame, [delay, delay + 14], [0, 0.9], { extrapolateRight: 'clamp', easing: EASE }),
    }}
  >
    {children}
  </div>
);