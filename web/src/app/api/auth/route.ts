import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ApiError, withErrorHandling } from '@/lib/api';
import { publicEnv } from '@/lib/env';

/**
 * POST /api/auth/signout
 *
 * Ends the session and clears the auth cookies. The sign-in server actions live
 * in src/lib/auth-actions.ts, because a route handler cannot export server
 * actions.
 */
export const POST = withErrorHandling(async () => {
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

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[vendra] sign out failed', error.message);
    throw ApiError.unavailable('Signing out', 'The session could not be closed. Try again.');
  }

  revalidatePath('/', 'layout');

  return NextResponse.json({ ok: true });
});