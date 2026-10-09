'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConfirmedMessage } from '@/components/auth/ConfirmedMessage';
import { Button } from '@/components/app/ui';
import { safeDestination } from '@/lib/auth-redirect';

/**
 * How long the acknowledgement stays up before continuing on its own.
 *
 * Long enough to be read. A redirect that lands in under roughly half a second is
 * indistinguishable from no redirect at all, which is the problem this screen
 * exists to solve, and the whole cost of it is this pause.
 */
const ADVANCE_AFTER_MS = 1400;

/**
 * The interstitial between "email confirmed" and the app.
 *
 * It continues on its own, and it always offers a visible button. Auto-advance is
 * a convenience, never the only way through: someone whose JavaScript is slow,
 * who prefers to read at their own pace, or who arrives with reduced motion must
 * never be stranded watching a screen that will not move on its own. The button
 * is present from first paint rather than appearing after the timer, so there is
 * no state in which the user has no way forward.
 */
export function ConfirmedTransition({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);

  const next = safeDestination(params.get('next'));

  useEffect(() => {
    searchParams.then(() => setReady(true));
  }, [searchParams]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => router.replace(next), ADVANCE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [ready, next, router]);

  const go = () => router.replace(next);

  return (
    <ConfirmedMessage
      detail="Setting up your shop. This will only take a moment."
    >
      <Button type="button" onClick={go} className="w-full">
        Continue
      </Button>
    </ConfirmedMessage>
  );
}