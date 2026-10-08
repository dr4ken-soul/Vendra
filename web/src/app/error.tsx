'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary.
 *
 * Copy names the operation that failed and the next step, per FRONTEND_SPEC 4.9,
 * and never leaks a stack trace or internal message to the retailer.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side detail only. No deal content, chat text or file contents.
    console.error('[vendra] route error', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--bg-primary)] px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 shadow-[var(--shadow-sm)] md:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Something went wrong
          </h1>
          <p role="alert" className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
            This page could not be loaded. Nothing you have saved has been lost. Try again — if it keeps
            happening, check your connection.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2.5 font-body text-sm font-semibold text-[var(--text-on-accent)] transition-colors duration-[120ms] hover:bg-[var(--accent-hover)]"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}