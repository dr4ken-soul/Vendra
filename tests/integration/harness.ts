/**
 * Shared harness for tests that exercise the real Supabase project.
 *
 * These tests need live credentials. When they are absent the suite SKIPS with
 * a clear message rather than passing silently, so a green run never hides an
 * untested isolation guarantee.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

export interface Harness {
  admin: SupabaseClient;
  available: boolean;
  reason: string;
}

/**
 * Load the same environment the app uses.
 *
 * Vitest runs with web/ as its root, so paths are resolved from the current
 * working directory rather than from import.meta.url, which yields a malformed
 * path on Windows.
 */
export function loadEnv(): Record<string, string> {
  const merged: Record<string, string> = { ...(process.env as Record<string, string>) };

  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!merged[key] || merged[key] === '') merged[key] = value;
      }
      break;
    } catch {
      // Environment files are optional for pure unit tests.
    }
  }

  return merged;
}

export function createHarness(): Harness {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      admin: null as unknown as SupabaseClient,
      available: false,
      reason:
        'Live Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY in web/.env.local to run the tenant-isolation suite.',
    };
  }

  return {
    admin: createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    available: true,
    reason: 'ok',
  };
}

/** Create an auth user and return its id. */
export async function createTestUser(
  admin: SupabaseClient,
  label: string,
): Promise<{ id: string; email: string }> {
  const email = `vendra-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    // Strong enough for the project's minimum password policy; not a real
    // credential for anything.
    password: `Vendra-${Math.random().toString(36).slice(2)}-${label}-Aa1!`,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message ?? 'unknown error'}`);
  }

  return { id: data.user.id, email };
}

/** Remove every row this harness created, in dependency order. */
export async function cleanup(admin: SupabaseClient, shopIds: string[], userIds: string[]): Promise<void> {
  for (const shopId of shopIds) {
    // Children first. deal_events and memberships have append-only triggers,
    // so the service role's DELETE is blocked on purpose for those tables and
    // the shop soft-delete below is the supported teardown path.
    await admin.from('data_requests').delete().eq('shop_id', shopId);
    await admin.from('audit_events').delete().eq('shop_id', shopId);
    await admin.from('assistant_messages').delete().eq('shop_id', shopId);
    await admin.from('assistant_sessions').delete().eq('shop_id', shopId);
    await admin.from('walrus_memory_sync').delete().eq('shop_id', shopId);
    await admin.from('evidence_files').delete().eq('shop_id', shopId);
    await admin.from('deal_lines').delete().eq('shop_id', shopId);
    await admin.from('deals').delete().eq('shop_id', shopId);
    await admin.from('suppliers').delete().eq('shop_id', shopId);
    await admin.from('shop_memberships').delete().eq('shop_id', shopId);
    await admin.from('shops').delete().eq('id', shopId);
  }

  for (const userId of userIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

/** Set a JWT role/claims so a client can impersonate a user for RLS tests. */
export async function sessionClientFor(
  admin: SupabaseClient,
  userId: string,
  accessToken: string,
): Promise<SupabaseClient> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient: create } = await import('@supabase/supabase-js');
  const env = loadEnv();

  void admin;

  return create(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}