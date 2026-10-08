import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { publicEnv } from '@/lib/env';

/**
 * Request-scoped Supabase client that carries the user's session cookies.
 *
 * This is the client every authenticated read must use, because RLS is
 * evaluated against the caller's identity. A service-role client bypasses RLS
 * and is reserved for the narrow operations listed in tenancy.ts.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = publicEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The middleware refreshes the
          // session, so a failure here is safe to ignore.
        }
      },
    },
  });
});