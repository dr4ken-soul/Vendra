'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The single persistent ambient video background.
 *
 * FRONTEND_SPEC 1.5 / 1.6:
 *   - mounted ONCE at the app root, behind every landing section including the footer
 *   - the five stills in /video are generation references, NOT five videos
 *   - z-0, pointer-events-none, h-dvh, object-cover, object-[64%_center]
 *   - muted, autoplay, playsInline, preload="auto"
 *   - light wash at z-[1], left text-safe gradient at z-[1]
 *   - embedded SVG fractal-noise grain at z-[3]
 *   - keyboard-operable pause/resume control
 *   - prefers-reduced-motion: no autoplay, poster only
 *   - navigator.connection saveData / 2g / 3g: skip loading, poster only
 *
 * If the source is unavailable the poster and the page remain fully usable.
 */

const POSTER = '/video/vendra-ambient-loop-poster.jpg';
const SOURCE = '/video/vendra-ambient-loop.mp4';

type ConnectionInfo = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
};

export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [canPlay, setCanPlay] = useState(true);
  const [ready, setReady] = useState(false);

  /**
   * `prefers-reduced-motion` and the network information API are both only
   * available in the browser, so they are read here and pushed into state
   * through an event callback rather than during render.
   */
  useEffect(() => {
    const apply = () => {
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const nav = navigator as Navigator & { connection?: ConnectionInfo };
      const connection = nav.connection;

      const slow =
        connection?.saveData === true ||
        ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '');

      setReducedMotion(motionQuery.matches);
      setSaveData(slow);
    };

    // Deferred by a tick so no state is set synchronously in the effect body.
    const initial = setTimeout(apply, 0);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => setReducedMotion(motionQuery.matches);
    motionQuery.addEventListener('change', onMotionChange);

    const nav = navigator as Navigator & { connection?: ConnectionInfo };
    const onConnectionChange = () => apply();
    nav.connection?.addEventListener?.('change', onConnectionChange);

    return () => {
      clearTimeout(initial);
      motionQuery.removeEventListener('change', onMotionChange);
      nav.connection?.removeEventListener?.('change', onConnectionChange);
    };
  }, []);

  const shouldSkip = reducedMotion || saveData;
  // When motion is reduced or the connection is metered, no source is mounted
  // and the poster stands in. Both are derived values, not effects.
  const playbackAllowed = !shouldSkip && canPlay;
  const effectivelyPaused = paused || shouldSkip || !canPlay;

  const toggle = () => {
    // With reduced motion or a metered connection there is no source mounted,
    // so the poster is what the user is looking at and there is nothing to play.
    if (shouldSkip || !canPlay) return;

    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      video.pause();
      setPaused(true);
    }
  };

  return (
    <>
      {/* VIDEO WRAPPER — z-0 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-dvh w-full overflow-hidden bg-[var(--bg-primary)]"
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
          poster={POSTER}
          autoPlay={!shouldSkip}
          muted
          playsInline
          preload="auto"
          loop
          tabIndex={-1}
          onCanPlay={() => setReady(true)}
          onError={() => setCanPlay(false)}
        >
          {playbackAllowed && <source src={SOURCE} type="video/mp4" />}
        </video>

        {/* LIGHT WASH — z-[1] */}
        <div className="absolute inset-0 z-[1] bg-[rgba(244,246,244,0.24)]" />
        {/* LEFT TEXT-SAFE GRADIENT — z-[1] */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(90deg, rgba(244,246,244,0.48) 0%, rgba(244,246,244,0.25) 46%, rgba(244,246,244,0.08) 100%)',
          }}
        />
      </div>

      {/* GRAIN — z-[3], embedded SVG fractal noise, never a blurring filter */}
      <div
        aria-hidden="true"
        className="vendra-grain pointer-events-none fixed inset-0 z-[3] opacity-[0.035]"
      />

      {/*
        The pause control lives in the navigation, which owns the accessible
        name and the control itself. This exposes the state via a custom event
        so the nav button stays a single source of truth.
      */}
      <VideoControlBridge paused={effectivelyPaused} ready={ready} onToggle={toggle} />
    </>
  );
}

/**
 * Bridges the video element state to the navigation's pause/play button without
 * duplicating the control. The nav button dispatches `vendra:toggle-video`.
 */
function VideoControlBridge({
  paused,
  ready,
  onToggle,
}: {
  paused: boolean;
  ready: boolean;
  onToggle: () => void;
}) {
  useEffect(() => {
    const handler = () => onToggle();
    window.addEventListener('vendra:toggle-video', handler);
    return () => window.removeEventListener('vendra:toggle-video', handler);
  }, [onToggle]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vendra:video-state', { detail: { paused, ready } }));
  }, [paused, ready]);

  return null;
}

/** Subscribe to the video state. Used by the navigation control. */
export function useVideoState() {
  const [state, setState] = useState({ paused: false, ready: false });

  useEffect(() => {
    const handler = (event: Event) => {
      setState((event as CustomEvent<{ paused: boolean; ready: boolean }>).detail);
    };
    window.addEventListener('vendra:video-state', handler);
    return () => window.removeEventListener('vendra:video-state', handler);
  }, []);

  return {
    ...state,
    toggle: () => window.dispatchEvent(new Event('vendra:toggle-video')),
  };
}