import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ConfirmedTransition } from '@/components/auth/ConfirmedTransition';

export const metadata: Metadata = {
  title: 'Email confirmed',
  robots: { index: false, follow: false },
};

/**
 * GET /auth/confirmed?next=/app
 *
 * Where the confirmation link lands after the session exists.
 *
 * The interstitial exists because the alternative was a redirect with no
 * acknowledgement: the retailer clicks a link, the browser swaps to the app, and
 * nothing ever says the click worked. Someone who clicked from an email client
 * cannot tell a successful verification from a slow page, and the natural reading
 * of an instant change is that something went wrong and they should click again.
 *
 * `next` is already reduced to a same-origin relative path by the route that
 * redirects here, so it is safe to carry, but it is reduced again on arrival
 * rather than trusting the previous hop.
 */
export default function AuthConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--bg-primary)]" />}>
      <ConfirmedTransition searchParams={searchParams} />
    </Suspense>
  );
}