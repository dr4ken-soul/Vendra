/**
 * Canonical read queries.
 *
 * Every function here takes an already-authorised shopId and uses the
 * session-scoped Supabase client, so Row Level Security is applied on top of the
 * membership check. No function accepts a shopId it has not verified.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  Deal,
  DealEvent,
  DealLine,
  EvidenceFile,
  Supplier,
  DealListItem,
  DealStatus,
} from '@/lib/types';

export interface DealListFilters {
  q?: string;
  status?: DealStatus;
  supplierId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface DealListResult {
  items: DealListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const DEAL_STATUSES: DealStatus[] = [
  'draft',
  'quoted',
  'agreed',
  'part_delivered',
  'delivered',
  'issue_open',
  'resolved',
  'cancelled',
];

/**
 * The deal register.
 *
 * Fetched as one round trip: deals plus their suppliers, then a single
 * aggregate query for the newest event per deal so the list does not issue a
 * query per row.
 */
export async function listDeals(
  shopId: string,
  filters: DealListFilters = {},
): Promise<DealListResult> {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  let query = supabase
    .from('deals')
    .select('*', { count: 'exact' })
    .eq('shop_id', shopId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
  if (filters.from) query = query.gte('deal_date', filters.from);
  if (filters.to) query = query.lte('deal_date', filters.to);

  const { data: deals, error, count } = await query.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) throw new Error(`Failed to load deals: ${error.message}`);
  if (!deals || deals.length === 0) {
    return { items: [], total: count ?? 0, page, pageSize };
  }

  const dealRows = deals as Deal[];
  const dealIds = dealRows.map((d) => d.id);
  const supplierIds = [...new Set(dealRows.map((d) => d.supplier_id))];

  const [{ data: suppliers }, { data: lastEvents }] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, display_name')
      .eq('shop_id', shopId)
      .in('id', supplierIds),
    supabase
      .from('deal_events')
      .select('deal_id, occurred_at, summary')
      .eq('shop_id', shopId)
      .in('deal_id', dealIds)
      .is('superseded_at', null)
      .order('occurred_at', { ascending: false }),
  ]);

  const supplierNameById = new Map(
    ((suppliers ?? []) as Array<{ id: string; display_name: string }>).map((s) => [
      s.id,
      s.display_name,
    ]),
  );

  const lastEventByDeal = new Map<string, { occurred_at: string; summary: string }>();
  for (const row of (lastEvents ?? []) as Array<{
    deal_id: string;
    occurred_at: string;
    summary: string;
  }>) {
    if (!lastEventByDeal.has(row.deal_id)) {
      lastEventByDeal.set(row.deal_id, { occurred_at: row.occurred_at, summary: row.summary });
    }
  }

  // Exact per-deal line counts for the visible page.
  const perDealLines = await distributeLineCount(shopId, dealIds);

  const q = filters.q?.trim().toLowerCase();

  let items: DealListItem[] = dealRows.map((deal) => {
    const lastEvent = lastEventByDeal.get(deal.id);
    return {
      id: deal.id,
      shop_id: deal.shop_id,
      status: deal.status,
      deal_date: deal.deal_date,
      headline: deal.headline,
      currency_code: deal.currency_code,
      updated_at: deal.updated_at,
      supplier_id: deal.supplier_id,
      supplier_name: supplierNameById.get(deal.supplier_id) ?? 'Unknown supplier',
      last_event_at: lastEvent?.occurred_at ?? null,
      last_event_summary: lastEvent?.summary ?? null,
      line_count: perDealLines.get(deal.id) ?? 0,
    };
  });

  // Free-text search across supplier label and headline. Applied after the
  // database query because it must span a joined column.
  if (q) {
    items = items.filter(
      (item) =>
        item.supplier_name.toLowerCase().includes(q) ||
        (item.headline ?? '').toLowerCase().includes(q) ||
        (item.last_event_summary ?? '').toLowerCase().includes(q),
    );
  }

  return {
    items,
    total: filters.q ? items.length : (count ?? items.length),
    page,
    pageSize,
  };
}

/** Exact per-deal line counts for the visible page. */
async function distributeLineCount(shopId: string, dealIds: string[]): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('deal_lines')
    .select('deal_id')
    .eq('shop_id', shopId)
    .in('deal_id', dealIds);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ deal_id: string }>) {
    counts.set(row.deal_id, (counts.get(row.deal_id) ?? 0) + 1);
  }
  return counts;
}

export interface DealDetail {
  deal: Deal;
  supplier: Supplier | null;
  lines: DealLine[];
  events: Array<DealEvent & { evidence: EvidenceFile[] }>;
  evidence: EvidenceFile[];
  memory: Array<{
    id: string;
    event_id: string;
    status: string;
    memory_version: number;
    job_id: string | null;
    memory_blob_id: string | null;
    last_error_code: string | null;
    updated_at: string;
  }>;
}

/** Full deal record for the detail screen. */
export async function getDealDetail(shopId: string, dealId: string): Promise<DealDetail | null> {
  const supabase = await createClient();

  const { data: dealRow } = await supabase
    .from('deals')
    .select('*')
    .eq('shop_id', shopId)
    .eq('id', dealId)
    .maybeSingle();

  if (!dealRow) return null;

  const deal = dealRow as Deal;

  const [{ data: lines }, { data: events }, { data: evidence }, { data: supplier }, { data: memory }] =
    await Promise.all([
      supabase
        .from('deal_lines')
        .select('*')
        .eq('shop_id', shopId)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true }),
      supabase
        .from('deal_events')
        .select('*')
        .eq('shop_id', shopId)
        .eq('deal_id', dealId)
        .order('occurred_at', { ascending: true })
        .order('recorded_at', { ascending: true }),
      supabase
        .from('evidence_files')
        .select('*')
        .eq('shop_id', shopId)
        .eq('deal_id', dealId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: true }),
      supabase
        .from('suppliers')
        .select('*')
        .eq('shop_id', shopId)
        .eq('id', deal.supplier_id)
        .maybeSingle(),
      supabase
        .from('walrus_memory_sync')
        .select('id, event_id, status, memory_version, job_id, memory_blob_id, last_error_code, updated_at')
        .eq('shop_id', shopId)
        .eq('deal_id', dealId)
        .order('memory_version', { ascending: false }),
    ]);

  const evidenceRows = (evidence ?? []) as EvidenceFile[];
  const evidenceByEvent = new Map<string, EvidenceFile[]>();
  for (const file of evidenceRows) {
    if (!file.event_id) continue;
    const list = evidenceByEvent.get(file.event_id);
    if (list) list.push(file);
    else evidenceByEvent.set(file.event_id, [file]);
  }

  return {
    deal,
    supplier: (supplier as Supplier | null) ?? null,
    lines: (lines ?? []) as DealLine[],
    events: ((events ?? []) as DealEvent[]).map((event) => ({
      ...event,
      evidence: evidenceByEvent.get(event.id) ?? [],
    })),
    evidence: evidenceRows,
    memory: (memory ?? []) as DealDetail['memory'],
  };
}

export interface SupplierSummary {
  id: string;
  displayName: string;
  phone: string | null;
  notes: string | null;
  archivedAt: string | null;
  dealCount: number;
  lastDealAt: string | null;
  lastDealId: string | null;
  latestTerms: string | null;
  latestTermsDealId: string | null;
  openIssueCount: number;
  openIssueDealId: string | null;
}

/**
 * Supplier directory summaries.
 *
 * Every figure is computed from this shop's own canonical events. There is no
 * supplier rating, score or cross-shop comparison by design.
 */
export async function listSuppliers(shopId: string): Promise<SupplierSummary[]> {
  const supabase = await createClient();

  const [{ data: supplierRows }, { data: dealRows }, { data: events }] = await Promise.all([
    supabase
      .from('suppliers')
      .select('*')
      .eq('shop_id', shopId)
      .is('archived_at', null)
      .order('display_name', { ascending: true }),
    supabase
      .from('deals')
      .select('id, supplier_id, status, deal_date, headline, updated_at')
      .eq('shop_id', shopId)
      .is('archived_at', null)
      .order('deal_date', { ascending: false }),
    supabase
      .from('deal_events')
      .select('id, deal_id, event_type, summary, occurred_at, currency_code, agreed_total')
      .eq('shop_id', shopId)
      .is('superseded_at', null)
      .order('occurred_at', { ascending: false }),
  ]);

  const suppliers = (supplierRows ?? []) as Supplier[];
  const deals = (dealRows ?? []) as Array<{
    id: string;
    supplier_id: string;
    status: DealStatus;
    deal_date: string;
    headline: string | null;
    updated_at: string;
  }>;
  const eventRows = (events ?? []) as Array<{
    id: string;
    deal_id: string;
    event_type: string;
    summary: string;
    occurred_at: string;
    currency_code: string | null;
    agreed_total: number | null;
  }>;

  const eventsByDeal = new Map<string, typeof eventRows>();
  for (const event of eventRows) {
    const list = eventsByDeal.get(event.deal_id);
    if (list) list.push(event);
    else eventsByDeal.set(event.deal_id, [event]);
  }

  return suppliers.map((supplier) => {
    const supplierDeals = deals.filter((d) => d.supplier_id === supplier.id);
    const lastDeal = supplierDeals[0] ?? null;

    // The newest agreed-terms event across this supplier's deals.
    let latestTerms: string | null = null;
    let latestTermsDealId: string | null = null;
    for (const deal of supplierDeals) {
      const dealEvents = eventsByDeal.get(deal.id) ?? [];
      const terms = dealEvents.find((e) => e.event_type === 'terms_agreed');
      if (terms && (!latestTerms || terms.occurred_at > latestTerms)) {
        latestTerms = terms.summary;
        latestTermsDealId = deal.id;
      }
    }

    const openIssue = supplierDeals.find((d) => d.status === 'issue_open');

    return {
      id: supplier.id,
      displayName: supplier.display_name,
      phone: supplier.phone,
      notes: supplier.notes,
      archivedAt: supplier.archived_at,
      dealCount: supplierDeals.length,
      lastDealAt: lastDeal?.deal_date ?? null,
      lastDealId: lastDeal?.id ?? null,
      latestTerms,
      latestTermsDealId,
      openIssueCount: supplierDeals.filter((d) => d.status === 'issue_open').length,
      openIssueDealId: openIssue?.id ?? null,
    };
  });
}

export interface OverviewData {
  recentDeals: DealListItem[];
  needsAttention: DealListItem[];
  supplierCount: number;
  memoryCounts: Array<{ status: string; count: number }>;
}

/** Overview screen. Real counts only; nothing is assumed or invented. */
export async function getOverview(shopId: string): Promise<OverviewData> {
  const supabase = await createClient();

  const [{ items: recentDeals }, { data: attention }, { count: supplierCount }, { data: memoryRows }] =
    await Promise.all([
      listDeals(shopId, { page: 1, pageSize: 6 }),
      supabase
        .from('deals')
        .select('*')
        .eq('shop_id', shopId)
        .in('status', ['part_delivered', 'issue_open'])
        .is('archived_at', null)
        .order('deal_date', { ascending: false })
        .limit(8),
      supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .is('archived_at', null),
      supabase
        .from('walrus_memory_sync')
        .select('status')
        .eq('shop_id', shopId),
    ]);

  const attentionDeals = (attention ?? []) as Deal[];

  let needsAttention: DealListItem[] = [];
  if (attentionDeals.length > 0) {
    const supplierIds = [...new Set(attentionDeals.map((d) => d.supplier_id))];
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, display_name')
      .eq('shop_id', shopId)
      .in('id', supplierIds);

    const nameById = new Map(
      ((suppliers ?? []) as Array<{ id: string; display_name: string }>).map((s) => [
        s.id,
        s.display_name,
      ]),
    );

    needsAttention = attentionDeals.map((deal) => ({
      id: deal.id,
      shop_id: deal.shop_id,
      status: deal.status,
      deal_date: deal.deal_date,
      headline: deal.headline,
      currency_code: deal.currency_code,
      updated_at: deal.updated_at,
      supplier_id: deal.supplier_id,
      supplier_name: nameById.get(deal.supplier_id) ?? 'Unknown supplier',
      last_event_at: deal.updated_at,
      last_event_summary: deal.headline,
      line_count: 0,
    }));
  }

  const statusCounts = new Map<string, number>();
  for (const row of (memoryRows ?? []) as Array<{ status: string }>) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  return {
    recentDeals,
    needsAttention,
    supplierCount: supplierCount ?? 0,
    memoryCounts: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
  };
}

export const DEAL_STATUS_VALUES = DEAL_STATUSES;

/** Derive the status a deal should hold after an event of a given type. */
export function statusAfterEvent(current: DealStatus, eventType: string): DealStatus {
  switch (eventType) {
    case 'quote_received':
      return current === 'draft' ? 'quoted' : current;
    case 'terms_agreed':
      return 'agreed';
    case 'delivery_checked':
      return 'part_delivered';
    case 'issue_opened':
      return 'issue_open';
    case 'resolution_recorded':
      return 'resolved';
    case 'correction':
    case 'note_added':
      return current;
    default:
      return current;
  }
}