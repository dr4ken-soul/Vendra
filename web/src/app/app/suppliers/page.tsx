import type { Metadata } from 'next';
import { requireShop, requireUser, can } from '@/lib/tenancy';
import { listSuppliers } from '@/lib/data/queries';
import { SuppliersView } from '@/components/app/SuppliersView';

export const metadata: Metadata = { title: 'Suppliers' };
export const dynamic = 'force-dynamic';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const user = await requireUser('/app/suppliers');
  const params = await searchParams;
  const { shop, membership } = await requireShop(user.userId, params.shop, '/app/suppliers');

  if (!can(membership, 'deal.view')) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
          You do not have permission to view suppliers
        </h1>
      </div>
    );
  }

  const suppliers = await listSuppliers(shop.id);

  return (
    <SuppliersView
      initialSuppliers={suppliers}
      shopId={shop.id}
      canManage={can(membership, 'supplier.manage')}
    />
  );
}