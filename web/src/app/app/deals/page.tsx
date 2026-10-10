import type { Metadata } from 'next';
import { requireShop, requireUser, can } from '@/lib/tenancy';
import { listDeals } from '@/lib/data/queries';
import { listSuppliers } from '@/lib/data/queries';
import { createClient } from '@/lib/supabase/server';
import { reconcilePendingWrites } from '@/lib/memory/service';
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

  /**
   * Promote finished memory writes before rendering.
   *
   * Reconcile used to run only when Ask or Settings loaded, so a retailer who
   * recorded deals and went straight to their deal list saw "Memory syncing"
   * indefinitely on rows the relayer had in fact stored. Thirty-one rows across
   * three real shops were in that state; every one was confirmed against the
   * relayer and promoted.
   *
   * The deal register is where someone goes to see what has been recorded, so
   * that is where the state has to be honest. Awaited rather than fired and
   * forgotten, because a reconcile that has not finished would render the same
   * stale state this exists to fix.
   */
  await reconcilePendingWrites(shop.id);

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