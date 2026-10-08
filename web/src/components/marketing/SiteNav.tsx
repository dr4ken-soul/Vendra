'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useVideoState } from './VideoBackground';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Gate 2, A2 scroll-morph pill navigation (FRONTEND_SPEC 2).
 *
 * Expanded at the top: a transparent full-width bar with inline links.
 * After 80px of scroll: a compact floating pill; the links move into a drawer.
 *
 * The morph runs at 0.22s with the precision ease, implemented as a CSS
 * transition so the shell stays fixed. The wordmark is TEXT ONLY - no logo,
 * monogram or brand symbol.
 */

const LINKS = [
  { label: 'How it works', href: '#deal-timeline' },
  { label: 'Deal memory', href: '#recall-demo' },
  { label: 'FAQ', href: '#faq' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { paused, ready, toggle } = useVideoState();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Drawer: Escape to close, focus trap, scroll lock, focus restoration.
  useEffect(() => {
    if (!drawerOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Captured now: the ref may point at a different node by cleanup time.
    const trigger = triggerRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
      trigger?.focus();
    };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      {/*
        The morph is a CSS transition rather than a Motion layout transition.

        Motion's `layout` prop sets `position: relative` on the element it
        measures, which would detach the navigation from the viewport and let
        it scroll away. A fixed element cannot be laid out that way, so the
        same 0.22s duration and precision ease are applied as a CSS transition
        on the shared properties: position stays fixed at every frame.
      */}
      <header
        className={`transition-all duration-[220ms] ease-[var(--ease-precision)] ${
          scrolled
            ? 'liquid-glass-nav fixed left-1/2 top-3 z-50 flex min-h-14 w-[calc(100%-2rem)] max-w-[1200px] -translate-x-1/2 items-center justify-between rounded-full px-3 py-2 shadow-[var(--shadow-sm)]'
            : 'fixed inset-x-0 top-0 z-50 flex h-20 items-center justify-between border-b border-transparent bg-transparent px-5 md:px-8 lg:px-12'
        }`}
      >
        <Link
          href="/"
          className={
            scrolled
              ? 'px-3 font-display text-lg font-semibold tracking-[-0.04em] text-[var(--text-primary)]'
              : 'font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)] md:text-[1.75rem]'
          }
        >
          Vendra
        </Link>

        {!scrolled && (
          <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--text-secondary)] transition-colors duration-[120ms] hover:text-[var(--text-primary)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={paused ? 'Play background video' : 'Pause background video'}
            className={
              scrolled
                ? 'hidden min-h-10 min-w-10 items-center justify-center rounded-full px-2 text-[var(--text-secondary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] md:inline-flex'
                : 'inline-flex size-11 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-primary)] transition-colors duration-[120ms] hover:bg-[var(--bg-surface)]'
            }
          >
            <span className="sr-only">{paused ? 'Play background video' : 'Pause background video'}</span>
            {paused ? <PlayIcon /> : <PauseIcon />}
            {!ready && <span className="sr-only">(still loading)</span>}
          </button>

          <Link
            href="/app"
            className={
              scrolled
                ? 'inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-sm)] transition-all duration-[220ms] hover:bg-[var(--accent-hover)] md:text-sm'
                : 'inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-sm)] transition-all duration-[220ms] hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md)]'
            }
          >
            Try Vendra
          </Link>

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="site-nav-drawer"
            className={
              scrolled
                ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]'
                : 'md:hidden inline-flex size-11 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-primary)] transition-colors duration-[120ms] hover:bg-[var(--bg-surface)]'
            }
          >
            <span className="sr-only">Open menu</span>
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* SCRIM — z-[52] */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: EASE }}
              onClick={closeDrawer}
              className="fixed inset-0 z-[52] bg-[rgba(36,42,39,0.42)] backdrop-blur-[2px]"
              aria-hidden="true"
            />

            {/* PANEL — z-[55] */}
            <motion.div
              ref={panelRef}
              id="site-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              initial={{ x: '100%', opacity: 0.96 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.96, transition: { duration: 0.16, ease: EASE } }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed right-0 top-0 z-[55] flex h-dvh w-[min(88vw,380px)] flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface)] px-7 py-8 shadow-[var(--shadow-lg)]"
            >
              <button
                ref={closeRef}
                type="button"
                onClick={closeDrawer}
                className="inline-flex size-11 items-center justify-center self-end rounded-full text-[var(--text-secondary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
              >
                <span className="sr-only">Close menu</span>
                <CloseIcon />
              </button>

              <p className="mt-5 font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                Vendra
              </p>

              <nav aria-label="Site" className="mt-8 flex flex-col gap-1">
                {LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeDrawer}
                    className="flex min-h-12 items-center border-b border-[var(--border-subtle)] py-3 font-body text-base font-medium text-[var(--text-secondary)] transition-colors duration-[120ms] hover:text-[var(--accent)]"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <Link
                href="/app"
                onClick={closeDrawer}
                className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-body text-sm font-semibold text-[var(--text-on-accent)] transition-colors duration-[120ms] hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Try Vendra
              </Link>

              <p className="mt-auto max-w-[30ch] pt-8 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                Your shop’s supplier history stays private by default.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG only. Decorative, so every icon is aria-hidden.
// ---------------------------------------------------------------------------

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor" />
      <rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 3.5v9l7.5-4.5-7.5-4.5Z" fill="currentColor" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}