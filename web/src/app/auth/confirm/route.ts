import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { safeDestination } from '@/lib/auth-redirect';

/**
 * GET /auth/confirm
 *
 * Turns a link from an email into a session.
 *
 * Two link shapes arrive here, and both are supported:
 *
 *   token_hash + type   the template's own link. Self-contained, so it verifies
 *                        from any device, which is the whole point of sending a
 *                        code as well as a link.
 *
 *   code                 what Supabase appends after it has already verified a
 *                        token itself. Kept so links issued before this route
 *                        changed still work.
 *
 * Anything else, or a failure at either stage, lands on /sign-in with a sentence
 * that says what to do next. A silent failure here is indistinguishable from a
 * broken product, because the retailer is bounced out of their email client and
 * back into a page that looks unchanged.
 */

/** Only these OTP types are ever valid from a link. Anything else is a guess. */
const ALLOWED_TYPES = new Set<EmailOtpType>(['email', 'signup', 'invite', 'recovery', 'email_change']);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;

  const toSignIn = (reason: string) =>
    NextResponse.redirect(`${siteUrl}/sign-in?error=${encodeURIComponent(reason)}`);

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');
  const next = safeDestination(searchParams.get('next'));

  // Supabase reports its own failures in the query string when it has already
  // verified the token and is redirecting back. It is the only place those
  // reasons surface, and "expired" needs different wording from the rest.
  const errorCode = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  if (errorCode || errorDescription) {
    const reason = decodeURIComponent(errorDescription ?? errorCode ?? '');
    return toSignIn(
      /expired|invalid|token/i.test(reason)
        ? 'That confirmation link has expired or was already used. Sign in and we will send you a new one.'
        : 'We could not confirm that email address. Sign in and we will send you a new code.',
    );
  }

  const hasTokenHash = Boolean(tokenHash) && Boolean(type) && ALLOWED_TYPES.has(type as EmailOtpType);
  const hasCode = Boolean(code);

  if (!hasTokenHash && !hasCode) {
    return toSignIn('That link was incomplete. Sign in and we will send you a new code.');
  }

  const { supabaseUrl, supabaseAnonKey } = publicEnv();

  /**
   * Cookies are written onto the response being returned rather than through
   * `cookies()`. The session must be in the Set-Cookie header of this very
   * redirect; setting it through a separate store and then returning a different
   * response object is how the session gets dropped and the retailer lands on
   * /app unauthenticated with no error anywhere.
   */
  const response = NextResponse.redirect(`${siteUrl}${next}`);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          response.cookies.set(name, value);
        }
      },
    },
  });

  const { error } = hasTokenHash
    ? await supabase.auth.verifyOtp({
        token_hash: tokenHash as string,
        type: type as EmailOtpType,
      })
    : await supabase.auth.exchangeCodeForSession(code as string);

  if (error) {
    return toSignIn(
      /expired|invalid/i.test(error.message)
        ? 'That confirmation link has expired or was already used. Sign in and we will send you a new one.'
        : 'We could not confirm that email address. Sign in and we will send you a new code.',
    );
  }

  return response;
}