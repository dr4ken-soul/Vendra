import type { Metadata } from 'next';
import { requireShop, requireUser, can } from '@/lib/tenancy';
import { PrivacyView } from '@/components/app/PrivacyView';

export const metadata: Metadata = { title: 'Privacy and data' };
export const dynamic = 'force-dynamic';

export default async function PrivacySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const user = await requireUser('/app/settings/privacy');
  const params = await searchParams;
  const { shop, membership } = await requireShop(user.userId, params.shop, '/app/settings/privacy');

  const canExport = can(membership, 'privacy.export');
  const canErase = can(membership, 'privacy.erase');

  if (!canExport && !canErase) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
          You do not have permission to manage data requests
        </h1>
        <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Ask the shop owner or a manager.
        </p>
      </div>
    );
  }

  return (
    <PrivacyView shopId={shop.id} shopName={shop.name} canExport={canExport} canErase={canErase} />
  );
}