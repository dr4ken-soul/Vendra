import type { Metadata } from 'next';
import { requireShop, requireUser, can } from '@/lib/tenancy';
import { createClient } from '@/lib/supabase/server';
import { TeamView } from '@/components/app/TeamView';
import { roleLabel } from '@/lib/tenancy';
import type { ShopMembership } from '@/lib/types';

export const metadata: Metadata = { title: 'Team' };
export const dynamic = 'force-dynamic';

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const user = await requireUser('/app/team');
  const params = await searchParams;
  const { shop, membership } = await requireShop(user.userId, params.shop, '/app/team');

  if (!can(membership, 'team.view')) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
          You do not have permission to see the team
        </h1>
        <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Ask the shop owner to grant you team access.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: membershipRows } = await supabase
    .from('shop_memberships')
    .select('id, user_id, role, permissions, joined_at, revoked_at')
    .eq('shop_id', shop.id)
    .is('revoked_at', null)
    .order('joined_at', { ascending: true });

  const rows = (membershipRows ?? []) as ShopMembership[];
  const userIds = rows.map((r) => r.user_id);

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

  const members = rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: nameById.get(row.user_id) ?? 'Team member',
    isYou: row.user_id === user.userId,
    role: row.role,
    roleLabel: roleLabel(row.role),
    permissions: row.permissions,
    joinedAt: row.joined_at,
  }));

  return (
    <TeamView initialMembers={members} shopId={shop.id} canManage={can(membership, 'team.manage')} />
  );
}