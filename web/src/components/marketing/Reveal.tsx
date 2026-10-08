'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Shared reduced-motion hook.
 *
 * FRONTEND_SPEC 1.7: under reduced motion, blur and translation are removed,
 * content is preserved and duration becomes 0.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

/**
 * Default section reveal (FRONTEND_SPEC 1.7).
 *
 * blur(10px) + opacity 0 + y 16 -> blur(0) + opacity 1 + y 0
 * duration 0.42s, ease [0.16, 1, 0.3, 1], viewport amount 0.1
 *
 * `once: false` is deliberate: every viewport entrance replays on re-entry.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
  amount = 0.1,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article' | 'header';
  amount?: number;
}) {
  const reduced = useReducedMotion();
  const MotionTag = motion[Tag] as typeof motion.div;

  return (
    <MotionTag
      className={`vendra-reveal ${className}`}
      initial={reduced ? { opacity: 1 } : { filter: 'blur(10px)', opacity: 0, y: 16 }}
      whileInView={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
      viewport={{ once: false, amount }}
      transition={{ duration: reduced ? 0 : 0.42, ease: EASE, delay: reduced ? 0 : delay }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Horizontal reveal used by the memory/access section (FRONTEND_SPEC 3,
 * section 6), which translates on x rather than y.
 */
export function RevealX({
  children,
  delay = 0,
  direction = 'left',
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: 'left' | 'right';
  className?: string;
}) {
  const reduced = useReducedMotion();
  const offset = direction === 'left' ? -12 : 12;

  return (
    <motion.div
      className={`vendra-reveal ${className}`}
      initial={reduced ? { opacity: 1 } : { filter: 'blur(10px)', opacity: 0, x: offset }}
      whileInView={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.1 }}
      transition={{ duration: reduced ? 0 : 0.42, ease: EASE, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

/** Page-load entrance for the hero. Runs once on mount and never on scroll. */
export function Enter({
  children,
  delay = 0,
  blur = 10,
  y = 16,
  scale,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  blur?: number;
  y?: number;
  scale?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 1 } : { filter: `blur(${blur}px)`, opacity: 0, y, ...(scale !== undefined ? { scale } : {}) }}
      animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0, ...(scale !== undefined ? { scale: 1 } : {}) }}
      transition={{ duration: reduced ? 0 : 0.42, ease: EASE, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Route transition for authenticated screens (FRONTEND_SPEC 4.3).
 * blur(6px) + opacity 0 + x 12 -> clear, 0.20s. Reverses x on back navigation.
 * No scroll reveal is applied to deal tables or timeline rows.
 */
export function RouteEnter({
  children,
  direction = 1,
}: {
  children: React.ReactNode;
  direction?: 1 | -1;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { filter: 'blur(6px)', opacity: 0, x: 12 * direction }}
      animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, x: 0 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}