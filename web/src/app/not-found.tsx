import Link from 'next/link';

/**
 * Not found.
 *
 * A deal, supplier or shop in another workspace returns the same page as one
 * that does not exist, so a guessed identifier cannot be used to discover that
 * a record exists somewhere else.
 */
export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--bg-primary)] px-4 py-10">
      <div className="w-full max-w-[440px] text-center">
        <Link
          href="/"
          className="mb-8 block font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]"
        >
          Vendra
        </Link>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 shadow-[var(--shadow-sm)] md:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            We couldn’t find that
          </h1>
          <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
            The page or record you were looking for is not available. It may belong to a different shop, or it may
            have been removed.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/app/deals"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2.5 font-body text-sm font-semibold text-[var(--text-on-accent)] transition-colors duration-[120ms] hover:bg-[var(--accent-hover)]"
            >
              Go to your deals
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-panel)] px-5 py-2.5 font-body text-sm font-semibold text-[var(--text-primary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]"
            >
              Back to the home page
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}