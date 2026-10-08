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

export interface AuthFormState {
  error: string | null;
  message: string | null;
}

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

  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = publicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Reported in plain language without revealing whether an address exists.
    const invalid = /invalid login credentials/i.test(error.message);
    const unconfirmed = /email not confirmed/i.test(error.message);
    const rateLimited = /rate limit|too many/i.test(error.message);

    return {
      error: invalid
        ? 'That email and password did not match. Check them and try again.'
        : unconfirmed
          ? 'Confirm your email address first. Check your inbox for the link we sent.'
          : rateLimited
            ? 'Too many attempts. Wait a minute and try again.'
            : 'We could not sign you in just now. Try again.',
      message: null,
    };
  }

  revalidatePath('/', 'layout');
  return { error: null, message: null };
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

  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = publicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: { display_name: parsed.data.displayName ?? null },
    },
  });

  if (error) {
    const exists = /already registered|already been registered/i.test(error.message);
    return {
      error: exists
        ? 'An account already uses that email address. Sign in instead.'
        : 'We could not create that account just now. Try again.',
      message: null,
    };
  }

  return {
    error: null,
    message: 'Account created. Check your email for a confirmation link, then sign in.',
  };
}