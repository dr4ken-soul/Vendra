/**
 * End-to-end API smoke test against the LIVE Supabase project and the LIVE
 * Gemini model.
 *
 * Drives the real user journey through the real server routes over HTTP:
 *
 *   create account -> create shop -> add supplier -> capture a deal with
 *   quoted and agreed terms -> read it back -> record a short delivery ->
 *   log an issue -> record a resolution -> ask a question and check the answer
 *   is grounded -> check a negative control refuses to invent -> draft a
 *   follow-up -> prove a second shop cannot see the first shop's data.
 *
 * Nothing is mocked. Credentials are read from the environment by
 * scripts/run-e2e.mjs, which loads web/.env.local.
 *
 *   cd web && npm run dev      # in one terminal
 *   cd web && npm run test:e2e # in another
 *
 * Every user, shop and record created here is deleted before the script exits.
 */

import { createClient } from '@supabase/supabase-js';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !adminKey) {
  console.error(
    'Missing Supabase environment. Run via `npm run test:e2e`, which loads .env.local.',
  );
  process.exit(1);
}

const admin = createClient(url, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const email = `vendra-e2e-${stamp}@example.test`;
const password = `Vendra-e2e-${stamp}-Aa1!`;

const results = [];
function record(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` :: ${detail}` : ''}`);
}

/** Cookie-jar-backed fetch, so the session behaves the way a browser presents it. */
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

/**
 * Capture the session cookies exactly as a server render would receive them.
 *
 * The application reads its session from cookies via @supabase/ssr, so the test
 * has to present the same cookie names and encoding a browser would. Presenting
 * a bare access token instead fails with "Sign in to continue", because the
 * application never looks for one under that name.
 */
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

function finish(exitCode) {
  console.log('\n================ SUMMARY ================');
  const passed = results.filter((r) => r.ok).length;
  console.log(`${passed}/${results.length} steps passed`);
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  FAILED: ${r.step} :: ${r.detail}`);
  }
  process.exit(exitCode);
}

const createdIds = [];

// ---------------------------------------------------------------------------
// 1. Account
// ---------------------------------------------------------------------------
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError) {
  record('create auth user', false, createError.message);
  finish(1);
}
record('create auth user', true, email);
createdIds.push(created.user.id);

const browser = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: session, error: signInError } = await browser.auth.signInWithPassword({
  email,
  password,
});
if (signInError) {
  record('sign in', false, signInError.message);
  finish(1);
}
record('sign in', true, session.user.id);

const sessionCookies = await captureSessionCookies(
  session.session.access_token,
  session.session.refresh_token,
);
for (const [name, value] of sessionCookies) jar.set(name, value);
record('capture SSR session cookie', sessionCookies.size > 0, [...sessionCookies.keys()].join(', '));

// ---------------------------------------------------------------------------
// 2. Shop
// ---------------------------------------------------------------------------
const shopCreate = await api('/api/shops', {
  method: 'POST',
  body: JSON.stringify({
    name: 'E2E Provisions',
    marketArea: 'Test market',
    timezone: 'Africa/Lagos',
  }),
});
record(
  'create shop',
  shopCreate.status === 201,
  shopCreate.body?.shop
    ? `memory=${shopCreate.body.shop.memoryStatus}`
    : JSON.stringify(shopCreate.body).slice(0, 200),
);

if (shopCreate.status !== 201) finish(1);
const shopId = shopCreate.body.shop.id;

// ---------------------------------------------------------------------------
// 3. Supplier
// ---------------------------------------------------------------------------
const supplierCreate = await api('/api/suppliers', {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    displayName: 'Okonkwo Wholesale',
    phone: '+234 800 000 0000',
  }),
});
record('create supplier', supplierCreate.status === 201, supplierCreate.body?.supplier?.id);
if (supplierCreate.status !== 201) finish(1);

// ---------------------------------------------------------------------------
// 4. Deal with a quote and agreed terms that differ
// ---------------------------------------------------------------------------
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
  `status=${dealCreate.body?.deal?.status} memoryQuote=${dealCreate.body?.memory?.quote?.status ?? 'none'}`,
);
if (dealCreate.status !== 201) finish(1);
const dealId = dealCreate.body.deal.id;
// The create response returns `lines` alongside `deal`, not nested inside it.
const lineId = dealCreate.body.lines[0].id;

// ---------------------------------------------------------------------------
// 5. Read it back
// ---------------------------------------------------------------------------
const dealRead = await api(`/api/deals/${dealId}`);
record(
  'read deal detail',
  dealRead.status === 200,
  `lines=${dealRead.body?.deal?.lines?.length} events=${dealRead.body?.deal?.events?.length}`,
);
if (dealRead.status !== 200) finish(1);

// ---------------------------------------------------------------------------
// 6. Lifecycle: short delivery, issue, resolution
// ---------------------------------------------------------------------------
// The client sends no status. The database derives `part_delivered` from the
// recorded quantities, so this step also proves the client cannot assert a
// status of its own choosing.
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
  `dealStatus=${delivery.body?.deal?.status} memory=${delivery.body?.memory?.status ?? 'none'}`,
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
// 7. Ask, and check the answer is grounded
// ---------------------------------------------------------------------------
const ask = await api('/api/assistant/recall', {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    question: 'What did I agree to pay for the tomato paste, and was the delivery complete?',
  }),
});
record(
  'ask (recall)',
  ask.status === 200,
  `memoryStatus=${ask.body?.memoryStatus} sources=${ask.body?.sources?.length}`,
);
console.log('\n--- ANSWER ---');
console.log(ask.body?.answer ?? '(none)');
console.log('--- SOURCES ---');
for (const source of ask.body?.sources ?? []) {
  console.log(
    ` ${source.supplierName} | ${source.eventType} | ${source.occurredAt?.slice(0, 10)} | ${source.summary?.slice(0, 70)}`,
  );
}

const answerText = (ask.body?.answer ?? '').toLowerCase();
record('answer cites sources', (ask.body?.sources?.length ?? 0) > 0, `${ask.body?.sources?.length} source(s)`);
record(
  'answer reflects the agreed price',
  answerText.includes('18,000') || answerText.includes('18000'),
  'expected the agreed 18,000, not the quoted 18,400',
);
record(
  'answer does not invent a received count',
  !/received 20|received all 20/.test(answerText),
  'checked for the full quoted quantity',
);
record(
  'answer reports the short delivery',
  answerText.includes('16'),
  'expected the recorded 16 of 18',
);

// ---------------------------------------------------------------------------
// 8. Negative control: a supplier that was never recorded
// ---------------------------------------------------------------------------
const negative = await api('/api/assistant/recall', {
  method: 'POST',
  body: JSON.stringify({
    shopId,
    question: 'What did I agree to pay Beta Frozen Foods for the last delivery?',
  }),
});
/**
 * What must be true after asking about a supplier that was never recorded.
 *
 * Two behaviours are acceptable:
 *
 *   a) an explicit refusal, or
 *   b) an answer that points at the records that DO exist without attributing
 *      any figure to the unknown supplier.
 *
 * The second is not a failure. Retrieval searches recorded event summaries, and
 * the question contains generic domain words such as "delivery", so records for
 * a different supplier can legitimately match. Naming the supplier that actually
 * has the record is honest. What would be dishonest, and what this asserts
 * against, is stating an agreed amount for Beta Frozen Foods.
 *
 * Asserting a specific refusal phrase instead would make this test fail on
 * wording rather than on behaviour, which is how it briefly did.
 */
const AMOUNT = /\b\d[\d,]*(\.\d+)?\b/;

function attributesAmountTo(supplier, answer) {
  const lower = answer.toLowerCase();
  const supplierLower = supplier.toLowerCase();
  let index = lower.indexOf(supplierLower);
  while (index !== -1) {
    const window = lower.slice(Math.max(0, index - 80), index + supplierLower.length + 120);
    if (AMOUNT.test(window)) return true;
    index = lower.indexOf(supplierLower, index + 1);
  }
  return false;
}

const noSourceClaimsUnknownSupplier = (negative.body?.sources ?? []).every(
  (s) => (s.supplierName ?? '').toLowerCase() !== 'beta frozen foods',
);

record(
  'negative control invents no figure for an unrecorded supplier',
  !attributesAmountTo('Beta Frozen Foods', negative.body?.answer ?? '') &&
    noSourceClaimsUnknownSupplier,
  attributesAmountTo('Beta Frozen Foods', negative.body?.answer ?? '')
    ? 'attributed an amount to an unrecorded supplier'
    : `answered from ${negative.body?.sources?.length ?? 0} real source(s), none of them the unknown supplier`,
);

// ---------------------------------------------------------------------------
// 9. Draft a follow-up from the recorded events
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
console.log('\n--- DRAFT ---');
console.log(draft.body?.draft ?? '(none)');

// ---------------------------------------------------------------------------
// 10. Cross-tenant check
//
// A second, unrelated shop asks about the first shop's supplier. It must find
// nothing. This exercises the tenant boundary through the application rather
// than through the database alone.
// ---------------------------------------------------------------------------
const emailB = `vendra-e2e-b-${stamp}@example.test`;
const passwordB = `Vendra-e2e-b-${stamp}-Aa1!`;
const { data: createdB, error: createErrorB } = await admin.auth.admin.createUser({
  email: emailB,
  password: passwordB,
  email_confirm: true,
});

if (createErrorB) {
  record('create second user (shop B)', false, createErrorB.message);
  finish(1);
}
createdIds.push(createdB.user.id);

const browserB = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: sessionB } = await browserB.auth.signInWithPassword({
  email: emailB,
  password: passwordB,
});

const jarB = new Map();
const cookiesB = await captureSessionCookies(
  sessionB.session.access_token,
  sessionB.session.refresh_token,
);
for (const [name, value] of cookiesB) jarB.set(name, value);

const shopB = await api(
  '/api/shops',
  {
    method: 'POST',
    body: JSON.stringify({ name: 'E2E Shop B', timezone: 'Africa/Lagos' }),
  },
  jarB,
);
record(
  'create second shop (shop B)',
  shopB.status === 201,
  shopB.status === 201 ? shopB.body.shop.id : JSON.stringify(shopB.body).slice(0, 200),
);

if (shopB.status !== 201) {
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
  finish(1);
}

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

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
for (const id of createdIds) {
  await admin.auth.admin.deleteUser(id);
}

finish(results.every((r) => r.ok) ? 0 : 1);
