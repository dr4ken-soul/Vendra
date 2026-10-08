# Vendra Build and Validation Plan

**Status:** Proposed sequence, not an implementation commitment. No code before explicit user approval.  
**Planning date:** 6 October 2026  
**Challenge deadline:** 9 October 2026

## Critical path

1. Confirm the planning documents. The implementation agent then researches and documents the Walrus account-custody choice; do not ask the user to select a technical model.
2. Prove Walrus Memory account isolation, delegate access, async write/retrieval and permanent deletion in a sandbox.
3. Build the smallest secure quote-to-outcome workflow with evidence provenance.
4. Test with real retailers, then publish the public repo and write factual challenge evidence.

Do not collect sensitive real retailer data until tenant isolation and the deletion path have passed an end-to-end test. The current reviewed Walrus TypeScript SDK API has no high-level production deletion helper. The documented Security Delete API requires an owner-wallet-signed flow. Treat deletion as a critical-path dependency, not a polish task.

## Approval gate

**Gate 0: planning approval**

- [ ] User approves `PRODUCT.md`, `APP_BLUEPRINT.md`, `FRONTEND_SPEC.md`, `DATA_API_CONTRACTS.md` and the supporting plans.
- [ ] User accepts the proposed MVP boundaries and stack.
- [ ] The implementation agent researches, chooses and documents the safest workable Walrus custody model under `WALRUS_ACCOUNT_CUSTODY.md`; do not ask the user to make this technical choice.
- [ ] User uploads the approved video file or confirms it will be supplied later.

No source code, migrations, app routes, dependency files or runnable configuration before this gate.

## Phase 1: Walrus technical and privacy spike

**Estimate:** 1–3 focused days after approval.  
**Purpose:** prove the riskiest integration before building around assumptions.

- Create two disposable test shop scopes, each with a different Walrus Memory owner account and namespace.
- Verify owner and Ed25519 delegate setup, server-side secret storage and revocation.
- Write a concise memory from a confirmed test event, wait for the async write job, then retrieve it in a fresh session.
- Attempt cross-shop recall and confirm it returns no other shop’s data.
- Correct or supersede one memory and verify the newest canonical event wins.
- Run the documented Security Delete flow with owner-wallet signing; verify the target blob cannot be retrieved through the supported read path and note any index, relayer, retention or UI limitations.
- Compare wallet-owned and app-managed account onboarding with at least three target users before deciding production custody.

**Exit criteria:** account creation, key custody, isolation, recall and deletion are documented with actual test results. If deletion cannot be verified, keep real data out of Walrus and do not promise erasure.

## Phase 2: secure application foundation

**Estimate:** 3–5 focused days.

- Create the Next.js/TypeScript web app after approval.
- Configure Supabase Auth, Postgres, private Storage and Row Level Security.
- Implement shop membership and server-derived tenant scope.
- Add audit events and safe error handling.
- Test that an account cannot read another shop’s rows, storage objects or API responses.
- Add an environment template with names and descriptions only, no secrets.

**Exit criteria:** automated tenant-isolation tests pass for database, storage and server routes.

## Phase 3: deal lifecycle

**Estimate:** 3–5 focused days.

- Create supplier and product labels scoped to one shop.
- Capture a quote and agreed terms with human review.
- Attach private evidence and link it to a deal event.
- Record delivery, discrepancy and resolution as append-only events.
- Preserve corrections and superseded facts.

**Exit criteria:** a retailer can create, review, update and browse the full timeline on mobile and desktop. Every record has a source and audit trail.

## Phase 4: Walrus Memory and assistant

**Estimate:** 3–5 focused days after Phase 1 passes.

- Implement explicit `remember` writes from retailer-confirmed deal events. Do not auto-save all chat.
- Persist Walrus async job IDs and state; surface pending/failed status honestly.
- Implement recall using the authenticated shop’s account and namespace.
- Resolve every recalled memory to canonical Supabase events before generation.
- Generate an answer with source links; refuse to invent facts when records are missing.
- Draft, but never send, a supplier follow-up.

**Exit criteria:** new-session recall works for the correct shop, citations resolve, unknowns are stated and the LLM cannot use another shop’s context.

## Phase 5: responsive frontend and accessibility

**Estimate:** 3–5 focused days, parallelisable only after the data contracts are stable.

- Implement the approved landing page, A2 nav and one persistent video asset.
- Build responsive authentication, capture, timeline and recall views.
- Respect reduced motion, keyboard use, focus, contrast and accessible accordions.
- Use the exact design values and classes in `FRONTEND_SPEC.md`.
- Record video metadata after the asset is received; do not infer it from the generation prompt.

**Exit criteria:** desktop and mobile review passes; video failure/reduced-motion fallback works; no horizontal overflow or inaccessible control state.

## Phase 6: pilot, real usage and evidence

**Estimate:** at least 5–7 calendar days to include real onboarding and several days of use. This phase cannot be simulated by seed data.

- Recruit at least three distinct consenting retailer users.
- Each retailer records at least ten genuine memories from their own real, non-sensitive or explicitly approved activity.
- Use a separate tenant and Walrus account scope per retailer.
- Capture exact test prompts, retrieved source references, corrections, memory counts and error events with participant consent.
- Demonstrate a fresh-session before/after comparison. Keep the “before” answer and “after” sourced answer.
- Use the deployed app for a few days and log dates of actual use.
- Ask about trust, time saved, missing fields, account onboarding and willingness to pay. Do not script positive responses.

**Exit criteria:** independently verifiable records exist for all challenge requirements. Redact personal data in public evidence.

## Phase 7: open-source submission and communications

**Estimate:** 2–3 focused days after actual use.

- Publish a public GitHub repository with licence, complete setup instructions, `.env.example`, model/runtime versions and tests.
- Include deployment information and a short architecture/data-flow note.
- Draft a 500–800 word Medium or Inkray article using the exact real test evidence and lessons, including at least one failure or limitation.
- Publish only the one original X post in `MARKETING.md`, tagging `@WalrusProtocol` and using `#WalrusMemory`.
- Verify every claim in the README, article and post against the evidence log.

**Exit criteria:** no placeholder metrics, no fabricated outcomes, and no claim of permanent deletion unless the real Walrus blob flow is verified.

## Baseline schedule

A realistic AI-assisted, part-time product build is approximately **four weeks** from approval through security work, implementation and multi-day retailer validation. Estimates assume access to Supabase, a working model API, a supported Walrus deployment, and a willing pilot cohort. External approvals, wallet custody or deletion issues may extend it.

The 9 October 2026 challenge deadline is only three days after the planning date. If implementation is not already underway, the complete build, real-user use for several days and 500–800 word evidence-based article are a schedule risk that cannot be guaranteed. Do not shortcut user consent, account isolation or deletion testing to meet the date. Submit only if the real requirements are met; otherwise keep the product work and submit later if the organiser permits.

## Release gates

- **Gate A:** Walrus account model, isolation and deletion verified.
- **Gate B:** Supabase tenant isolation and private storage tests pass.
- **Gate C:** deal evidence and immutable correction history pass.
- **Gate D:** sourced recall works across sessions; unsupported questions are handled safely.
- **Gate E:** three real users, ten genuine memories each and several days of deployment use are logged.
- **Gate F:** public repo, setup instructions, article and the single X post are fact-checked.

A failed gate blocks promotion to real customer data.