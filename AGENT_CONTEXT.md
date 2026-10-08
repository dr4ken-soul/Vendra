# Vendra Agent Context and Build Rules

**Read this file and `APP_BLUEPRINT.md` before any implementation.**  
**Current state:** IMPLEMENTED. The application, migrations, tests and documentation exist. Live credentials, live Walrus verification, real-user evidence and deployment are outstanding — see `README.md` → *Required manual setup*.

## Hard rules

1. **Planning was approved and the build executed.** Further changes should still be justified against the specification documents, but the approval gate below is satisfied.
2. Build Vendra as one coherent procurement-deal lifecycle: quote → agreed terms → delivery → issue/resolution → evidence-backed recall. Do not turn it into an unrelated feature bundle.
3. Product name is **Vendra**. Use a text wordmark only. Do not create a logo, monogram or brand symbol. Ask before adding one.
4. Do not add a soundbox, POS, inventory suite, lender, supplier marketplace, public supplier score or autonomous purchasing/messaging feature to V1.
5. The initial market is independent grocery/provisions retailers in a reachable **Delta State** cluster. Do not assume a city and do not revert to Rivers State.
6. Keep the responsive web-app decision. The retailer owns the private shop workspace; staff are permissioned; suppliers see nothing unless a retailer explicitly shares a specific record.
7. The landing page uses **one** approved looping video mounted behind every section, including the footer. The five retained images are references for that one video, not a request to create five clips. Do not use superseded images or delete approved stills.
8. Do not claim to have viewed, tested or verified the approved MP4. It is not in the shared workspace. Record its exact path and metadata after the user uploads it to `<Vendra project root>\video`.
9. Use the approved frontend direction and `FRONTEND_SPEC.md`: A2 scroll-morph pill, Barlow + Azeret Mono, cool light neutrals, restrained vermilion, specified low motion, exact section order and one persistent video.
10. Never invent testimonials, retailer outcomes, savings, customer counts, memory counts, deployment status, article findings or challenge completion. Label synthetic fixtures clearly and never use them as user evidence.
11. There must be exactly **one** original X post in the planned campaign. Do not draft alternatives, a thread or additional posts. It must tag `@WalrusProtocol` and use `#WalrusMemory`.
12. Use British English in project documentation and user-facing copy unless the user requests otherwise.

## Product and data rules

- Supabase Postgres is the canonical source for typed deal events, membership, evidence metadata and audit records.
- Walrus Memory is the cross-session semantic recall layer. Write only concise, validated, evidence-anchored facts after retailer confirmation. Do not automatically persist every chat message.
- Each shop has a separate Walrus Memory account and namespace. Never use a shared global tenant account or trust a browser-supplied `shop_id` for authorisation.
- A recalled memory is not proof by itself. Resolve it to a canonical Supabase event and evidence before using it in an answer. Cite sources. If no matching source exists, say no saved record was found.
- Keep original evidence in a private object-storage bucket. Do not put raw receipts, private URLs, personal contacts or private keys into Walrus Memory.
- Walrus account ownership and key custody are an implementation decision delegated to the build agent. Research current Walrus docs, test isolated options, choose and justify the safest workable model without asking the user to choose. Never say “retailer-owned” unless the retailer controls the Sui owner key. Any service-managed per-shop pilot must be individually isolated, honestly disclosed, key-secured and used only with consenting participants and low-sensitivity data after deletion is verified.
- Permanent Walrus deletion uses the documented wallet-authenticated Security Delete API. Keep a retailer-controlled erasure request pending until the owner signature, successful transaction and post-delete checks are verified. Clearing an index or calling a mock `forget` method is not proof that the blob was erased. Verify the signed deletion path end to end before making erasure promises or onboarding sensitive records.
- Do not expose Supabase service-role credentials, LLM secrets, Walrus delegate keys or Paystack secrets to the browser.

## Challenge evidence rules

The Walrus Session 8 requirements include a deployed chatbot used for a few days; at least three distinct users with at least ten genuine memories per user; a public open-source repository with setup instructions; an evidence-based 500–800 word Medium or Inkray article; and one tagged X post. Synthetic seed data, private screenshots without consent and aspirational metrics do not count. Keep a dated evidence log and get participant consent.

The challenge deadline is 9 October 2026. As of 6 October 2026, the time available is a serious risk. Do not cut security or invent evidence to claim completion.

## Before implementation

1. Ask the user to approve the planning deliverables.
2. The implementation agent researches and chooses the Walrus owner-account/delegate custody path. If it cannot verify isolation, key handling or deletion, keep real personal/supplier data out of the prototype.
3. Upload and inspect the final approved video file.
4. Pin exact package and model versions only after verifying current docs and pricing.
5. Implement tenancy isolation and deletion tests before onboarding real shops.

## Workspace paths

- The project root is `C:\Users\Paul\Documents\Coding Area\Agents\Vendra`.
- Application source: `web/`. Migrations: `supabase/migrations/`. Tests: `tests/`. Implementation notes: `docs/`.
- The five approved stills and the approved video export are retained under `video/`. The optimised web copy ships as `web/public/video/vendra-ambient-loop.mp4`.
