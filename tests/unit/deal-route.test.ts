/**
 * /app/deals/:dealId must render the deal, not the capture form.
 *
 * This is a regression test for a defect that produced a screenshot which looked
 * like a successful capture and was not. The `[dealId]` route was a verbatim copy
 * of `/app/deals/new` — same component, same `NewDealPage` function name, same
 * "New deal" metadata — so every deal in the register opened an empty
 * DealCaptureWizard. The route resolved, the page rendered, nothing threw, and
 * the deal was unreachable from the UI.
 *
 * It is tested at the module boundary rather than by asserting on the source
 * text, because the failure mode was precisely that the source looked complete:
 * imports resolved, types checked, metadata was valid. Rendering the page and
 * checking which component it mounts is the only assertion that distinguishes
 * the two versions.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const dealId = 'a06202c8-5a5a-40a7-b96f-017082debebc';

const rendered: string[] = [];

vi.mock('@/lib/tenancy', () => ({
  requireUser: vi.fn(async () => ({ userId: 'user-1' })),
  requireShop: vi.fn(async () => ({
    shopId: 'shop-1',
    shop: {
      id: 'shop-1',
      currency_code: 'NGN',
      timezone: 'Africa/Lagos',
      name: 'Ojo Provisions',
    },
    membership: { permissions: ['deal.view', 'deal.create', 'deal.update'] },
  })),
  can: () => true,
}));

vi.mock('@/lib/data/queries', () => ({
  getDealDetail: vi.fn(async (shopId: string, id: string) =>
    shopId === 'shop-1' && id === dealId
      ? { deal: { id: dealId, supplier_id: 'sup-1' }, supplier: null, lines: [], events: [], evidence: [], memory: [] }
      : null,
  ),
  listSuppliers: vi.fn(async () => []),
}));

vi.mock('@/components/app/DealDetailView', () => ({
  DealDetailView: () => {
    rendered.push('DealDetailView');
    return null;
  },
}));

vi.mock('@/components/app/DealCaptureWizard', () => ({
  DealCaptureWizard: () => {
    rendered.push('DealCaptureWizard');
    return null;
  },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/format', () => ({
  todayInputValue: () => '2026-09-30',
}));

beforeEach(() => {
  rendered.length = 0;
  vi.resetModules();
});

/**
 * The page returns JSX rather than rendered HTML, so the child components are
 * only invoked when that tree is actually rendered. Rendering it is what makes
 * the assertion meaningful: calling the page and inspecting its return value
 * cannot distinguish the two versions, because both return an element.
 */
async function renderPage(params: Record<string, string> = { dealId }) {
  const mod = await import('../../web/src/app/app/deals/[dealId]/page');
  const element = await (mod.default as (p: unknown) => Promise<React.ReactElement>)({
    params: Promise.resolve(params),
    searchParams: Promise.resolve({}),
  });
  return renderToStaticMarkup(element);
}

describe('the deal page', () => {
  it('mounts the detail view for a deal in the shop', async () => {
    await renderPage();
    expect(rendered).toEqual(['DealDetailView']);
  });

  it('never mounts the capture wizard on a deal route', async () => {
    await renderPage();
    expect(rendered).not.toContain('DealCaptureWizard');
  });

  it('404s rather than showing an empty form when the deal does not exist', async () => {
    // The regression was an empty form rendered in place of a missing record.
    // A wrong id must fail loudly, not render something plausible.
    // Next's notFound() throws NEXT_HTTP_ERROR_FALLBACK;404 in this version.
    await expect(renderPage({ dealId: 'does-not-exist' })).rejects.toThrow();
    expect(rendered).not.toContain('DealCaptureWizard');
  });
});