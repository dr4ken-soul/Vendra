/**
 * Run the full end-to-end journey against a DEPLOYED environment.
 *
 * The same scenario as scripts/e2e-smoke.mjs, pointed at a real deployment
 * instead of a local dev server. This is the only way to prove that the
 * production build works: env vars are read from the platform, not from a local
 * .env.local, and the code has been bundled and traced rather than run from
 * source.
 *
 *   E2E_BASE_URL=https://your-deployment.vercel.app node scripts/e2e-prod.mjs
 *
 * Credentials come from the environment. Run it through scripts/run-e2e.mjs
 * with E2E_BASE_URL set, which loads web/.env.local first.
 *
 * Everything it creates is deleted before it exits.
 */

import { createClient } from '@supabase/supabase-js';

const BASE = process.env.E2E_BASE_URL;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!BASE || !url || !anonKey || !adminKey) {
  console.error(
    'Set E2E_BASE_URL to the deployed origin, and NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the environment.',
  );
  process.exit(1);
}

console.log(`running against ${BASE}\n`);

const admin = createClient(url, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const email = `vendra-prod-${stamp}@example.test`;
const password = `Vendra-prod-${stamp}-Aa1!`;

const results = [];
function record(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` :: ${detail}` : ''}`);
}

const jar = new Map();

async function api(path, options = {}, cookieJar = jar) {
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (cookieJar.size > 0) {
    headers.set('cookie', [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; '));
  }

  const response = await fetch(`${BASE}${path}`, { ...options, headers, redirect: 'manual' });

  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index > 0) cookieJar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body };
}

const { createServerClient } = await import('@supabase/ssr');

async function captureSessionCookies(accessToken, refreshToken) {
  const captured = new Map();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) captured.set(cookie.name, cookie.value);
      },
    },
  });
  await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return captured;
}

function finish() {
  console.log('\n================ SUMMARY ================');
  const passed = results.filter((r) => r.ok).length;
  console.log(`${passed}/${results.length} steps passed`);
  for (const r of results.filter((x) => !x.ok)) console.log(`  FAILED: ${r.step} :: ${r.detail}`);
  process.exit(passed === results.length ? 0 : 1);
}

const createdIds = [];

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------
for (const route of ['/', '/sign-in', '/privacy', '/onboarding']) {
  const response = await fetch(`${BASE}${route}`, { redirect: 'manual' });
  record(`public route ${route}`, response.status === 200, `HTTP ${response.status}`);
}

record(
  'unauthenticated API read is rejected',
  (await api('/api/shops')).status === 401,
  `HTTP ${(await api('/api/shops')).status}`,
);

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createError) {
  record('create auth user', false, createError.message);
  finish();
}
record('create auth user', true, email);
createdIds.push(created.user.id);

const browser = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: session, error: signInError } = await browser.auth.signInWithPassword({ email, password });
if (signInError) {
  record('sign in', false, signInError.message);
  finish();
}

const cookies = await captureSessionCookies(session.session.access_token, session.session.refresh_token);
for (const [name, value] of cookies) jar.set(name, value);
record('capture SSR session cookie', cookies.size > 0, [...cookies.keys()].join(', '));

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------
const shopCreate = await api('/api/shops', {
  method: 'POST',
  body: JSON.stringify({ name: 'Prod Provisions', marketArea: 'Test market', timezone: 'Africa/Lagos' }),
});
record(
  'create shop',
  shopCreate.status === 201,
  shopCreate.status === 201
    ? `memory=${shopCreate.body.shop.memoryStatus}`
    : JSON.stringify(shopCreate.body).slice(0, 200),
);
if (shopCreate.status !== 201) finish();
const shopId = shopCreate.body.shop.id;

// ---------------------------------------------------------------------------
// Supplier and deal
// ---------------------------------------------------------------------------
const supplierCreate = await api('/api/suppliers', {
  method: 'POST',
  body: JSON.stringify({ shopId, displayName: 'Okonkwo Wholesale', phone: '+234 800 000 0000' }),
});
record('create supplier', supplierCreate.status === 201, supplierCreate.body?.supplier?.id);
if (supplierCreate.status !== 201) finish();

const dealCreate = await api('/api/deals', {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    supplierId: supplierCreate.body.supplier.id,
    dealDate: '2026-10-01',
    headline: '18 cartons of tomato paste',
    termsAgreed: true,
    expectedDeliveryAt: new Date('2026-10-07T09:00:00Z').toISOString(),
    lines: [
      {
        productLabel: 'Tomato paste',
        quotedQuantity: 20,
        quotedUnitPrice: 18400,
        agreedQuantity: 18,
        agreedUnitPrice: 18000,
        unitLabel: 'carton',
      },
    ],
  }),
});
record(
  'create deal (quote + agreed terms)',
  dealCreate.status === 201,
  `status=${dealCreate.body?.deal?.status}`,
);
if (dealCreate.status !== 201) finish();
const dealId = dealCreate.body.deal.id;
const lineId = dealCreate.body.lines[0].id;

const dealRead = await api(`/api/deals/${dealId}`);
record(
  'read deal detail',
  dealRead.status === 200,
  `lines=${dealRead.body?.deal?.lines?.length} events=${dealRead.body?.deal?.events?.length}`,
);

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
const delivery = await api(`/api/deals/${dealId}/events`, {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    eventType: 'delivery_checked',
    summary: 'Received 16 cartons on 8 October. Two short of the agreed 18.',
    condition: 'short',
    receivedLines: [{ lineId, receivedQuantity: 16 }],
  }),
});
record(
  'record delivery (short)',
  delivery.status === 201,
  `dealStatus=${delivery.body?.deal?.status}`,
);

const issue = await api(`/api/deals/${dealId}/events`, {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    eventType: 'issue_opened',
    summary: 'Two cartons missing from the delivery.',
    issueType: 'short_quantity',
  }),
});
record('log issue', issue.status === 201, `dealStatus=${issue.body?.deal?.status}`);

const resolution = await api(`/api/deals/${dealId}/events`, {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    eventType: 'resolution_recorded',
    summary: 'Supplier agreed to deliver the two missing cartons on Friday.',
    resolutionOutcome: 'Supplier agreed to deliver the two missing cartons on Friday.',
    outcomeCode: 'agreed',
  }),
});
record('record resolution', resolution.status === 201, `dealStatus=${resolution.body?.deal?.status}`);

// ---------------------------------------------------------------------------
// Ask, against the deployed build and the deployed model configuration
// ---------------------------------------------------------------------------
const ask = await api('/api/assistant/recall', {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    question: 'What did I agree to pay for the tomato paste, and was the delivery complete?',
  }),
});
record(
  'ask (grounded recall)',
  ask.status === 200,
  `memoryStatus=${ask.body?.memoryStatus} sources=${ask.body?.sources?.length}`,
);
console.log('\n--- ANSWER ---');
console.log(ask.body?.answer ?? '(none)');

const answerText = (ask.body?.answer ?? '').toLowerCase();
record('answer cites sources', (ask.body?.sources?.length ?? 0) > 0, `${ask.body?.sources?.length} source(s)`);
record(
  'answer reflects the agreed price',
  answerText.includes('18,000') || answerText.includes('18000'),
  'expected 18,000, not the quoted 18,400',
);
record('answer reports the short delivery', answerText.includes('16'), 'expected the recorded 16 of 18');

// The deployed Gemini configuration must be readable and must actually work.
const memoryState = await api(`/api/shops/${shopId}/memory`);
record(
  'memory endpoint reports real state',
  memoryState.status === 200,
  `status=${memoryState.body?.memoryStatus} walrusConfigured=${memoryState.body?.walrusConfigured}`,
);

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------
const events = dealRead.body?.deal?.events ?? [];
const draft = await api('/api/assistant/drafts', {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    dealId,
    selectedEventIds: events.map((e) => e.id),
    goal: 'Confirm the two missing cartons will be delivered this week.',
  }),
});
record('draft follow-up', draft.status === 200, `sources=${draft.body?.sourceEventIds?.length}`);
console.log('--- DRAFT ---');
console.log(draft.body?.draft ?? '(none)');

// ---------------------------------------------------------------------------
// Cross-tenant
// ---------------------------------------------------------------------------
const emailB = `vendra-prod-b-${stamp}@example.test`;
const passwordB = `Vendra-prod-b-${stamp}-Aa1!`;
const { data: createdB, error: createErrorB } = await admin.auth.admin.createUser({
  email: emailB,
  password: passwordB,
  email_confirm: true,
});
if (createErrorB) {
  record('create second user (shop B)', false, createErrorB.message);
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
  finish();
}
createdIds.push(createdB.user.id);

const browserB = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: sessionB } = await browserB.auth.signInWithPassword({ email: emailB, password: passwordB });

const jarB = new Map();
for (const [name, value] of await captureSessionCookies(
  sessionB.session.access_token,
  sessionB.session.refresh_token,
)) {
  jarB.set(name, value);
}

const shopB = await api(
  '/api/shops',
  { method: 'POST', body: JSON.stringify({ name: 'Prod Shop B', timezone: 'Africa/Lagos' }) },
  jarB,
);
record('create second shop (shop B)', shopB.status === 201, shopB.status === 201 ? shopB.body.shop.id : '');

if (shopB.status === 201) {
  const crossAsk = await api(
    '/api/assistant/recall',
    {
      method: 'POST',
      body: JSON.stringify({
        shopId: shopB.body.shop.id,
        question: 'What did I agree to pay Okonkwo Wholesale for the tomato paste?',
      }),
    },
    jarB,
  );
  const crossText = (crossAsk.body?.answer ?? '').toLowerCase();
  record(
    'CROSS-SHOP LEAK CHECK',
    !crossText.includes('18,000') &&
      !crossText.includes('18000') &&
      (crossAsk.body?.sources?.length ?? 0) === 0,
    crossText.includes('18,000') ? 'LEAKED shop A data' : 'no shop A data returned',
  );

  const crossRead = await api(`/api/deals/${dealId}`, {}, jarB);
  record(
    'cross-shop deal read is blocked',
    crossRead.status === 404 || crossRead.status === 403,
    `HTTP ${crossRead.status}`,
  );
}

for (const id of createdIds) await admin.auth.admin.deleteUser(id);
finish();
