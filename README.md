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

Read this section before anything else. **The application is fully implemented,
built and tested. It is not yet connected to live services**, because the
credentials below require manual account creation that has not been done yet.

| Area | State |
|---|---|
| Database schema, migrations, RLS, private storage | Written and complete |
| Server API (all 19 routes in `DATA_API_CONTRACTS.md` §5) | Written and complete |
| Landing page, auth, onboarding, all 8 authenticated routes | Written, built, browser-verified |
| Deal lifecycle: quote → terms → delivery → issue → resolution | Written and complete |
| Walrus Memory adapter (real SDK `@mysten-incubation/memwal` 0.1.8) | Written and complete |
| Grounded recall + follow-up drafting (Gemini) | Written and complete |
| Unit tests | 76 passing |
| Tenant-isolation and Walrus-isolation tests | Written; **skip loudly** without credentials |
| `tsc --noEmit`, `eslint`, `next build` | All clean |
| Lighthouse (a11y / best practices / SEO) on `/`, `/sign-in`, `/privacy`, `/onboarding` | 1.00 / 1.00 / 1.00 |
| Live Supabase project | **Not created — manual action required** |
| Live Gemini key | **Not supplied — manual action required** |
| Walrus delegate credentials | **Not supplied — manual action required** |
| Deployment to Vercel | **Blocked: no Vercel account on this machine** |

**No claim in this repository is made about usage, memory counts, testimonials
or challenge completion.** There are no real users yet.

---

## Required manual setup

These are genuinely blocked, not skipped. Each is short.

### 1. Supabase project (blocking everything)

Docker is not installed on this machine, so a local Supabase stack cannot run,
and the Supabase CLI is authenticated to an unrelated organisation
("Homeplug Org") which must not be used. Create a project manually:

1. Create a project at <https://supabase.com/dashboard>, named `Vendra`.
2. Note the **project ref** and the **region**.
3. Copy from **Project Settings → API**: `Project URL`, `anon` public key,
   `service_role` key.
4. Fill them into `web/.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   ```

5. Apply the migrations:

   ```bash
   cd supabase
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   This creates the tables, Row Level Security policies, the private
   `evidence` storage bucket and its policies. There is no seed data: Vendra
   seeds nothing, because seeding would fabricate the very evidence this project
   is required to produce honestly.

### 2. Google Gemini key

1. Create a key at <https://aistudio.google.com/apikey>.
2. Set `GOOGLE_GENERATIVE_AI_API_KEY` in `web/.env.local`.
3. Confirm the model id. The default is `gemini-2.5-flash`; check the current
   catalogue and pricing at <https://ai.google.dev/gemini-api/docs/pricing>
   before pinning `GOOGLE_MODEL_ID`.

**Without this key the application still works.** Ask Vendra falls back to a
deterministic summary of the retailer's own saved records and labels it as not a
model answer. It never invents a fact.

### 3. Walrus Memory delegate credentials

Vendra uses **service-managed** custody: the server holds the Walrus owner key
and each shop gets its own account reference and its own unique namespace. This
is chosen and justified in [`WALRUS_ACCOUNT_CUSTODY.md`](WALRUS_ACCOUNT_CUSTODY.md)
and disclosed in the UI.

To enable live memory you need a funded testnet Sui account and a registered
Ed25519 delegate key, then set `WALRUS_MEMORY_ACCOUNT_ID`,
`WALRUS_READER_CREDENTIAL` and `WALRUS_DELEGATE_PRIVATE_KEY`.

**Without these the application still works.** Confirmed deal events save to
Postgres, a `walrus_memory_sync` row records the pending write, and Ask Vendra
reports that deal memory is unavailable. Nothing is ever reported as remembered
that was not.

### 4. Vercel account (blocking deployment)

The Vercel CLI is installed but **not authenticated**, and no token exists on
this machine. Run `vercel login`, then:

```bash
cd web
vercel --prod
```

Set the same environment variables in the Vercel project's environment settings.

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
npx tsc --noEmit        # types
npx eslint .            # lint
npm run build           # production build
npx vitest run          # tests
```

### What the test suites mean

| Suite | Runs without credentials | Meaning |
|---|---|---|
| `tests/unit/` | Yes | 76 tests over validation, grounding, memory statements, permissions, rate limits |
| `tests/tenant-isolation/` | **No — skips loudly** | Proves one shop cannot read or write another shop's rows through the REST API |
| `tests/walrus-memory/` | **No — skips loudly** | Proves one namespace cannot return another shop's memories |

A green run with no credentials **does not mean isolation is verified**. Both
suites print an explicit skip reason to the console. This is deliberate: an
unverified security guarantee must never look like a pass.

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