import type { Metadata } from 'next';
import { requireShop, requireUser } from '@/lib/tenancy';
import { getOverview } from '@/lib/data/queries';
import { EmptyState, LinkButton, PageHeader, StatusBadge, type StatusTone } from '@/components/app/ui';
import { DealStatusLabel, dealStatusTone } from '@/components/app/dealStatus';
import { formatDate, formatRelative } from '@/lib/format';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; denied?: string }>;
}) {
  const user = await requireUser('/app');
  const params = await searchParams;
  const { shop, membership } = await requireShop(user.userId, params.shop, '/app');

  const data = await getOverview(shop.id);

  const canCreate = membership.permissions.includes('deal.create');
  const canAsk = membership.permissions.includes('assistant.ask');

  return (
    <>
      <PageHeader
        headingId="page-heading"
        title="Overview"
        description="Your supplier deals, from quote to outcome."
        actions={
          <>
            {canAsk && <LinkButton href="/app/ask" variant="secondary">Ask about a past deal</LinkButton>}
            {canCreate && <LinkButton href="/app/deals/new">New deal</LinkButton>}
          </>
        }
      />

      {params.denied === 'shop' && (
        <p role="status" className="mb-5 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 font-body text-sm text-[var(--warning)]">
          That shop link is not available to your account, so you are looking at your own shop instead.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {canCreate && <LinkButton href="/app/deals/new">Start with a deal</LinkButton>}
        {canAsk && <LinkButton href="/app/ask" variant="secondary">Ask Vendra</LinkButton>}
      </div>

      {/* Needs attention: only when real records carry part_delivered or issue_open */}
      {data.needsAttention.length > 0 && (
        <section className="mt-10" aria-labelledby="needs-attention-heading">
          <h2 id="needs-attention-heading" className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Needs attention
          </h2>
          <div className="mt-3 border-t border-[var(--border-default)]">
            {data.needsAttention.map((deal) => (
              <DealRow key={deal.id} deal={deal} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="flex items-center justify-between gap-4 border-t border-[var(--border-default)] py-4">
          <h2 id="recent-heading" className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Recent deals
          </h2>
          {data.recentDeals.length > 0 && (
            <LinkButton href="/app/deals" variant="quiet">
              All deals
            </LinkButton>
          )}
        </div>

        {data.recentDeals.length === 0 ? (
          <EmptyState
            title="Your first supplier deal starts here."
            body="Save a recent quote or agreed order. You can add the delivery and any resolution later."
            action={
              canCreate ? (
                <LinkButton href="/app/deals/new">
                  {data.supplierCount > 0 ? 'Create a deal' : 'Start with a deal'}
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <div className="border-t border-[var(--border-default)]">
            {data.recentDeals.map((deal) => (
              <DealRow key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function DealRow({ deal }: { deal: Awaited<ReturnType<typeof getOverview>>['recentDeals'][number] }) {
  const tone: StatusTone = dealStatusTone(deal.status);
  const hasEvent = Boolean(deal.last_event_at);

  return (
    <a
      href={`/app/deals/${deal.id}`}
      className="grid grid-cols-1 gap-1 border-b border-[var(--border-subtle)] py-4 transition-colors duration-[120ms] hover:bg-[var(--surface-wash)] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6"
    >
      <div className="min-w-0">
        <p className="truncate font-body text-sm font-semibold text-[var(--text-primary)]">
          {deal.supplier_name}
          {deal.headline && <span className="font-normal text-[var(--text-secondary)]"> — {deal.headline}</span>}
        </p>
        <p className="mt-1 truncate font-body text-xs text-[var(--text-secondary)]">
          {hasEvent
            ? `${formatRelative(deal.last_event_at)} · ${deal.last_event_summary ?? 'Record saved'}`
            : 'No events recorded yet'}
        </p>
      </div>
      <span className="font-mono text-[10px] tracking-[0.04em] text-[var(--text-muted)]">
        {formatDate(deal.deal_date)}
      </span>
      <StatusBadge tone={tone}>{DealStatusLabel(deal.status)}</StatusBadge>
    </a>
  );
}