'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { DealListItem } from '@/lib/types';
import { Button, EmptyState, LinkButton, Select, Skeleton, StatusBadge, TextInput } from './ui';
import { DealStatusLabel, dealStatusTone, DEAL_STATUS_FILTERS } from './dealStatus';
import { formatDate, formatRelative } from '@/lib/format';

interface SupplierOption {
  id: string;
  displayName: string;
}

/**
 * Deal register (FRONTEND_SPEC 4.5).
 *
 * Desktop: a semantic table with `Supplier and deal`, `Last event`, `Status`,
 * `Updated`. Narrow screens: each row becomes a labelled stacked list, never
 * horizontal scrolling.
 *
 * Filters live in the URL so they are shareable and survive returning from a
 * deal. Scroll position is restored on return.
 */
export function DealsRegister({
  initialDeals,
  suppliers,
  shopId,
  canCreate,
  returnQuery,
  currencyCode,
}: {
  initialDeals: DealListItem[];
  suppliers: SupplierOption[];
  shopId: string;
  canCreate: boolean;
  returnQuery: string;
  currencyCode: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * The register is server-rendered: `initialDeals` is the current result set
   * and needs no client-side copy.
   *
   * A skeleton is shown while the transition that applied the filters is in
   * flight, which is exactly the window where the visible rows are stale.
   */
  const deals = initialDeals;
  const loading = isNavigating;

  const status = searchParams.get('status') ?? '';
  const supplier = searchParams.get('supplier') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const filtersActive = Boolean(status || supplier || from || to || searchParams.get('q'));

  // Preserve scroll position when returning from a deal detail.
  useEffect(() => {
    const saved = sessionStorage.getItem('vendra:deals:scroll');
    if (saved && scrollRef.current) {
      scrollRef.current.scrollIntoView({ block: 'start' });
      window.scrollTo({ top: Number(saved), behavior: 'auto' });
      sessionStorage.removeItem('vendra:deals:scroll');
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      sessionStorage.setItem('vendra:deals:scroll', String(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const applyFilters = useCallback(
    (next: { q?: string; status?: string; supplier?: string; from?: string; to?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('shop', shopId);

      const setOrDelete = (key: string, value: string | undefined) => {
        if (value && value.length > 0) params.set(key, value);
        else params.delete(key);
      };

      setOrDelete('q', next.q);
      setOrDelete('status', next.status);
      setOrDelete('supplier', next.supplier);
      setOrDelete('from', next.from);
      setOrDelete('to', next.to);
      params.delete('page');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams, shopId],
  );

  const clearFilters = () => {
    setSearch('');
    startTransition(() => {
      router.push(`${pathname}?shop=${shopId}`);
    });
  };

  // Debounced free-text search.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (search === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set('q', search);
      else params.delete('q');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [search, searchParams, pathname, router]);

  const supplierNameById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.displayName])),
    [suppliers],
  );

  const emptyTitle = filtersActive ? 'No deals match these filters.' : 'No deals yet';
  const emptyBody = filtersActive
    ? 'Try a different supplier, status or date range.'
    : 'Create your first deal to start a connected record from quote to resolution.';

  return (
    <>
      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="relative">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" />
          </svg>
          <TextInput
            id="deal-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier or deal"
            className="pl-10"
            type="search"
            aria-label="Search supplier or deal"
          />
        </div>

        <Select
          id="filter-status"
          aria-label="Status"
          value={status}
          onChange={(e) => applyFilters({ ...currentValues(status, supplier, from, to), status: e.target.value })}
        >
          <option value="">All statuses</option>
          {DEAL_STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          id="filter-supplier"
          aria-label="Supplier"
          value={supplier}
          onChange={(e) => applyFilters({ ...currentValues(status, supplier, from, to), supplier: e.target.value })}
        >
          <option value="">All suppliers</option>
          {suppliers.map((option) => (
            <option key={option.id} value={option.id}>
              {option.displayName}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-2">
          <TextInput
            id="filter-from"
            type="date"
            aria-label="Deals from"
            value={from}
            onChange={(e) => applyFilters({ ...currentValues(status, supplier, from, to), from: e.target.value })}
            className="min-w-[9.5rem]"
          />
          <TextInput
            id="filter-to"
            type="date"
            aria-label="Deals to"
            value={to}
            onChange={(e) => applyFilters({ ...currentValues(status, supplier, from, to), to: e.target.value })}
            className="min-w-[9.5rem]"
          />
        </div>
      </div>

      {filtersActive && (
        <div className="mb-4">
          <Button variant="quiet" onClick={clearFilters} type="button">
            Clear filters
          </Button>
        </div>
      )}

      <div ref={scrollRef}>
        {loading ? (
          <TableSkeleton />
        ) : deals.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            body={emptyBody}
            action={
              filtersActive ? (
                <Button variant="secondary" onClick={clearFilters} type="button">
                  Clear filters
                </Button>
              ) : canCreate ? (
                <LinkButton href="/app/deals/new">Create your first deal</LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden border-t border-[var(--border-default)] sm:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Supplier deals, most recently updated first, in {currencyCode}
                </caption>
                <thead className="border-b border-[var(--border-default)] font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  <tr>
                    <th scope="col" className="px-3 py-3 first:pl-0">Supplier and deal</th>
                    <th scope="col" className="px-3 py-3">Last event</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="border-b border-[var(--border-subtle)] transition-colors duration-[120ms] hover:bg-[var(--surface-wash)]"
                    >
                      <td className="px-3 py-4 align-middle first:pl-0">
                        <a href={`/app/deals/${deal.id}${returnQuery ? `?${returnQuery}` : ''}`} className="block">
                          <span className="font-body text-sm font-semibold text-[var(--text-primary)]">
                            {deal.supplier_name || supplierNameById.get(deal.supplier_id) || 'Unknown supplier'}
                          </span>
                          {deal.headline && (
                            <span className="mt-0.5 block truncate font-body text-xs text-[var(--text-secondary)]">
                              {deal.headline}
                            </span>
                          )}
                        </a>
                      </td>
                      <td className="px-3 py-4 align-middle font-body text-sm text-[var(--text-secondary)]">
                        {deal.last_event_at ? formatRelative(deal.last_event_at) : 'No events yet'}
                      </td>
                      <td className="px-3 py-4 align-middle">
                        <StatusBadge tone={dealStatusTone(deal.status)}>{DealStatusLabel(deal.status)}</StatusBadge>
                      </td>
                      <td className="px-3 py-4 align-middle font-mono text-[10px] tracking-[0.04em] text-[var(--text-muted)]">
                        {formatRelative(deal.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE STACKED ROWS */}
            <ul className="border-t border-[var(--border-default)] sm:hidden">
              {deals.map((deal) => (
                <li key={deal.id} className="border-b border-[var(--border-subtle)] py-4">
                  <a href={`/app/deals/${deal.id}${returnQuery ? `?${returnQuery}` : ''}`} className="block">
                    <p className="font-body text-sm font-semibold text-[var(--text-primary)]">
                      {deal.supplier_name || supplierNameById.get(deal.supplier_id) || 'Unknown supplier'}
                    </p>
                    {deal.headline && (
                      <p className="mt-0.5 font-body text-xs text-[var(--text-secondary)]">{deal.headline}</p>
                    )}
                    <dl className="mt-2 grid grid-cols-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
                      <dt>Last event</dt>
                      <dd className="text-right normal-case tracking-normal text-[var(--text-secondary)]">
                        {deal.last_event_at ? formatRelative(deal.last_event_at) : 'No events yet'}
                      </dd>
                      <dt>Status</dt>
                      <dd className="text-right">
                        <StatusBadge tone={dealStatusTone(deal.status)}>{DealStatusLabel(deal.status)}</StatusBadge>
                      </dd>
                      <dt>Deal date</dt>
                      <dd className="text-right normal-case tracking-normal text-[var(--text-secondary)]">
                        {formatDate(deal.deal_date)}
                      </dd>
                    </dl>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function currentValues(status: string, supplier: string, from: string, to: string) {
  return {
    status: status || undefined,
    supplier: supplier || undefined,
    from: from || undefined,
    to: to || undefined,
  };
}

function TableSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading deals</span>
      <div className="border-t border-[var(--border-default)]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="border-b border-[var(--border-subtle)] py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}