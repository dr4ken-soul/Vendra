import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Refresh the Supabase session and gate the authenticated surface.
 *
 * The middleware improves the session; it is NOT the authorisation boundary.
 * Every protected route re-derives tenant scope on the server, because a
 * middleware match alone would not stop a direct API call.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const {
    user,
    shopHint,
    shouldRedirectToOnboarding,
  } = await updateSession(request, response);

  const { pathname, search } = request.nextUrl;

  const isAppRoute = pathname.startsWith('/app');
  const isOnboarding = pathname.startsWith('/onboarding');
  const isAuthRoute = pathname.startsWith('/sign-in') || pathname.startsWith('/auth');

  // Unauthenticated users cannot reach the app surface.
  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // A signed-in user with no shop belongs in onboarding, not the app.
  if (isAppRoute && user && shouldRedirectToOnboarding) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding';
    url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (isOnboarding && user && !shouldRedirectToOnboarding) {
    const url = request.nextUrl.clone();
    // The query string must be assigned to `search`, never interpolated into
    // `pathname`. Putting it in the pathname percent-encodes the "?", so the
    // browser is sent to /app%3Fshop=<id>, which does not exist, and the
    // retailer lands on the not-found page immediately after finishing
    // onboarding.
    url.pathname = '/app';
    url.search = shopHint ? `?shop=${encodeURIComponent(shopHint)}` : '';
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user && pathname === '/sign-in') {
    const returnTo = request.nextUrl.searchParams.get('returnTo');
    // Only same-origin relative paths are honoured, so a crafted link cannot
    // bounce a signed-in user to another site.
    const safe = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;
    const url = request.nextUrl.clone();
    url.pathname = safe ?? '/app';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files. API routes are excluded
     * here on purpose: they perform their own auth and tenant derivation and
     * must not depend on middleware for correctness.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|woff2?)$).*)',
  ],
};