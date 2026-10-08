import type { Metadata } from 'next';
import { requireShop, requireUser, can } from '@/lib/tenancy';
import { listSuppliers } from '@/lib/data/queries';
import { DealCaptureWizard } from '@/components/app/DealCaptureWizard';
import { todayInputValue } from '@/lib/format';

export const metadata: Metadata = { title: 'New deal' };
export const dynamic = 'force-dynamic';

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const user = await requireUser('/app/deals/new');
  const params = await searchParams;
  const { shop, membership } = await requireShop(user.userId, params.shop, '/app/deals/new');

  if (!can(membership, 'deal.create')) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
          You do not have permission to create deals
        </h1>
        <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Ask the shop owner or a manager to grant you deal creation access.
        </p>
      </div>
    );
  }

  const suppliers = await listSuppliers(shop.id);

  return (
    <DealCaptureWizard
      suppliers={suppliers.map((s) => ({
        id: s.id,
        shop_id: shop.id,
        display_name: s.displayName,
        phone: s.phone,
        notes: s.notes,
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      }))}
      shopId={shop.id}
      currencyCode={shop.currency_code}
      today={todayInputValue(shop.timezone)}
    />
  );
}