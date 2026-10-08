import type { Metadata } from 'next';
import { requireShop, requireUser, can, roleLabel } from '@/lib/tenancy';
import { createClient } from '@/lib/supabase/server';
import { SettingsView } from '@/components/app/SettingsView';
import { getMemoryCount, reconcilePendingWrites } from '@/lib/memory/service';
import { walrusEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const user = await requireUser('/app/settings');
  const params = await searchParams;
  const { shop, membership } = await requireShop(user.userId, params.shop, '/app/settings');

  // Promote finished memory writes so the panel shows an accurate state.
  await reconcilePendingWrites(shop.id);
  const count = await getMemoryCount(shop.id);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.userId)
    .maybeSingle();

  return (
    <SettingsView
      shopId={shop.id}
      initialShop={{
        name: shop.name,
        marketArea: shop.market_area,
        currencyCode: shop.currency_code,
        timezone: shop.timezone,
      }}
      memory={{
        memoryStatus: shop.memory_status,
        memoryStatusDetail: shop.memory_status_detail,
        custodyMode: shop.memory_custody_mode,
        walrusConfigured: walrusEnv() !== null,
        namespaceReady: Boolean(shop.walrus_namespace),
        providerStoredCount: count.count,
        providerCountKnown: count.known,
      }}
      canManageSettings={can(membership, 'settings.manage')}
      canManageTeam={can(membership, 'team.manage')}
      canExport={can(membership, 'privacy.export')}
      canErase={can(membership, 'privacy.erase')}
      displayName={(profile as { display_name: string | null } | null)?.display_name ?? user.displayName}
      email={user.email}
      roleLabel={roleLabel(membership.role)}
    />
  );
}