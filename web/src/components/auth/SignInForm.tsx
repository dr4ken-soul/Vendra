'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInAction, signUpAction, type AuthFormState } from '@/lib/auth-actions';
import { Button, Field, TextInput, ErrorMessage, SuccessMessage } from '@/components/app/ui';

const INITIAL: AuthFormState = { error: null, message: null };

/**
 * /sign-in (FRONTEND_SPEC 4.4)
 *
 * ONE auth method is rendered — password and email confirmation. No provider
 * chooser, because the pilot uses a single configured method.
 */
export function SignInForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [signInState, signInFormAction, signInPending] = useActionState(signInAction, INITIAL);
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, INITIAL);

  const bannerError = searchParams.get('error');
  const returnTo = searchParams.get('returnTo');
  const pending = mode === 'sign-in' ? signInPending : signUpPending;
  const state = mode === 'sign-in' ? signInState : signUpState;

  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--bg-primary)] px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Link
          href="/"
          className="mb-8 block text-center font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]"
        >
          Vendra
        </Link>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 shadow-[var(--shadow-sm)] md:p-8">
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

              {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Signing in…' : 'Sign in'}
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

              {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
              {state.message && <SuccessMessage>{state.message}</SuccessMessage>}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Creating your account…' : 'Create an account'}
              </Button>
            </form>
          )}

          <p className="mt-6 font-body text-sm text-[var(--text-secondary)]">
            {mode === 'sign-in' ? (
              <>
                New to Vendra?{' '}
                <button
                  type="button"
                  onClick={() => setMode('sign-up')}
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
        </div>

        <p className="mt-6 font-body text-xs leading-relaxed text-[var(--text-muted)]">
          Your shop’s supplier history stays private by default. Staff access is granted only by the shop owner.
          Read the{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--accent)]">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </main>
  );
}