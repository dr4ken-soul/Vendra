import type { Metadata } from 'next';
import { requireShop, requireUser, can } from '@/lib/tenancy';
import { listDeals } from '@/lib/data/queries';
import { listSuppliers } from '@/lib/data/queries';
import { createClient } from '@/lib/supabase/server';
import { DealsRegister } from '@/components/app/DealsRegister';
import { PageHeader, LinkButton } from '@/components/app/ui';

export const metadata: Metadata = { title: 'Deals' };
export const dynamic = 'force-dynamic';

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; q?: string; status?: string; supplier?: string; from?: string; to?: string; page?: string }>;
}) {
  const user = await requireUser('/app/deals');
  const params = await searchParams;
  const { shop, membership } = await requireShop(user.userId, params.shop, '/app/deals');

  const [result, suppliers] = await Promise.all([
    listDeals(shop.id, {
      q: params.q,
      status: params.status as never,
      supplierId: params.supplier,
      from: params.from,
      to: params.to,
      page: params.page ? Number.parseInt(params.page, 10) : 1,
      pageSize: 20,
    }),
    listSuppliers(shop.id),
  ]);

  const canCreate = can(membership, 'deal.create');

  // Preserve the current filter string so returning from a deal restores state.
  const filterQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'shop' && value) filterQuery.set(key, value);
  }
  const returnQuery = filterQuery.toString();

  void createClient;

  return (
    <>
      <PageHeader
        headingId="page-heading"
        title="Deals"
        description="Search the quotes, terms, deliveries and outcomes your shop has recorded."
        actions={canCreate ? <LinkButton href="/app/deals/new">New deal</LinkButton> : undefined}
      />

      <DealsRegister
        initialDeals={result.items}
        suppliers={suppliers.map((s) => ({ id: s.id, displayName: s.displayName }))}
        shopId={shop.id}
        canCreate={canCreate}
        returnQuery={returnQuery}
        currencyCode={shop.currency_code}
      />
    </>
  );
}