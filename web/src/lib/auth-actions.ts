'use server';

/**
 * Authentication server actions.
 *
 * These live outside app/api because a route handler cannot export server
 * actions: `useActionState` in the sign-in form needs a server action, and
 * importing one from a route module would pull server-only APIs into a client
 * bundle.
 */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { publicEnv } from '@/lib/env';
import { describeAuthError, type AuthFormState } from '@/lib/auth-errors';


const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z
    .string()
    .min(10, 'Choose a password of at least 10 characters.')
    .max(200, 'That password is too long.'),
  displayName: z
    .string()
    .trim()
    .max(80, 'That name is too long.')
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});

const verifyCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the six-digit code from your email.'),
});

const resendCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

/**
 * Build a Supabase client bound to the request cookies.
 *
 * Shared by sign-in, sign-up and code verification so all three read and write
 * the session in exactly the same way.
 */
async function sessionClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = publicEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check your details and try again.',
      message: null,
    };
  }

  const supabase = await sessionClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return {
        error:
          'That account still needs its email confirmed. Enter the six-digit code we sent, or send it again.',
        message: null,
        stage: 'code',
        email: parsed.data.email,
      };
    }

    return describeAuthError(error, 'signin');
  }

  revalidatePath('/', 'layout');
  return { error: null, message: null, stage: 'verified' };
}

/**
 * POST the verification code for a sign-up.
 *
 * The user is returned to the code step either way, including when the address is
 * already registered. Telling an anonymous visitor that a particular address has
 * an account would turn the sign-up form into an account-enumeration oracle.
 */
export async function resendCodeAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resendCodeSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the email address and try again.',
      message: null,
    };
  }

  const supabase = await sessionClient();

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl()}/auth/confirm` },
  });

  if (error && /already registered|already been registered/i.test(error.message)) {
    // Deliberately indistinguishable from success. See the note above.
    return { error: null, message: 'If that address needs a code, one is on its way.' };
  }

  if (error) return describeAuthError(error, 'resend');

  return { error: null, message: 'If that address needs a code, one is on its way.' };
}

/**
 * Exchange the six-digit code for a session.
 *
 * This is the whole point of the code flow: verification happens inside the app,
 * so a retailer is not sent out to an email client and back, and the code cannot
 * be forwarded to a different browser and silently accepted there.
 */
export async function verifyCodeAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = verifyCodeSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Enter the six-digit code.',
      message: null,
    };
  }

  const supabase = await sessionClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'signup',
  });

  if (error) return describeAuthError(error, 'verify');

  if (!data.session) {
    return {
      error: 'That code was accepted but did not start a session. Sign in with your password.',
      message: null,
    };
  }

  revalidatePath('/', 'layout');
  return { error: null, message: null, stage: 'verified' };
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName') || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check your details and try again.',
      message: null,
    };
  }

  const supabase = await sessionClient();
  const origin = siteUrl();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // The magic-link route is kept working. Some deployments turn email
      // confirmation off, and anyone who follows an old link should still land
      // somewhere sensible rather than on a dead page.
      emailRedirectTo: `${origin}/auth/confirm`,
      data: { display_name: parsed.data.displayName ?? null },
    },
  });

  if (error) {
    const exists = /already registered|already been registered/i.test(error.message);
    return {
      error: exists
        ? 'An account already uses that email address. Sign in instead.'
        : describeAuthError(error, 'signup').error,
      message: null,
    };
  }

  // When the project has email confirmation switched off, signUp hands back a
  // usable session and no code is ever sent. Detecting that here is what stops
  // the UI showing a code box for an email that will never arrive.
  if (data.session) {
    revalidatePath('/', 'layout');
    return { error: null, message: null, stage: 'verified' };
  }

  return {
    error: null,
    message: `Enter the six-digit code we sent to ${parsed.data.email}.`,
    stage: 'code',
    email: parsed.data.email,
  };
}
