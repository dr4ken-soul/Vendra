import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AppShell } from '@/components/app/AppShell';
import { RouteEnter } from '@/components/marketing/Reveal';
import { requireUser, listMemberships } from '@/lib/tenancy';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: { default: 'Your shop', template: '%s · Vendra' },
  robots: { index: false, follow: false },
};

/**
 * Authenticated app shell layout.
 *
 * Derives every accessible shop from the session on the server. There is no
 * client-supplied shop list, so a client cannot widen its own scope.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/app');

  const memberships = await listMemberships(user.userId);

  if (memberships.length === 0) {
    redirect('/onboarding');
  }

  const shopIds = memberships.map((m) => m.shop_id);
  const supabase = await createClient();

  const [{ data: shopRows }, { data: profile }] = await Promise.all([
    supabase
      .from('shops')
      .select('id, name, memory_status, memory_custody_mode')
      .in('id', shopIds)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase.from('profiles').select('display_name').eq('id', user.userId).maybeSingle(),
  ]);

  const shops = (shopRows ?? []).map((shop) => {
    const membership = memberships.find((m) => m.shop_id === shop.id);
    return {
      id: shop.id as string,
      name: shop.name as string,
      role: (membership?.role ?? 'staff') as 'owner' | 'manager' | 'staff',
      permissions: membership?.permissions ?? [],
      memoryStatus: shop.memory_status as string,
    };
  });

  if (shops.length === 0) {
    redirect('/onboarding');
  }

  return (
    <AppShell
      shops={shops}
      activeShopId={shops[0].id}
      displayName={(profile as { display_name: string | null } | null)?.display_name ?? user.displayName}
      email={user.email}
    >
      <RouteEnter>{children}</RouteEnter>
    </AppShell>
  );
}