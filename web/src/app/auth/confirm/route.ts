import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';

/**
 * GET /auth/confirm
 *
 * Handles the email-confirmation callback. Supabase appends a code to the
 * redirect URL; it is exchanged for a session, which is then written to cookies
 * before continuing to the app.
 *
 * An invalid or expired link returns a readable explanation instead of a
 * silent failure.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const errorDescription = searchParams.get('error_description');
  const errorCode = searchParams.get('error');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;

  if (errorCode || errorDescription) {
    const reason = decodeURIComponent(errorDescription ?? errorCode ?? 'unknown error');
    return NextResponse.redirect(
      `${siteUrl}/sign-in?error=${encodeURIComponent(
        reason.includes('expired') || reason.includes('Email link')
          ? 'That confirmation link has expired. Request a new one and try again.'
          : 'We could not confirm that email address. Try signing in instead.',
      )}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/sign-in`);
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/sign-in?error=${encodeURIComponent(
        'That confirmation link could not be used. Request a new one and try again.',
      )}`,
    );
  }

  // Only same-origin relative paths are honoured.
  const destination =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';

  return NextResponse.redirect(`${siteUrl}${destination}`);
}