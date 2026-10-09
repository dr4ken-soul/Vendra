'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * The moment an email address is confirmed.
 *
 * Two paths reach a session, and they need different treatment because the user
 * arrives in a different state.
 *
 * **From an email link.** The retailer has just switched from an email client into
 * a browser. Nothing on screen yet tells them whether the click worked. This is a
 * security-sensitive, one-time event, so it gets a full-screen moment with its own
 * space rather than a corner toast. A toast is dismissible and easy to miss, which
 * is the wrong weight for "this address now belongs to you", and it would in any
 * case flash during a page transition and be gone.
 *
 * **From a typed code.** The retailer is already looking at the form they just
 * used, watching a button they pressed. Replacing that card with a takeover would
 * hide the thing they just did, so the same component renders in place and the
 * form's contents are replaced by it.
 *
 * Deliberate constraints, since this is the kind of component that is easy to
 * over-decorate:
 *
 *   - The text states the fact. The animation decorates it. Nothing is conveyed by
 *     colour or by a tick alone, so it still reads with animation disabled and in
 *     greyscale.
 *   - It is announced through a live region, because a full-screen change of
 *     content is otherwise silent to a screen reader.
 *   - `prefers-reduced-motion` collapses the entrance to an instant, final state.
 *     Someone who has asked for less movement gets the confirmation without the
 *     movement, never the movement without the confirmation.
 *   - `compact` drops the surrounding page so the same component can replace a
 *     form panel in place.
 */

export function ConfirmationCheck({ size = 56 }: { size?: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      aria-hidden="true"
      initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 320, damping: 22, mass: 0.7 }
      }
      className="grid shrink-0 place-items-center rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
      style={{ width: size, height: size }}
    >
      <motion.svg
        width={size * 0.46}
        height={size * 0.46}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.12, ease: 'easeOut' }}
      >
        <motion.path d="m4.5 12.5 5 5 10-11" />
      </motion.svg>
    </motion.span>
  );
}

export function ConfirmedMessage({
  title = 'Email confirmed',
  detail = 'Setting up your shop…',
  compact = false,
  children,
}: {
  title?: string;
  detail?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  const panel = (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={compact ? 'flex flex-col items-center text-center' : 'flex flex-col items-center text-center'}
    >
      <ConfirmationCheck />

      <h1 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{detail}</p>

      {children ? <div className="mt-6">{children}</div> : null}
    </motion.div>
  );

  if (compact) return panel;

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-[420px] text-center" role="status" aria-live="polite">
        {panel}
      </div>
    </main>
  );
}