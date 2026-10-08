import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { serverSupabaseEnv } from '@/lib/env';

/**
 * Service-role Supabase client.
 *
 * SECURITY: this bypasses Row Level Security. It is used only for operations
 * that a session-scoped client genuinely cannot perform, and every such call
 * site must pass a shop_id that was already derived from the caller's
 * membership. It must never be imported into a client component.
 *
 * Valid use:
 *   - writing walrus_memory_sync rows after a server-side memory job
 *   - creating a signed upload URL for a path the server already authorised
 *   - reading the auth user for an invitation
 *
 * Invalid use:
 *   - anything reachable from a component
 */
export function createAdminClient() {
  const { url, serviceRoleKey } = serverSupabaseEnv();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}