import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ApiError, RATE_LIMITS, rateLimit, withErrorHandling } from '@/lib/api';
import { can, getUser, resolveShop } from '@/lib/tenancy';
import { inviteMemberSchema } from '@/lib/validation';
import { defaultPermissionsForRole } from '@/lib/permissions';
import { roleLabel } from '@/lib/tenancy';
import type { ShopMembership, ShopRole } from '@/lib/types';

/**
 * GET /api/team
 * Shop member with team.view. Returns the roster for one shop.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`team:list:${user.userId}`, RATE_LIMITS.list);

  const shopHint = new URL(request.url).searchParams.get('shop');
  const context = await resolveShop(user.userId, shopHint);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'team.view')) throw ApiError.forbidden();

  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from('shop_memberships')
    .select('id, user_id, role, permissions, joined_at, revoked_at')
    .eq('shop_id', context.shop.id)
    .is('revoked_at', null)
    .order('joined_at', { ascending: true });

  const rows = (memberships ?? []) as ShopMembership[];
  const userIds = rows.map((m) => m.user_id);

  // Display names live in profiles, emails in auth. Neither is exposed to
  // members without team.view.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const nameById = new Map(
    ((profiles ?? []) as Array<{ id: string; display_name: string | null }>).map((p) => [
      p.id,
      p.display_name,
    ]),
  );

  const members = rows.map((m) => ({
    id: m.id,
    userId: m.user_id,
    displayName: nameById.get(m.user_id) ?? 'Team member',
    isYou: m.user_id === user.userId,
    role: m.role,
    roleLabel: roleLabel(m.role),
    permissions: m.permissions,
    joinedAt: m.joined_at,
  }));

  return NextResponse.json({
    members,
    canManage: can(context.membership, 'team.manage'),
  });
});

/**
 * POST /api/team
 * Invite a member by email. Requires team.manage.
 *
 * A supplier is never granted access through an invitation; there is no
 * supplier role in V1.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getUser();
  if (!user) throw ApiError.unauthorized();
  rateLimit(`team:invite:${user.userId}`, RATE_LIMITS.dealWrite);

  const body = await request.json().catch(() => ({}));
  const input = inviteMemberSchema.parse(body);

  const context = await resolveShop(user.userId, typeof body.shopId === 'string' ? body.shopId : null);
  if (!context) throw ApiError.forbidden('You do not have access to that shop.');
  if (!can(context.membership, 'team.manage')) {
    throw ApiError.forbidden('You do not have permission to invite people to this shop.');
  }

  const admin = createAdminClient();

  // Look up the auth user by email. This is the only reason the admin client is
  // needed on the team path.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Failed to look up the account: ${listError.message}`);
  }

  const target = list.users.find(
    (candidate) => candidate.email?.toLowerCase() === input.email,
  );

  if (!target) {
    throw ApiError.validation(
      'No Vendra account uses that email address yet.',
      { email: 'Ask them to create a Vendra account first, then invite them again.' },
    );
  }

  if (target.id === user.userId) {
    throw ApiError.conflict('You are already in this shop.');
  }

  const { data: existing } = await admin
    .from('shop_memberships')
    .select('id, revoked_at')
    .eq('shop_id', context.shop.id)
    .eq('user_id', target.id)
    .maybeSingle();

  if (existing && !existing.revoked_at) {
    throw ApiError.conflict('That person is already in this shop.');
  }

  const permissions = defaultPermissionsForRole(input.role as ShopRole);

  if (existing) {
    await admin
      .from('shop_memberships')
      .update({ role: input.role, permissions, revoked_at: null, invited_by: user.userId })
      .eq('id', existing.id);
  } else {
    await admin.from('shop_memberships').insert({
      shop_id: context.shop.id,
      user_id: target.id,
      role: input.role,
      permissions,
      invited_by: user.userId,
    });
  }

  await admin.from('audit_events').insert({
    shop_id: context.shop.id,
    actor_user_id: user.userId,
    action: 'team.invited',
    target_type: 'shop_membership',
    target_id: existing?.id ?? null,
    metadata: { role: input.role },
  });

  return NextResponse.json(
    {
      member: {
        userId: target.id,
        role: input.role,
        roleLabel: roleLabel(input.role),
        permissions,
      },
      message: `${input.email} now has ${roleLabel(input.role).toLowerCase()} access to this shop.`,
    },
    { status: 201 },
  );
});