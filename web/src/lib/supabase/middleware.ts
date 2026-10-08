import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextResponse as NextResponseType } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Session refresh for the middleware.
 *
 * Supabase auth is cookie-based and the access token is short-lived, so the
 * middleware must refresh it on navigation. This is the only place that writes
 * auth cookies.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponseType,
): Promise<{
  user: { id: string } | null;
  shopHint: string | null;
  shouldRedirectToOnboarding: boolean;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Unconfigured environment. Leave navigation untouched rather than
    // redirecting a marketing page into a broken sign-in flow.
    return { user: null, shopHint: null, shouldRedirectToOnboarding: false };
  }

  let user: { id: string } | null = null;
  let shopHint: string | null = null;
  let hasShop = false;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser;

    if (currentUser) {
      const { data: membership } = await supabase
        .from('shop_memberships')
        .select('shop_id')
        .eq('user_id', currentUser.id)
        .is('revoked_at', null)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      hasShop = Boolean(membership);
      shopHint = membership?.shop_id ?? null;
    }
  } catch {
    // A transient auth failure must not break page rendering.
    user = null;
  }

  return { user, shopHint, shouldRedirectToOnboarding: Boolean(user) && !hasShop };
}