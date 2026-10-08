import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop, roleLabel } from '@/lib/tenancy';
import { updateMemberSchema } from '@/lib/validation';
import { defaultPermissionsForRole } from '@/lib/permissions';
import type { ShopMembership } from '@/lib/types';

interface RouteContext {
  params: Promise<{ memberId: string }>;
}

/**
 * PATCH /api/team/[memberId]
 * Change a member's role or explicit permissions. Requires team.manage.
 *
 * The shop owner can never be demoted or downgraded by this route.
 */
export const PATCH = withErrorHandling(async (request: Request, context: RouteContext) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`team:update:${user.userId}`, RATE_LIMITS.dealWrite);

  const { memberId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input = updateMemberSchema.parse(body);

  const ctx = await resolveShop(user.userId, typeof body.shopId === 'string' ? body.shopId : null);
  if (!ctx) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(ctx.membership, 'team.manage')) {
    throw ApiError.forbidden('You do not have permission to change access in this shop.');
  }

  const admin = createAdminClient();

  const { data: memberRow } = await admin
    .from('shop_memberships')
    .select('*')
    .eq('id', memberId)
    .eq('shop_id', ctx.shop.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (!memberRow) throw ApiError.notFound('That person is not in this shop.');

  const member = memberRow as ShopMembership;

  if (member.role === 'owner') {
    throw ApiError.forbidden('The shop owner\'s access cannot be changed here.');
  }

  const nextRole = input.role ?? member.role;
  const nextPermissions = input.permissions ?? defaultPermissionsForRole(nextRole);

  // A permission that outranks the granter's own role must not be grantable.
  if (!can(ctx.membership, 'privacy.erase') && nextPermissions.includes('privacy.erase')) {
    throw ApiError.forbidden('You cannot grant deletion access you do not hold.');
  }

  const { error } = await admin
    .from('shop_memberships')
    .update({ role: nextRole, permissions: nextPermissions })
    .eq('id', member.id)
    .eq('shop_id', ctx.shop.id);

  if (error) throw new Error(`Failed to update access: ${error.message}`);

  await admin.from('audit_events').insert({
    shop_id: ctx.shop.id,
    actor_user_id: user.userId,
    action: 'team.access_changed',
    target_type: 'shop_membership',
    target_id: member.id,
    metadata: { role: nextRole },
  });

  return NextResponse.json({
    member: { id: member.id, role: nextRole, roleLabel: roleLabel(nextRole), permissions: nextPermissions },
    message: `${roleLabel(nextRole)} access saved.`,
  });
});

/**
 * DELETE /api/team/[memberId]
 * Revoke access. Requires team.manage. Revocation sets revoked_at; the row is
 * retained for the audit trail.
 */
export const DELETE = withErrorHandling(async (request: Request, context: RouteContext) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`team:revoke:${user.userId}`, RATE_LIMITS.dealWrite);

  const { memberId } = await context.params;
  const shopHeader = request.headers.get('x-vendra-shop');
  const ctx = await resolveShop(user.userId, shopHeader);
  if (!ctx) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(ctx.membership, 'team.manage')) {
    throw ApiError.forbidden('You do not have permission to remove people from this shop.');
  }

  const admin = createAdminClient();

  const { data: memberRow } = await admin
    .from('shop_memberships')
    .select('*')
    .eq('id', memberId)
    .eq('shop_id', ctx.shop.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (!memberRow) throw ApiError.notFound('That person is not in this shop.');

  const member = memberRow as ShopMembership;

  if (member.role === 'owner') {
    throw ApiError.forbidden('The shop owner\'s access cannot be removed.');
  }

  if (member.user_id === user.userId) {
    throw ApiError.conflict('You cannot remove your own access while you manage this shop.');
  }

  const { error } = await admin
    .from('shop_memberships')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', member.id)
    .eq('shop_id', ctx.shop.id);

  if (error) throw new Error(`Failed to remove access: ${error.message}`);

  await admin.from('audit_events').insert({
    shop_id: ctx.shop.id,
    actor_user_id: user.userId,
    action: 'team.access_revoked',
    target_type: 'shop_membership',
    target_id: member.id,
    metadata: {},
  });

  return NextResponse.json({ message: 'Access removed.' });
});