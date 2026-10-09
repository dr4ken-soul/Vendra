# Vendra

**A private, evidence-backed supplier deal memory for independent retailers.**

Vendra keeps one supplier deal together from quote to agreement, delivery and
resolution. Later, a retailer can ask what happened and get an answer that links
back to the record and the evidence behind it.

It is two ideas in one workflow. **MarketMemory** recalls the previous deal.
**CaseProof** keeps the source records behind that recall. It is not a feature
bundle, a marketplace or a POS.

---

## Current status

Read this section before anything else. **The application is built, deployed,
connected to a live database, and verified end to end against both local and
production.** What remains is Walrus Memory credentials, and real user evidence.

**Live URL:** <https://vendra-psycho-projects.vercel.app>

| Area | State |
|---|---|
| Email sign-up | **Sending through Mailjet**, free plan, no domain required. Supabase accepts sign-ups for any address. A full sign-up with a correct code completing to a session is **not yet verified.** |
| Deployment | **Live on Vercel** at `vendra-psycho-projects.vercel.app` |
| Database schema, migrations, RLS, private storage | **Applied to the live Supabase project** (`tdegxxqxrhbtmqcqfwls`, eu-west-2) |
| Server API (all routes in `DATA_API_CONTRACTS.md` §5) | Complete, exercised live |
| Landing page, auth, onboarding, 8 authenticated routes | Complete, browser-verified |
| Deal lifecycle: quote → terms → delivery → issue → resolution | Complete, verified live |
| Grounded recall + follow-up drafting (Gemini `gemini-3.8-flash`) | **Verified live with real model output** |
| Privacy erasure, database rows | **Verified against the live database** |
| Walrus Memory adapter (real SDK `@mysten-incubation/memwal` 0.1.8) | Written; **needs credentials** |
| `tsc --noEmit`, `eslint`, `next build` | All clean |
| Unit and integration tests | **90 passing**, 6 skipped (Walrus) |
| Tenant-isolation suite | **13 passing against the live database** |
| Privacy-erasure suite | **Passing against the live database** |
| End-to-end journey, local | **19/19 passing** against live Supabase + live Gemini |
| End-to-end journey, deployed build | **23/23 passing** against the production URL |
| Lighthouse (a11y / best practices / SEO) | 1.00 / 1.00 / 1.00 |
| Walrus namespace isolation and blob erasure | **Unverified — reported as unverified, not as a pass** |
| Real user evidence (3 users × 10 memories) | **Not gathered. No users yet.** |

**No claim in this repository is made about usage, memory counts, testimonials
or challenge completion.** There are no real users yet. The live database
contains no rows: every test account and record is deleted after each run, and
`npm run verify:clean` asserts that.

### What the live end-to-end test actually proved

Driving the real routes against the real database and the real model:

```
create account ..........  PASS
create shop .............  PASS   own memory scope assigned
add supplier ............  PASS
capture deal ............  PASS   status = agreed
read deal back ..........  PASS   1 line, 2 events
record delivery (short) .  PASS   status auto-derived to part_delivered
log issue ...............  PASS   status -> issue_open
record resolution .......  PASS   status -> resolved
ask (grounded recall) ...  PASS   5 sources cited
answer cites sources ....  PASS
answer has right price .  PASS   stated 18,000 NGN
no invented receipt ....  PASS
negative control ........  PASS   no figure attributed to an unrecorded supplier
draft follow-up .........  PASS   quoted the real price and shortfall
cross-shop leak check ...  PASS   shop B received nothing from shop A
cross-shop deal read ....  PASS   HTTP 404
unauthenticated API ....  PASS   401 on read and write
```

The same suite passes against the **deployed build**, which is the only way to
prove the platform environment variables and the production bundle actually work
rather than a dev server reading `.env.local`.

Two behaviours are worth calling out. The deal status is **derived** from the
recorded quantities rather than asserted by the client, so "part delivered"
appeared on its own. And the negative control is the important one: asked about
a supplier that was never recorded, Vendra attributed no figure to it.

### A promise that was silently broken

Erasure is the one thing this product must never get wrong, and it was broken.
`POST /api/privacy/erase` deleted nothing — an append-only trigger refused every
`deal_events` delete — and reported the relational layer as `complete` anyway,
because it never checked the result. The route returned HTTP 200 and told a
retailer their records were gone while every row survived.

None of that was visible to review, type-checking, linting, the production build
or any existing test. It was found by writing `tests/privacy-erasure/`, which asks
whether erasure works rather than assuming it. That suite, the four migrations that
fix it, and one further inverted trigger are written up in
[`TECH_DECISIONS.md`](TECH_DECISIONS.md) §0c.

The fix was deliberately not to soften the append-only guarantee. `deal_events` is
still refused for update at all times, and refused for delete unless a
transaction-scoped erasure window is open — a window only `erase_shop_records`
can open, which performs the whole cascade in one transaction so erasure is
atomic. The route now verifies afterwards that the rows really are gone and
reports `blocked` if they are not.

---

## Required manual setup

### 1. Gemini — done ✅

The key works. `gemini-2.5-flash` and `gemini-2.0-flash` are both **retired**
for this key and return 404. Vendra is pinned to **`gemini-3.8-flash`**, verified
live.

### 2. Supabase — done ✅

Project `Vendra`, ref `tdegxxqxrhbtmqcqfwls`, org `psycho zone`, eu-west-2.
Migrations applied with `supabase db push`. To re-apply:

```bash
cd supabase
supabase link --project-ref tdegxxqxrhbtmqcqfwls
supabase db push
```

The project was created with "Automatically expose new tables" **disabled** and
"Enable automatic RLS" **enabled**. That is why migration
`20261007000006_service_role_grants.sql` exists: with auto-exposure off, new
tables receive no grants at all, including to `service_role`.

### 3. Vercel — done ✅

Live at <https://vendra-psycho-projects.vercel.app>, project `psycho-projects/vendra`.

```bash
cd web
npm run env:push:dry   # show which variables would be set, without values
npm run env:push       # copy the non-empty values from .env.local into Vercel
npm run deploy         # vercel --prod
```

`env:push` prints only variable names and lengths, never values, and skips
`VERCEL_OIDC_TOKEN` because that is a deployment credential the CLI manages
rather than application configuration. Always dry-run first.

Two Vercel behaviours the script works around, both learned from its error
messages rather than guessed:

- `--type config` and `--sensitive` are mutually exclusive. `--sensitive` alone
  implies Secret.
- A `NEXT_PUBLIC_` variable can never be a Secret, so every one of them must use
  `--type config`. That is correct rather than a workaround: the anon key is sent
  to the browser by design.

**Deployment protection is on.** The project is set to `all_except_custom_domains`,
so the `*.vercel.app` URL returns a Vercel sign-in redirect. The pages themselves
are verified working behind it (`vercel curl`, and the end-to-end suite against
the live URL). To let the public reach it, turn off Vercel Authentication for this
project in the dashboard, or attach a custom domain, which the setting exempts.

### 4. Walrus Memory — needed for cross-session recall

Vendra uses **service-managed** custody: the server holds the Walrus owner key
and each shop gets its own account reference and unique namespace. This is
chosen and justified in [`WALRUS_ACCOUNT_CUSTODY.md`](WALRUS_ACCOUNT_CUSTODY.md)
and disclosed in the UI.

A funded Sui testnet wallet now exists. Creating the Walrus Memory account object
additionally needs the Walrus Memory package id and the AccountRegistry shared
object id for the target network. Those are **not** published as a simple
credential page, and they have deliberately not been guessed. Provisioning will
use the SDK's own `@mysten-incubation/memwal/account` entry point
(`createAccount`, `addDelegateKey`) once those two values are confirmed.

**Until then the application still works.** Confirmed deal events save to
Postgres, a `walrus_memory_sync` row records the pending write, and Ask Vendra
says memory is unavailable and falls back to searching the retailer's real
records. Nothing is reported as remembered that was not.

---

## Running locally

```bash
# Node.js 20.19+ or 22.12+ (built and tested on Node 24.13.0)
cd web
npm install
cp .env.example .env.local     # then fill in the values above
npm run dev                     # http://localhost:3000
```

Verify the build:

```bash
npm run typecheck      # types
npm run lint           # lint
npm run build          # production build
npm test               # all vitest suites
npm run test:unit      # unit suites only, no credentials needed
npm run test:isolation # cross-shop isolation against the live database
npm run test:erasure   # privacy erasure against the live database
npm run test:e2e       # full journey, local (needs `npm run dev`)

# the same journey against a deployment, which is what proves the build works
E2E_BASE_URL=https://vendra-psycho-projects.vercel.app npm run test:e2e:prod

# housekeeping: test data must not accumulate
npm run verify:clean   # row counts, auth accounts, storage objects
npm run clean:test     # remove leftover test accounts and their shops
npm run auth:list      # show every account and flag which are test accounts
```

### What the test suites mean

| Suite | Runs without credentials | Meaning |
|---|---|---|
| `tests/unit/` | Yes | 76 tests over validation, grounding, memory statements, permissions, rate limits |
| `tests/tenant-isolation/` | Needs Supabase keys | Proves one shop cannot read or write another shop's rows through the REST API. **13 tests, currently passing.** |
| `tests/privacy-erasure/` | Needs Supabase keys | Proves erasure removes what it claims to remove, **and** that `deal_events` is still append-only afterwards. Written because erasure was silently broken. **Currently passing.** |
| `tests/walrus-memory/` | Needs Walrus credentials | Proves one namespace cannot return another shop's memories. **Currently skipping.** |
| `scripts/e2e-smoke.mjs` | Needs Supabase + Gemini | Drives the whole journey over HTTP and asserts the answer is grounded. **19/19 passing locally.** |
| `scripts/e2e-prod.mjs` | Needs Supabase + Gemini + a deployment | The same journey against the production build, plus the public routes and unauthenticated rejection. **23/23 passing.** |

A green run with no credentials **does not mean isolation is verified**. The
Walrus suite prints an explicit skip reason to the console. This is deliberate:
an unverified security guarantee must never look like a pass.

`npm run verify:clean` is run after every test run for the same reason. A leftover
test record would be indistinguishable from a real retailer's data, and this
project must not contain fabricated evidence.

---

## Architecture

```
Browser
  │
  ├─ Supabase Auth (cookie session, @supabase/ssr)
  │
  ▼
Next.js App Router server
  │
  ├─ tenancy.ts          derives shop scope from session membership ONLY.
  │                      A client-supplied shop_id is a hint, never authority.
  ├─ API routes          validate with Zod, then act
  ├─ Postgres + RLS      canonical store. RLS is the enforcement layer.
  ├─ Private Storage     evidence files, short-lived signed URLs only
  ├─ Walrus Memory       cross-session recall, one namespace per shop
  └─ Gemini              generates an answer FROM resolved records only
```

### The three rules that matter

**1. Tenant scope comes from the session, never the browser.**
`resolveShop(userId, requestedShopId)` looks the requested id up *among shops
the user is already a member of*. A foreign id resolves to `null`, not to that
shop. Row Level Security enforces the same thing independently at the database.

**2. A memory is not proof.**
Every recalled memory is resolved back to a canonical, non-superseded
`deal_events` row **inside the same shop** before it can support an answer.
Memories that cannot be traced are discarded, not shown. If nothing survives,
Vendra says it could not find a saved record.

**3. Deletion is reported per layer, and only when verified.**
`POST /api/privacy/erase` deletes records and files, switches the shop's memory
off, and reports the Walrus layer as **blocked** — because the MemWal SDK
exposes no delete method and the wallet-authenticated Security Delete flow has
not been verified in this deployment. Vendra does not claim erasure it has not
checked.

---

## Custody disclosure

**Service-managed.** For this pilot Vendra's service controls the Walrus owner
account for each shop. Shops are isolated from each other, but the owner key is
not held by the retailer, and the product says so plainly in onboarding and
settings. This is custodial, and it is described as custodial.

Full reasoning, rejected alternatives and remaining limitations:
[`docs/walrus-memory-notes.md`](docs/walrus-memory-notes.md).

---

## Documentation

| File | What it covers |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Product brief and first customer |
| [`APP_BLUEPRINT.md`](APP_BLUEPRINT.md) | Market, features, architecture, pricing hypotheses |
| [`FRONTEND_SPEC.md`](FRONTEND_SPEC.md) | Approved design system, section layouts, motion, video |
| [`DATA_API_CONTRACTS.md`](DATA_API_CONTRACTS.md) | Schema and API contracts |
| [`PRIVACY_SECURITY.md`](PRIVACY_SECURITY.md) | Data flow, access model, key custody, deletion risk |
| [`TECH_DECISIONS.md`](TECH_DECISIONS.md) | Accepted choices and open gates |
| [`WALRUS_ACCOUNT_CUSTODY.md`](WALRUS_ACCOUNT_CUSTODY.md) | Custody decision process |
| [`WALRUS_MEMORY_PLAN.md`](WALRUS_MEMORY_PLAN.md) | Write, recall, isolation and deletion contract |
| [`BUILD_PLAN.md`](BUILD_PLAN.md) | Staged build and validation sequence |
| [`SUBMISSION_PLAN.md`](SUBMISSION_PLAN.md) | Challenge evidence checklist |
| [`docs/privacy-and-data-flow.md`](docs/privacy-and-data-flow.md) | Data flow as implemented |
| [`docs/email-delivery.md`](docs/email-delivery.md) | Email sign-up: provider choice, diagnosis, and what it took to be wrong six times |
| [`docs/walrus-memory-notes.md`](docs/walrus-memory-notes.md) | Custody decision and verification status |
| [`docs/real-user-test-log.md`](docs/real-user-test-log.md) | Consented pilot evidence (currently empty) |

---

## Video asset

One looping ambient video is mounted behind every landing section. Measured
metadata for both the source export and the production web copy is recorded in
[`FRONTEND_SPEC.md` §1.5a](FRONTEND_SPEC.md#15a-verified-video-metadata-recorded-from-the-actual-file).

The source export is **1280×720**, not the 1080p the brief targeted, and carried
an AAC audio track. The audio was removed and the web copy re-encoded to H.264
Main at 1.13 MB. The resolution shortfall is recorded honestly rather than
papered over.

---

## Licence

MIT. See [LICENSE](LICENSE).

## Privacy notice

`/privacy` in the application is written to match what is actually implemented,
including the custodial memory account and the unverified erasure path. It is
product documentation, not legal advice, and has not yet passed a qualified
privacy review.