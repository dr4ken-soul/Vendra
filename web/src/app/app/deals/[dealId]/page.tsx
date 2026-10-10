import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireShop, requireUser } from '@/lib/tenancy';
import { getDealDetail } from '@/lib/data/queries';
import { DealDetailView } from '@/components/app/DealDetailView';
import { reconcilePendingWrites } from '@/lib/memory/service';
import { todayInputValue } from '@/lib/format';

export const metadata: Metadata = { title: 'Deal' };
export const dynamic = 'force-dynamic';

/**
 * /app/deals/:dealId (FRONTEND_SPEC 4.6)
 *
 * This route previously rendered DealCaptureWizard — a verbatim copy of
 * /app/deals/new — so every deal in the register opened an empty capture form
 * instead of the deal. Nothing threw and no test failed: the page simply
 * rendered the wrong component successfully. It was found by capturing a
 * screenshot of the live site and looking at it.
 */
export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ dealId: string }>;
  searchParams: Promise<{ shop?: string }>;
}) {
  const user = await requireUser('/app/deals');
  const { dealId } = await params;
  const { shop, membership } = await requireShop(
    user.userId,
    (await searchParams).shop,
    `/app/deals/${dealId}`,
  );

  /**
   * Scoped by shop id in the query itself, so a deal belonging to another shop
   * is indistinguishable from one that does not exist. Resolving the shop first
   * and then passing only `shop.id` is what makes that true.
   */
  /**
   * Reconcile before reading the detail.
   *
   * This is the screen that shows "Memory syncing" per event, so it is the worst
   * possible place for a stored memory to be reported as still being written.
   * Thirty-one rows across three real shops sat that way because reconciliation
   * only ran on Ask and Settings.
   */
  await reconcilePendingWrites(shop.id);

  const detail = await getDealDetail(shop.id, dealId);
  if (!detail) notFound();

  return (
    <DealDetailView
      initialDetail={detail}
      shopId={shop.id}
      permissions={membership.permissions}
      currencyCode={shop.currency_code}
      timezone={shop.timezone}
      today={todayInputValue(shop.timezone)}
    />
  );
}