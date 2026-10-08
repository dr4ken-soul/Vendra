# Vendra Technical Decisions and Open Questions

**Status:** Implementation complete. Decisions below are recorded as implemented, with the remaining gates stated explicitly.  
**Last reviewed:** 8 October 2026

## 0. Implementation outcome

The application is built: Next.js 16 App Router, TypeScript, Tailwind v4, Motion, Supabase Auth + Postgres with RLS + private Storage, the Walrus Memory adapter, and grounded Gemini recall. `tsc`, `eslint`, `next build` and 76 unit tests are green, and the four public routes score 1.00 on Lighthouse accessibility, best practices and SEO.

What is **not** done, and is claimed nowhere: live credentials, live Walrus isolation verification, verified permanent erasure, real users, and deployment. See `README.md` → *Required manual setup* and `SUBMISSION_PLAN.md`.

## 0a. Custody decision record

Completed as required by `WALRUS_ACCOUNT_CUSTODY.md` §7.

| Item | Record |
|---|---|
| Chosen owner-account model | **Service-managed, one account and one namespace per shop.** Owner signing mode `service_custodian`. The retailer does **not** hold the owner key. |
| Rejected alternatives | **A (retailer-controlled)** remains the production goal but was not selected for the pilot: wallet onboarding, signing and recovery education is a real usability risk for grocery retailers, and no confirmed recovery path exists in the reviewed docs. **C (embedded with retailer-held recovery)** has no confirmed onboarding or recovery path and was not built from guesswork. |
| Account and namespace isolation | Namespace derived **server-side** from the shop id plus 8 random bytes, with a unique partial index on `shops.walrus_namespace`. No client input reaches it. **Cross-shop memory isolation is UNVERIFIED**: `tests/walrus-memory/isolation.test.ts` is written and skips loudly without credentials. |
| Delegate/key operations | The Ed25519 delegate key lives only in the server environment. The database stores only `walrus_delegate_key_ref`, a pointer. `next.config.ts` marks the SDK server-only so it cannot enter a client bundle. Rotation = change the key in the key store, update the reference, re-run `POST /api/shops/:id/memory`. Revocation = remove the delegate from the account; the app then fails closed. |
| Deletion | **NOT VERIFIED.** The SDK exposes no `forget`/delete method and the wallet-signed Security Delete flow has not been exercised. `POST /api/privacy/erase` switches the shop's memory scope off and reports the `walrus_memory` layer as **`blocked`**, never as `complete`. |
| Retailer disclosure | Exact wording used in onboarding, settings and `/privacy`: *"For this pilot, Vendra's service controls the Walrus owner account for this shop. Your shop has its own separate memory scope that no other shop can read, but the owner key is not held by you."* The phrase "retailer-owned" appears nowhere. |
| Limitations | An operator of the Vendra service could in principle reach the account holding a shop's memories. Key rotation is documented but untested. Revocation is untested. No retention schedule is published because it cannot yet be enforced. |

## 0b. Decisions taken during implementation

| Area | Decision | Reason |
|---|---|---|
| Next.js Cache Components | Disabled | Every authenticated route reads the session cookie and derives shop scope server-side, so each would additionally need a Suspense boundary around the cookie read with no caching benefit. Nothing tenant-scoped is prerendered either way. |
| Auth method | Email + password with confirmation; no provider chooser | One configured method, per `FRONTEND_SPEC.md` §4.4. No wallet is required to create a Vendra login. |
| Memory write path | `walrus_memory_sync` row inserted **before** the network call | A crash between the two cannot silently lose the fact that a memory was owed. |
| Memory count | Read from `listNamespaces().memory_count` | The only provider-reported measure. A local counter would be a fabricated number. |
| Deal status | Derived from recorded events, with a database constraint | A client cannot assert `resolved` with no resolution event. Prevents client state from becoming source of truth. |
| Deletion reporting | Tracked per data class | A layer that cannot be verified is reported as blocked, never counted as done. |
| Navigation morph | CSS transition rather than Motion `layout` | Motion's `layout` sets `position: relative`, detaching the fixed pill from the viewport. Verified fixed in-browser after the fix. |
| `formatMoney` signature | Dropped the time-zone parameter | Currency formatting is not date-bound; the parameter was misleading. |
| Supabase storage verification | `storage.info()` before recording metadata | Verifies the object exists and its real size instead of trusting the client. |

## Accepted direction

| Area | Decision | Reason / boundary |
|---|---|---|
| Product | Evidence-backed procurement memory for independent retailers | One supplier-deal lifecycle from quote to outcome; not a marketplace or a feature bundle. |
| Platform | Responsive web app | Reachable on shop phones and desktop without a native-app release. |
| Initial market | One reachable grocery/provisions cluster in Delta State | Founder can recruit and visit; exact city is not assumed. |
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, Motion | Good fit for one responsive web product and approved design. |
| Data/auth/files | Supabase Auth, Postgres with RLS, private Supabase Storage | Canonical deal records, membership, evidence metadata and tenant enforcement. |
| Semantic memory | Walrus Memory through `@mysten-incubation/memwal` | Cross-session recall; keep one account and namespace per shop. |
| Model candidate | Google Gemini Flash via Vercel AI SDK | Non-OpenAI/Anthropic candidate for the challenge; exact model/version and cost must be checked at implementation. |
| Hosting | Railway for first deployed app; Render is an acceptable fallback | Railway Hobby published at $5/month minimum with $5 usage included; watch metered overages. |
| Payments | Paystack after pilot validation | Local NGN candidate; do not integrate billing before willingness to pay is tested. |
| Privacy | Retailer-controlled ownership is the production goal; private by default, permissioned staff, and no supplier access unless an individual record is explicitly shared | The implementation agent selects and verifies the Walrus owner-account path and records its custody disclosure before real retailer data is accepted. |
| Brand | Text-only Vendra wordmark, no symbol | User has explicitly said not to add a logo/brand mark without asking. |
| Video | One looping ambient video behind every landing section through the footer | Generated from five retained references. User reports approval; the MP4 is still unavailable for inspection. |

## Delegated implementation decision: Walrus owner-account custody

Walrus Memory’s documented non-runtime setup requires an owner Sui account and a registered Ed25519 delegate key. The reviewed official integration guidance does not establish a non-crypto, retailer-facing account-provisioning flow. A normal retailer login is therefore not automatically the same thing as control of the Walrus owner account.

| Option | Retailer experience | Ownership and risk | Status |
|---|---|---|---|
| **A. Retailer-controlled Sui owner account** | Strongest control claim, but may require a wallet connection, signing and recovery education that is unfamiliar to the target user. | Retailer controls the owner key and can authorise deletion/revocation. Lower service custody risk; higher onboarding friction. | Preferred production privacy model; usability must be tested. |
| **B. Service-managed account per shop** | Lowest wallet friction. The retailer uses normal Vendra login. | The account is controlled by Vendra’s service, even if each shop has a different account and namespace. It is isolated but not retailer-owned. Requires explicit disclosure, per-shop key management, incident response, deletion access and consent. | Implementation agent may select this for a controlled pilot if isolation, key security and deletion are verified. Disclose custody; never call it retailer-owned. |
| **C. Embedded account with retailer-held recovery** | Could hide wallet complexity while giving the retailer a recovery path. | No such end-to-end onboarding/recovery path has been confirmed in the reviewed Walrus docs. Key derivation, backup, loss and recovery require a separate security design. | Unvalidated. Do not assume support or implement from guesswork. |

### Recommendation

Keep **retailer-controlled ownership** as the production privacy goal. The implementation agent owns the technical decision: test the owner-controlled route first, compare it with a service-managed account per shop, then choose and justify the safest workable model without asking the user to choose. A managed account is an explicit custodial mode, not a privacy-equivalent substitute. It may be used for a controlled pilot only if the agent verifies isolation, key handling, revocation and deletion, and the participant notice clearly explains custody. Keep real data out if those checks fail. Do not describe a service-managed account as retailer-owned.

## Critical open decision: permanent Walrus deletion

- Official Walrus guidance describes a wallet-authenticated Security Delete API: challenge/verify, list deletable blobs, prepare a sponsored Sui transaction, have the owner wallet sign and submit it.
- The reviewed MemWal TypeScript SDK reference has no high-level production `forget` or delete method. An SDK issue filed on 27 September 2026 reports that gap; treat it as an issue report, not as an enduring API guarantee.
- Clearing an application or search index is not equivalent to removing the Walrus blob.
- The exact API, sponsor configuration, owner-signing requirements and read-path result must be verified in the selected deployment before the product promises erasure.

**Decision:** deletion implementation and end-to-end verification are release gates. Do not accept sensitive data until the actual deletion path is demonstrated or disclose that deletion is not yet available and use only non-sensitive test data.

## Other unresolved items

| Question | Current position | Gate |
|---|---|---|
| Exact Gemini model ID | Candidate only; pricing and availability change. | Pin at implementation after checking current official docs and a cost/quality test. |
| First Delta cluster | Choose based on founder access and interviews; no city assumed. | Confirm before retailer recruitment. |
| Vendra pricing | Pilot free; Solo ₦2,500/month and Team ₦7,500/month are hypotheses. | Validate with real purchase workflow and paid intent. |
| Video file | User reports approved one-loop video; binary not present. | Inspect exact file, codec, dimensions, duration, file size and loop seam after upload. |
| Data retention | Minimise data and provide export/delete controls. Exact retention schedule needs legal and technical review. | Complete NDPA and deletion review before public onboarding. |
| Open-source licence | MIT is a candidate. | Confirm before public repository creation. |

## Source links

- [Walrus Memory agent runtimes](https://docs.wal.app/walrus-memory/guides/agent-runtimes)
- [Walrus Memory quick start and account/namespace scope](https://docs.wal.app/walrus-memory/getting-started/quick-start)
- [Official Walrus Security Delete guide](https://docs.wal.app/walrus-memory/guides/delete-memories-programmatically)
- [MemWal SDK deletion issue #1043](https://github.com/MystenLabs/MemWal/issues/1043)
- [Official DeepSurge challenge brief](https://www.deepsurge.xyz/hackathons/c0141a4a-21be-4009-bc63-7c168608c849)