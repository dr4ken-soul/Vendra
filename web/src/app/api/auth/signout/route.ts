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
 *
 * This file lives at `api/auth/signout/route.ts` and must stay there.
 *
 * It previously sat at `api/auth/route.ts` while its own docstring said
 * `/api/auth/signout`, so the handler was mounted at `/api/auth` and the URL the
 * sign-out button calls returned 404. The button ignored the status, navigated
 * to /sign-in, and the middleware bounced the still-valid session straight back
 * into the app. To a user that reads as "sign out does nothing" — it looks like
 * the app refusing to let them out rather than a missing route.
 *
 * The call site now checks the response status instead of only catching network
 * failures, because a 404 is a successful fetch and so was never caught.
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