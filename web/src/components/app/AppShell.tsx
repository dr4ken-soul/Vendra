'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { ShopRole, ShopPermission } from '@/lib/types';

/**
 * Authenticated application shell (FRONTEND_SPEC 4.2).
 *
 * Independent of the marketing A2 scroll-morph nav. 240px sidebar at lg and
 * above; a five-item labelled bottom tab bar below lg, with More opening team,
 * settings, privacy and sign out.
 *
 * No video, grain, liquid glass or marketing composition appears here.
 */

export interface ShellShop {
  id: string;
  name: string;
  role: ShopRole;
  permissions: ShopPermission[];
  memoryStatus: string;
}

const NAV = [
  { href: '/app', label: 'Overview', shortLabel: 'Home', icon: HomeIcon, exact: true },
  { href: '/app/deals', label: 'Deals', shortLabel: 'Deals', icon: DealIcon },
  { href: '/app/ask', label: 'Ask Vendra', shortLabel: 'Ask', icon: AskIcon },
  { href: '/app/suppliers', label: 'Suppliers', shortLabel: 'Suppliers', icon: SupplierIcon },
  { href: '/app/team', label: 'Team', shortLabel: 'More', icon: TeamIcon, tabOnly: false },
];

export function AppShell({
  shops,
  activeShopId,
  children,
  displayName,
  email,
}: {
  shops: ShellShop[];
  activeShopId: string;
  children: React.ReactNode;
  displayName: string | null;
  email: string | null;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);

  const activeShop = shops.find((s) => s.id === activeShopId) ?? shops[0];
  const canSeeTeam = activeShop?.permissions.includes('team.view') ?? false;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  // More sheet: Escape, focus trap, scroll lock, focus restoration.
  useEffect(() => {
    if (!moreOpen) return;

    const previous = document.activeElement as HTMLElement | null;
    // Captured now: the ref may point at a different node by cleanup time.
    const trigger = sheetTriggerRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusables?.length) return;
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
      previous?.focus();
      trigger?.focus();
    };
  }, [moreOpen]);

  // Close the shop menu on outside click and Escape.
  useEffect(() => {
    if (!shopMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShopMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shopMenuOpen]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      const res = await fetch('/api/auth/signout', { method: 'POST' });

      /**
       * The status has to be checked, not just the absence of a network error.
       *
       * A 404 is a successful fetch, so a catch alone never sees it. That is how
       * a missing route became "sign out does nothing": the button navigated to
       * /sign-in, the session was still valid, and the middleware sent the user
       * straight back into the app. Reporting the failure is better than
       * pretending to have signed out.
       */
      if (!res.ok) {
        setSigningOut(false);
        setSignOutError('Signing out failed. Try again, or clear cookies for this site.');
        return;
      }

      setSignOutError(null);
      /**
       * A full document navigation, deliberately, and the lint rule against it is
       * suppressed with the reason rather than worked around.
       *
       * router.push() would keep the client alive, and the middleware that
       * redirects a signed-in user away from /sign-in does not get to re-run for
       * a document it never fetches. The previous implementation did exactly
       * that and appeared to sign out while leaving the session intact.
       */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/sign-in');
    } catch {
      setSigningOut(false);
      setSignOutError('Signing out failed. Check your connection and try again.');
    }
  };

  const breadcrumb = buildBreadcrumb(pathname);

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] font-body text-[var(--text-primary)] antialiased">
      {/* Skip link — first focusable element in the authenticated surface */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--bg-surface)] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[var(--text-primary)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
      >
        Skip to main content
      </a>

      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* SIDEBAR — z-20, lg and above */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-6 lg:flex">
          <Link
            href="/app"
            className="px-3 font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]"
          >
            Vendra
          </Link>

          {shops.length > 1 && (
            <div className="relative mt-7">
              <button
                type="button"
                onClick={() => setShopMenuOpen((v) => !v)}
                aria-expanded={shopMenuOpen}
                aria-haspopup="listbox"
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors duration-[120ms] hover:border-[var(--border-strong)]"
              >
                <span className="min-w-0 truncate">{activeShop?.name}</span>
                <ChevronDown />
              </button>

              {shopMenuOpen && (
                <ul
                  role="listbox"
                  aria-label="Choose a shop"
                  className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]"
                >
                  {shops.map((shop) => (
                    <li key={shop.id}>
                      <Link
                        href={`/app?shop=${shop.id}`}
                        onClick={() => setShopMenuOpen(false)}
                        role="option"
                        aria-selected={shop.id === activeShopId}
                        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm text-[var(--text-primary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]"
                      >
                        <span className="min-w-0 truncate">{shop.name}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                          {shop.role}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <nav aria-label="Main" className="mt-7 flex flex-col gap-1">
            {NAV.filter((item) => !(item.href === '/app/team' && !canSeeTeam)).map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] ${
                    active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <item.icon />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-[var(--border-subtle)] pt-4">
            <Link
              href="/app/settings"
              aria-current={pathname.startsWith('/app/settings') ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] ${
                pathname.startsWith('/app/settings')
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <SettingsIcon />
              Settings
            </Link>
          </div>
        </aside>

        {/* MAIN COLUMN */}
        <div className="min-w-0">
          {/* TOPBAR — sticky, z-20 */}
          <div className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border-default)] bg-[var(--surface-panel)] px-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/app"
                className="font-display text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)] lg:hidden"
              >
                Vendra
              </Link>

              {shops.length > 1 && (
                <Link
                  href={`/app?shop=${activeShop?.id ?? ''}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 font-body text-xs font-medium text-[var(--text-secondary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)] lg:hidden"
                >
                  <span className="max-w-[9rem] truncate">{activeShop?.name}</span>
                  <ChevronDown />
                </Link>
              )}

              <p className="hidden min-w-0 truncate font-body text-sm text-[var(--text-secondary)] sm:block">
                {breadcrumb}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/*
                The avatar is the desktop route into the account menu.

                It was a plain <span>, and the only menu carrying Sign out was the
                mobile "More" sheet, which is `lg:hidden`. So on a desktop browser
                there was no way to reach Sign out at all — not a broken button,
                no button. Retailers share machines and offices, so leaving a
                session open with no way to end it is a privacy problem, not a
                missing feature.
              */}
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                title={email ?? undefined}
                className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-muted)] font-body text-sm font-semibold text-[var(--text-primary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]"
              >
                <span className="sr-only">Account menu, signed in as {displayName ?? email ?? 'you'}</span>
                {(displayName ?? email ?? 'V').charAt(0).toUpperCase()}
              </button>
            </div>
          </div>

          {/* PAGE CONTAINER — z-10 */}
          <main id="main-content" className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-8">
            {children}
          </main>
        </div>
      </div>

      {/* MOBILE TAB BAR — z-50 */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[var(--border-default)] bg-[var(--surface-panel)] pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${
                active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <item.icon />
              {item.shortLabel}
            </Link>
          );
        })}
        <button
          ref={sheetTriggerRef}
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${
            moreOpen ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
          }`}
        >
          <MoreIcon />
          More
        </button>
      </nav>

      {/* MORE SHEET — scrim z-[52], panel z-[55] */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-[52] bg-[rgba(36,42,39,0.42)] lg:hidden"
              aria-hidden="true"
            />
            {/*
              On desktop the same panel becomes a dropdown anchored to the avatar
              rather than a bottom sheet. A sheet is the right shape for a thumb
              on a phone and the wrong shape for a pointer on a desktop, and the
              `lg:hidden` on the sheet meant desktop had no account menu at all.
              The scrim stays mobile-only: a full-screen dismiss layer is not
              wanted behind a small menu.
            */}
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-label="Account menu"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed inset-x-0 bottom-0 z-[55] max-h-[80dvh] overflow-y-auto rounded-t-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-16 lg:z-[54] lg:max-h-[70vh] lg:w-80 lg:rounded-2xl lg:border lg:shadow-lg"
            >
              {/* The grab handle belongs to the bottom sheet, not to the desktop dropdown. */}
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-strong)] lg:hidden" aria-hidden="true" />

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-[var(--text-primary)]">
                    {displayName ?? email ?? 'Signed in'}
                  </p>
                  <p className="truncate font-body text-xs text-[var(--text-muted)]">
                    {activeShop?.name} · {activeShop?.role}
                  </p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]"
                >
                  <span className="sr-only">Close menu</span>
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-4 flex flex-col divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                {canSeeTeam && (
                  <SheetLink href="/app/team" onNavigate={() => setMoreOpen(false)}>
                    Team
                  </SheetLink>
                )}
                <SheetLink href="/app/settings" onNavigate={() => setMoreOpen(false)}>
                  Settings
                </SheetLink>
                <SheetLink href="/app/settings/privacy" onNavigate={() => setMoreOpen(false)}>
                  Privacy and data
                </SheetLink>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  className="flex min-h-12 items-center rounded-lg px-1 text-left font-body text-sm font-medium text-[var(--error)] transition-colors duration-[120ms] hover:text-[var(--error)] disabled:opacity-50"
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
                {/* Shown in the menu rather than a toast, so the reason is still
                    there after the menu closes. */}
                {signOutError && (
                  <p role="alert" className="px-1 text-xs leading-relaxed text-[var(--error)]">
                    {signOutError}
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SheetLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-12 items-center py-3 font-body text-sm font-medium text-[var(--text-primary)] transition-colors duration-[120ms] hover:text-[var(--accent)]"
    >
      {children}
    </Link>
  );
}

function buildBreadcrumb(pathname: string): string {
  if (pathname === '/app') return 'Overview';
  if (pathname.startsWith('/app/deals/new')) return 'Deals / New deal';
  if (pathname.startsWith('/app/deals/')) return 'Deals / Record';
  if (pathname === '/app/deals') return 'Deals';
  if (pathname === '/app/ask') return 'Ask Vendra';
  if (pathname === '/app/suppliers') return 'Suppliers';
  if (pathname === '/app/team') return 'Team';
  if (pathname === '/app/settings/privacy') return 'Settings / Privacy and data';
  if (pathname === '/app/settings') return 'Settings';
  return 'Vendra';
}

// ---------------------------------------------------------------------------
// Inline SVG icons only (FRONTEND_SPEC 4.2). All decorative.
// ---------------------------------------------------------------------------

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1V8.5Z" />
    </svg>
  );
}

function DealIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5v-9Z" />
      <path d="M7 9h6M7 12h4" />
    </svg>
  );
}

function AskIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M17 10.5c0 3-3.134 5.5-7 5.5-.76 0-1.494-.11-2.19-.31L4 17l1.2-2.9C4.42 13.28 4 11.94 4 10.5 4 7.5 7.134 5 11 5s6 2.5 6 5.5Z" />
    </svg>
  );
}

function SupplierIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3 6.5 10 3l7 3.5V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5Z" />
      <path d="M8 16v-4h4v4" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="7.5" cy="7" r="2.5" />
      <path d="M3 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
      <path d="M13.5 5.2a2.5 2.5 0 0 1 0 4.6M14 12.2c2 .4 3 1.7 3 3.8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="4" cy="10" r="1.4" fill="currentColor" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
      <circle cx="16" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="m4 6 3 3 3-3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}