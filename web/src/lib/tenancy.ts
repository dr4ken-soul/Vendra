import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Shop, ShopMembership, ShopPermission, ShopRole } from '@/lib/types';

/**
 * Tenant scope derivation.
 *
 * The rule from DATA_API_CONTRACTS.md section 1 and PRIVACY_SECURITY.md
 * section 4: the server derives accessible shop_id values from the
 * authenticated session and shop membership. A client-supplied shop_id is never
 * trusted for authorisation.
 */

export interface ShopContext {
  shop: Shop;
  membership: ShopMembership;
}

export interface UserContext {
  userId: string;
  email: string | null;
  displayName: string | null;
}

/** Resolve the authenticated user, or null. Never throws. */
export async function getUser(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    displayName:
      (typeof user.user_metadata?.display_name === 'string'
        ? user.user_metadata.display_name
        : null) || null,
  };
}

/** Require a signed-in user or redirect to sign-in with a safe return path. */
export async function requireUser(returnTo?: string): Promise<UserContext> {
  const user = await getUser();
  if (!user) {
    const target = returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : '/sign-in';
    redirect(target);
  }
  return user;
}

/**
 * Every active membership the signed-in user holds.
 * This is the only source of shop scope in the application.
 */
export async function listMemberships(userId: string): Promise<ShopMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shop_memberships')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load memberships: ${error.message}`);
  }
  return (data ?? []) as ShopMembership[];
}

export async function hasActiveShop(userId: string): Promise<boolean> {
  const memberships = await listMemberships(userId);
  return memberships.length > 0;
}

/**
 * Resolve a single authorised shop for this request.
 *
 * `requestedShopId` comes from a route segment or query string. It is used only
 * to select among shops the user is ALREADY a member of. A foreign id resolves
 * to null rather than to that shop, so a client cannot widen its scope by
 * guessing a UUID.
 */
export async function resolveShop(
  userId: string,
  requestedShopId?: string | null,
): Promise<ShopContext | null> {
  const memberships = await listMemberships(userId);

  if (memberships.length === 0) return null;

  const membership = requestedShopId
    ? memberships.find((m) => m.shop_id === requestedShopId)
    : memberships[0];

  if (!membership) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', membership.shop_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  return { shop: data as Shop, membership };
}

/** Require an authorised shop, redirecting to onboarding when none exists. */
export async function requireShop(
  userId: string,
  requestedShopId?: string | null,
  returnTo?: string,
): Promise<ShopContext> {
  const context = await resolveShop(userId, requestedShopId);

  if (!context) {
    if (await hasActiveShop(userId)) {
      // The user has shops, but not the requested one. Do not leak whether the
      // id exists; treat it as unauthorised and send them to their own shop.
      redirect('/app?denied=shop');
    }
    redirect(`/onboarding${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
  }

  return context;
}

/** Permission check. Used to hide unavailable actions; RLS enforces the truth. */
export function can(
  membership: ShopMembership,
  permission: ShopPermission,
): boolean {
  return membership.permissions.includes(permission);
}

export function canAny(
  membership: ShopMembership,
  permissions: ShopPermission[],
): boolean {
  return permissions.some((permission) => membership.permissions.includes(permission));
}

export function isAdmin(membership: ShopMembership): boolean {
  return membership.role === 'owner' || membership.role === 'manager';
}

export function roleLabel(role: ShopRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'manager':
      return 'Manager';
    case 'staff':
      return 'Staff';
  }
}

/** Human summary of what a role can do, shown in the invite dialog. */
export function describeRole(role: ShopRole): string {
  switch (role) {
    case 'owner':
      return 'Full access, including team management, shop settings and data deletion requests.';
    case 'manager':
      return 'Can record deals, manage the team and change shop settings. Cannot authorise shop deletion.';
    case 'staff':
      return 'Can view and record deals, attach evidence and use Ask Vendra. Cannot manage the team or settings.';
  }
}