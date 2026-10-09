'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  signInAction,
  signUpAction,
  verifyCodeAction,
  resendCodeAction,
} from '@/lib/auth-actions';
import type { AuthFormState } from '@/lib/auth-errors';
import { Button, Field, TextInput, ErrorMessage, SuccessMessage, InfoMessage } from '@/components/app/ui';
import { OtpInput, codeDigits } from '@/components/auth/OtpInput';
import { ConfirmedMessage } from '@/components/auth/ConfirmedMessage';
import { isEmailShaped, safeDestination } from '@/lib/auth-redirect';

const INITIAL: AuthFormState = { error: null, message: null, stage: 'details' };

/** Seconds the resend button stays disabled after a code is sent. */
const RESEND_COOLDOWN = 60;

/**
 * How long the confirmation stays on screen before the router moves on.
 *
 * Shorter than the interstitial's pause, because the retailer is already looking
 * at this panel and has watched it change; the acknowledgement is a beat, not a
 * screen they need to read.
 */
const CONFIRMED_HOLD_MS = 900;

/**
 * Resend control with its own cooldown.
 *
 * It owns the countdown so the timer starts on mount, which is a legitimate use
 * of an effect: subscribing to time passing. Doing this in the parent instead
 * meant setState inside an effect every time the server action returned, which
 * cascades renders and is the pattern React's own lint rule warns about.
 *
 * It is keyed by the caller on the code address and the last resend result, so a
 * successful resend remounts it and the timer starts over as a matter of course.
 */
function ResendCodeButton({
  action,
  email,
}: {
  action: (formData: FormData) => void;
  email: string;
}) {
  const [pending, setPending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <form
      action={action}
      onSubmit={() => {
        setPending(true);
      }}
    >
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={secondsLeft > 0 || pending}
        className="text-sm font-semibold text-[var(--accent)] underline underline-offset-2 transition-colors hover:text-[var(--accent-hover)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:no-underline"
      >
        {secondsLeft > 0
          ? `Send a new code in ${secondsLeft}s`
          : pending
            ? 'Sending…'
            : 'Send a new code'}
      </button>
    </form>
  );
}

/**
 * /sign-in (FRONTEND_SPEC 4.4)
 *
 * ONE auth method: email and password. No provider chooser, because the pilot
 * uses a single configured method.
 *
 * Sign-up is a two-step flow inside this page rather than a link in an email.
 * After the account is created the retailer types a six-digit code here, so they
 * never leave the app and the code cannot be forwarded to another browser and
 * silently accepted there. The emailed magic link still works, for anyone who
 * follows one.
 *
 * Two things this deliberately does not do:
 *
 *   - it does not store the address in localStorage. The address is derived from
 *     the server action's own return value, so it cannot be tampered with from
 *     the console, and it does not outlive the tab that received it.
 *
 *   - it does not tell an anonymous visitor that a particular address already has
 *     an account. That would turn this form into an account-enumeration oracle.
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [signInState, signInFormAction, signInPending] = useActionState(signInAction, INITIAL);
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, INITIAL);
  const [verifyState, verifyFormAction, verifyPending] = useActionState(verifyCodeAction, INITIAL);
  const [resendState, resendFormAction] = useActionState(resendCodeAction, INITIAL);

  const bannerError = searchParams.get('error');

  const [code, setCode] = useState('');
  // The only thing "Start again" needs to do is stop deriving the code step. The
  // address and the step itself come from the server action, not from local state.
  const [codeStepDismissed, setCodeStepDismissed] = useState(false);
  const submitRef = useRef<HTMLFormElement>(null);

  /** Digits only. `code` stays fixed width so clearing a middle box does not shift the rest. */
  const codeDigitsOnly = codeDigits(code);

  /**
   * A session now exists. Acknowledge it, then go.
   *
   * Routing immediately meant the panel the retailer had just filled in was
   * replaced by the app in the same frame the server action returned, so a
   * correct code produced no visible success at all — indistinguishable from the
   * form simply clearing. `verified` holds the confirmation on screen long enough
   * to read, and only then refreshes and navigates.
   */
  const sessionReady =
    signInState.stage === 'verified' || verifyState.stage === 'verified' || signUpState.stage === 'verified';

  useEffect(() => {
    if (!sessionReady) return;

    const timer = setTimeout(() => {
      router.refresh();
      router.push(safeDestination(returnTo));
    }, CONFIRMED_HOLD_MS);

    return () => clearTimeout(timer);
  }, [sessionReady, router, returnTo]);

  const verified = sessionReady;

  const requestedStage = signUpState.stage === 'code' ? signUpState : signInState.stage === 'code' ? signInState : null;
  const actionCodeEmail = requestedStage?.email ?? null;

  /**
   * The code step also has to be reachable by URL.
   *
   * It used to exist only as server-action state in the tab that happened to run
   * the sign-up, which meant the email's "enter this code" had nowhere to point.
   * Open the email on a phone, or refresh, or use a different browser, and the
   * code box was gone with no way back to it — the retailer had the code and no
   * field to put it in. The email links here as `/sign-in?email=…&code=1`, so
   * the fallback is only worth offering if it actually opens.
   *
   * A shape check, not a validity check. Nothing is revealed about whether the
   * address has an account: the page shows a code box either way, and verification
   * fails generically.
   */
  const emailParam = searchParams.get('email');
  const urlCodeEmail =
    searchParams.get('code') === '1' && isEmailShaped(emailParam) ? emailParam : null;

  // A fresh action result wins, so a resend for a different address is honoured.
  const codeEmail = actionCodeEmail ?? urlCodeEmail;
  const onCodeStep = codeEmail !== null && !codeStepDismissed;

  const busy = signInPending || signUpPending || verifyPending;
  const codeError = verifyState.error;

  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--bg-primary)] px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Link
          href="/"
          className="mb-8 block text-center font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]"
        >
          Vendra
        </Link>

        <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 shadow-[var(--shadow-sm)] md:p-8">
          <AnimatePresence mode="wait" initial={false}>
            {verified ? (
              /* ------------------------------------------------------ CONFIRMED */
              <motion.div
                key="confirmed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/*
                  The code path renders the acknowledgement in place rather than
                  navigating to /auth/confirmed. The retailer is already looking at
                  this panel, having just pressed its button, and swapping the page
                  out from under them hides the thing they just did. A full-screen
                  takeover is for arriving from an email client; here the panel they
                  were working in becomes the confirmation.
                */}
                <ConfirmedMessage compact detail="Taking you to your shop…" />
              </motion.div>
            ) : onCodeStep ? (
              /* ---------------------------------------------------------- CODE */
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex flex-col items-center text-center">
                  <span
                    aria-hidden="true"
                    className="mb-5 grid size-12 place-items-center rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" />
                      <path d="m3.5 7 8.5 6 8.5-6" />
                    </svg>
                  </span>

                  <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    Check your email
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    We sent a six-digit code to{' '}
                    <span className="font-medium text-[var(--text-primary)]">{codeEmail}</span>.
                    Enter it here to finish creating your account.
                  </p>
                </div>

                <form action={verifyFormAction} className="mt-6 flex flex-col gap-5" ref={submitRef}>
                  <input type="hidden" name="email" value={codeEmail ?? ''} />
                  {/* The hidden field is what the server actually reads, and it
                      carries digits only. */}
                  <input type="hidden" name="code" value={codeDigitsOnly} />

                  <OtpInput
                    value={code}
                    onChange={setCode}
                    onComplete={() => {
                      // Submitting from here means the retailer never has to find
                      // the button. The form posts the same action either way.
                      requestAnimationFrame(() => submitRef.current?.requestSubmit());
                    }}
                    disabled={verifyPending}
                    invalid={Boolean(codeError)}
                    errorText={verifyState.error}
                  />

                  <Button type="submit" disabled={verifyPending || codeDigitsOnly.length !== 6} className="w-full">
                    {verifyPending ? 'Checking your code…' : 'Verify and continue'}
                  </Button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-3">
                  <ResendCodeButton
                    key={`${codeEmail}:${resendState.message ?? ''}:${resendState.error ?? ''}`}
                    action={resendFormAction}
                    email={codeEmail ?? ''}
                  />

                  {resendState.message && <p className="text-sm text-[var(--text-secondary)]">{resendState.message}</p>}
                  {resendState.error && <ErrorMessage>{resendState.error}</ErrorMessage>}
                </div>

                <div className="mt-6">
                  <InfoMessage>
                    The code stops working after 30 minutes. If it does not arrive, check your spam folder
                    before asking for another one.
                  </InfoMessage>
                </div>

                <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
                  Wrong address?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setCodeStepDismissed(true);
                      setCode('');
                      // Drop the query as well, so a refresh does not walk
                      // straight back into the code step just abandoned.
                      router.replace(returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : '/sign-in');
                    }}
                    className="font-semibold text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-hover)]"
                  >
                    Start again
                  </button>
                </p>
              </motion.div>
            ) : (
              /* ------------------------------------------------------- DETAILS */
              <motion.div
                key="details"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {mode === 'sign-in' ? 'Sign in to Vendra' : 'Create a Vendra account'}
                </h1>
                <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                  {mode === 'sign-in'
                    ? 'Keep your shop’s supplier deals together, from quote to resolution.'
                    : 'Set up your shop and start recording supplier deals from quote to resolution.'}
                </p>

                {bannerError && (
                  <div className="mt-5">
                    <ErrorMessage>{bannerError}</ErrorMessage>
                  </div>
                )}

                {mode === 'sign-in' ? (
                  <form action={signInFormAction} className="mt-6 flex flex-col gap-4">
                    {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

                    <Field label="Email address" htmlFor="email" required>
                      <TextInput
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        defaultValue={urlCodeEmail ?? ''}
                        placeholder="you@yourshop.com"
                      />
                    </Field>

                    <Field label="Password" htmlFor="password" required>
                      <TextInput
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                      />
                    </Field>

                    {signInState.error && <ErrorMessage>{signInState.error}</ErrorMessage>}

                    <Button type="submit" disabled={signInPending} className="w-full">
                      {signInPending ? 'Signing in…' : 'Sign in'}
                    </Button>
                  </form>
                ) : (
                  <form action={signUpFormAction} className="mt-6 flex flex-col gap-4">
                    {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

                    <Field label="Your name" htmlFor="displayName" help="Optional. Used to label your activity.">
                      <TextInput id="displayName" name="displayName" autoComplete="name" />
                    </Field>

                    <Field label="Email address" htmlFor="email" required>
                      <TextInput
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        defaultValue={urlCodeEmail ?? ''}
                        placeholder="you@yourshop.com"
                      />
                    </Field>

                    <Field
                      label="Password"
                      htmlFor="password"
                      required
                      help="At least 10 characters."
                    >
                      <TextInput
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
                        required
                      />
                    </Field>

                    {signUpState.error && <ErrorMessage>{signUpState.error}</ErrorMessage>}
                    {signUpState.message && !signUpState.error && (
                      <SuccessMessage>{signUpState.message}</SuccessMessage>
                    )}

                    <Button type="submit" disabled={signUpPending} className="w-full">
                      {signUpPending ? 'Creating your account…' : 'Create an account'}
                    </Button>
                  </form>
                )}

                <p className="mt-6 font-body text-sm text-[var(--text-secondary)]">
                  {mode === 'sign-in' ? (
                    <>
                      New to Vendra?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('sign-up');
                          setCodeStepDismissed(false);
                          setCode('');
                        }}
                        className="font-semibold text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-hover)]"
                      >
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => setMode('sign-in')}
                        className="font-semibold text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-hover)]"
                      >
                        Back to sign in
                      </button>
                    </>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 font-body text-xs leading-relaxed text-[var(--text-muted)]">
          Your shop’s supplier history stays private by default. Staff access is granted only by the shop owner.
          Read the{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--accent)]">
            privacy notice
          </Link>
          .
        </p>

        {busy && <span className="sr-only" role="status">Working…</span>}
      </div>
    </main>
  );
}
