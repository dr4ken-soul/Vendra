/**
 * Capture real screens of the deployed product.
 *
 * The film was, until now, re-rendering the interface in the product's design
 * system. Every value in those frames was real, but the frames were not pixels of
 * the live site. The Ebbryn reference this film is modelled on uses real screen
 * capture with a visible cursor, and that is the honest way to do it: a judge
 * comparing the film against the deployment should not be looking at two
 * different products.
 *
 * Everything here is the real deployment, signed in as a real account, with a
 * real shop. Nothing is mocked and no state is injected — the session is
 * established by submitting the real sign-in form.
 *
 *   $env:DEMO_PASSWORD = "..."
 *   node analysis/capture-screens.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public', 'screens');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.DEMO_BASE_URL ?? 'https://vendra-psycho-projects.vercel.app';
const EMAIL = process.env.DEMO_EMAIL ?? 'demo.shop@vendra-demo.test';
const PASSWORD = process.env.DEMO_PASSWORD;

if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD to the demo account password.');
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const shot = async (name) => {
  await page.waitForTimeout(800);
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  ${name.padEnd(18)} ${Math.round(fs.statSync(file).size / 1024)}KB`);
};

/**
 * `networkidle` fires while the page is still rendering skeletons, so the frame
 * that gets captured is a half-loaded page. Waiting for text that can only appear
 * once real data has arrived is what makes a screenshot evidence of anything.
 */
const waitForText = (text, timeout = 40_000) =>
  page
    .waitForFunction((t) => document.body && document.body.innerText.includes(t), text, { timeout })
    .catch(() => console.log(`  (never saw "${text}" within ${timeout / 1000}s)`));

console.log(`base ${BASE}`);
console.log(`signing in as ${EMAIL}`);

await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL(/(\/app|\/onboarding)/, { timeout: 45_000 });
console.log('signed in\n');
console.log('capturing:');

/* ---------- deals list ---------- */

await page.goto(`${BASE}/app/deals`, { waitUntil: 'domcontentloaded' });
await waitForText('Weekly provisions order');
await page.waitForTimeout(1500);
await shot('01-deals');

/* ---------- the deal and its history ---------- */

/**
 * Real deal links carry a UUID. `/app/deals/new` shares the prefix and was
 * matched first by a plain prefix selector, which navigated to the capture form
 * instead of the deal.
 */
const dealLink = page.locator('a[href^="/app/deals/"]:not([href$="/new"])').first();
if (await dealLink.count()) {
  await dealLink.click();
  await page.waitForURL(/\/app\/deals\/[0-9a-f-]+/, { timeout: 25_000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded');
  await waitForText('Tomato paste');
  await page.waitForTimeout(1800);
  await shot('02-deal-detail');
} else {
  console.log('  (no deal link found)');
}

/* ---------- Ask Vendra, with the real answer ---------- */

await page.goto(`${BASE}/app/ask`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await shot('03-ask-empty');

const box = page.locator('textarea').first();
if (await box.count()) {
  await box.fill('What did we agree with Segun Wholesale, and what went wrong?');
  await page.waitForTimeout(700);
  await shot('04-ask-typed');

  await page.locator('button[type=submit]').first().click();
  // The answer streams from the deployed model. Wait for the citation to appear,
  // with a ceiling, so a slow response cannot silently become an empty frame
  // that still looks like a successful capture.
  await page
    .waitForFunction(() => document.body.innerText.includes('SOURCE'), { timeout: 120_000 })
    .catch(() => console.log('  (no SOURCE citation appeared within 120s)'));
  await page.waitForTimeout(3500);
  await shot('05-ask-answer');
}

await browser.close();
console.log(`\nwrote to ${OUT}`);