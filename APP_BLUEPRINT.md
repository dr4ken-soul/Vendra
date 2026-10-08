# Vendra App Blueprint

**Document status:** Planning draft for review. No application code has been written.  
**Product:** Vendra  
**Primary market hypothesis:** independent grocery and provisions retailers in Delta State, Nigeria  
**Challenge context:** Walrus Session 8: Chatbots That Remember

## 1. Product summary

Vendra is an evidence-backed procurement memory for independent retailers. It records one supplier-deal lifecycle: quote, agreed terms, delivery, issue and resolution. A retailer can later ask what happened with a supplier or product. Vendra retrieves relevant memories, verifies their record references and answers with links to the underlying evidence. It can prepare a follow-up draft, but the retailer chooses whether to send it.

The value is the joined workflow, not a feature bundle. **MarketMemory** helps the retailer recall the previous deal. **CaseProof** attaches each recalled fact to a deal event or evidence file. Vendra does not replace WhatsApp, create a supplier marketplace or act as a POS.

### Challenge requirements and timing

The attached official challenge brief runs from 18 September to 9 October 2026. It asks for a chatbot that uses Walrus Memory, is deployed somewhere real and used for a few days, demonstrates at least three distinct users with at least ten memories each, and is submitted with a public open-source repository, model/runtime details, an honest build article of about 500–800 words and an X post. See the [DeepSurge challenge brief](https://www.deepsurge.xyz/hackathons/c0141a4a-21be-4009-bc63-7c168608c849).

As of 6 October 2026, the stated deadline is three days away. The planning and approval workflow, actual build, public deployment and multi-day use cannot be treated as already complete. Do not invent user activity, memory counts, deployment or evidence. If the deadline is missed, keep the product scope and submit only when the evidence is real.

## 2. Customer and market

### Primary customer

The first customer is the owner or manager of a single independent grocery or provisions shop that reorders frequently from several wholesalers or distributors. The buyer may confirm a quote by call or WhatsApp, retain a receipt or photo, and handle shortages or delivery issues informally.

The first pilot should be in one market cluster in Delta State, chosen according to where the founder can recruit and visit shop owners. The founder has corrected the earlier assumption: the relevant home state is **Delta, not Rivers**. No specific city is assumed here. Start with one cluster, interview the retailers, and expand only after repeat use is demonstrated.

### Three customer segments

1. **Independent grocery and provisions shops:** repeated purchases, multiple suppliers, frequent price changes and small delivery discrepancies. This is the recommended beachhead.
2. **Open-market retailers and small wholesalers:** regular purchases and supplier negotiations, with stronger need to remember prior terms.
3. **Small local chains with two to five shops:** shared supplier memory and staff access, suitable for a later Team plan.

The owner/operator pays. Store staff are users under the owner’s permission. Suppliers do not need an account for V1.

### Current alternatives and switching reason

The default alternatives are WhatsApp threads, phone calls, paper notes, folders of receipts and spreadsheets. Those tools are already familiar and usually have no separate subscription cost. The switching reason is not a generic promise to digitise a shop. It is that a retailer can retrieve a specific prior agreement, compare it with what arrived and show the source record before the next purchase or follow-up.

Research supports treating mobile messaging and informal records as important context, not as proof that every Delta retailer will adopt Vendra. A [World Bank/IFC Nigeria MSME report](https://documents1.worldbank.org/curated/en/099055202202331735/pdf/IDU0ff38186304ab204c9209dd1037aeeb43b3d8.pdf) reports WhatsApp use among surveyed MSMEs and describes digital channels as a route into the market. A [GSMA Nigerian MSME e-commerce study](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma_resources/webinar-e-commerce-in-nigeria-unleashing-the-opportunity-for-msmes/) found that many surveyed businesses using e-commerce relied on social media channels. These are directional indicators, not Delta-specific adoption forecasts.

### Market sizing, explicitly provisional

The [SMEDAN/NBS 2021 MSME survey](https://www.nigerianstat.gov.ng/pdfuploads/MSMES.pdf) reports 39,654,385 Nigerian MSMEs. A [2022 SMEDAN competitiveness report](https://fatefoundation.org/wp-content/uploads/2024/03/7.-SMEDAN-1.pdf) describes wholesale and retail trade as 33% of the MSME sector. Multiplying those figures gives a broad proxy of approximately **13.1 million wholesale/retail MSMEs**. It is not a count of independent grocery shops, digitally reachable retailers or paying Vendra customers.

| Measure | Planning calculation | Value | Confidence |
|---|---:|---:|---|
| Broad Nigeria TAM proxy | 39,654,385 × 33% | ~13,085,947 businesses | Low as a Vendra customer count. It includes many types of wholesale and retail businesses. |
| TAM revenue ceiling | 13,085,947 × ₦2,500 × 12 | ~₦392.6bn annualised | Theoretical ceiling only, not a forecast. |
| SAM scenario | 1% of the broad proxy | ~130,859 businesses | Assumption for digitally reachable, repeat-purchase retailers. It needs validation. |
| SAM revenue scenario | 130,859 × ₦2,500 × 12 | ~₦3.93bn annualised | Scenario, not a state-level census. |
| Year-one SOM target | 100 paying shops × ₦2,500 × 12 | ₦3m annualised | Founder-led target, not an adoption claim. |

No reliable Delta-specific count of the chosen retailer segment was found in the sources used here. The first research task is to enumerate a small accessible cluster and interview owners. Do not present the national ceiling as Vendra’s addressable market.

### Competitive landscape

Vendra competes with a mix of platforms and informal workarounds. Pricing and feature statements below reflect public materials found during planning. When a vendor does not publish a comparable software price, the table says so instead of guessing.

| Alternative | Public positioning and price signal | Gap Vendra targets |
|---|---|---|
| **OmniRetail / OmniBiz / OmniStore** | B2B ordering, retail distribution, POS and operations products. Public materials describe retail, distributor and manufacturer tools, but a comparable public SaaS price was not found in the [OmniRetail/OmniBiz overview](https://blog.omnibiz.com/omnibiz-announces-a-brand-refresh/). | Vendra is not competing to supply goods or run a POS. It focuses on the retailer’s evidence-backed history of what was agreed and what happened. |
| **Sabi** | B2B commerce infrastructure with marketplace, logistics, inventory and business services. Public per-retailer SaaS pricing was not found in the [Sabi overview](https://www.weforum.org/organizations/sabi/). | Vendra should remain supplier-neutral and recall a retailer’s own outcomes across suppliers, including suppliers outside a marketplace. |
| **Alerzoshop** | Retailers can order goods for their shops through a free app; the business model is tied to commerce and fulfilment rather than a listed memory subscription [Alerzoshop](https://alerzoshop.com/). | Vendra does not source or deliver stock. It preserves the retailer’s own deal history and evidence. |
| **Bumpa** | Nigerian business-management product with public plans including Starter at ₦15,000 quarterly (₦5,000/month) and Pro at ₦30,000 quarterly (₦10,000/month) on its [pricing page](https://www.getbumpa.com/pricing). App Store reviews include positive comments about organising sales and individual complaints about login, paid-feature clarity and a settlement/KYC delay [in individual reviews](https://apps.apple.com/us/app/bumpa-manage-orders-easily/id1497638594?see-all=reviews&platform=iphone). These are not a representative survey. | Bumpa is broader around sales, store operations and online selling. Vendra’s proposed wedge is supplier-deal recall grounded in delivery and resolution evidence. |
| **Fisco** | Starter is free with a 2.5% fee on online payments; Pro is published at ₦10,000/month. Its [public product and pricing information](https://www.usefisco.com/) covers storefront, inventory, orders, payments and customer management. | Sales and storefront management are adjacent, but evidence-backed supplier-deal memory is not the core public positioning. |
| **WhatsApp, calls, paper and spreadsheets** | Usually no incremental software subscription, but records are spread across existing tools. | Vendra must be faster than manually searching chats and clearer than relying on memory. This is the most important substitute to beat. |

Review coverage for several local platforms is sparse or not comparable to G2/Reddit. This blueprint does not invent recurring complaints for those companies. Before launch, conduct retailer interviews and test Vendra against the actual workflow in the selected Delta cluster.

### Validation plan

- Interview 10 shop owners in one Delta market cluster. Ask them to reconstruct the last supplier quote, agreement, delivery and any issue using their current tools.
- Observe three real deal lifecycles, with consent. Record which evidence exists and how much time it takes to find it.
- Recruit at least three consenting test retailers for the Walrus challenge demonstration. Each account must create at least ten genuine, useful memories through use, not through fabricated testimonials or concealed seed data.
- Run the same question in a fresh session before and after memory is enabled. Save the exact query, retrieved record references, answer and correction.
- Treat a retailer as activated only after they save a deal and later return to recall it.

## 3. MVP feature set

### Feature 1: Capture a supplier deal

**User story:** As a retailer, I want to save a quote and the terms I accepted, so that I can check the agreement later.  
**Acceptance criteria:** A deal stores supplier, item, quantity, quoted and agreed terms, date and currency; the retailer can attach a photo, screenshot or note; the retailer reviews extracted details before saving; the original evidence remains linked.  
**Complexity:** Medium.

### Feature 2: Record delivery, issue and resolution

**User story:** As a retailer, I want to compare what arrived with what I agreed, so that a shortage or other issue does not disappear into a chat thread.  
**Acceptance criteria:** A deal has a time-ordered event history; delivery status can be partial, complete or disputed; the user can attach evidence and record the agreed resolution; corrections retain an audit trail.  
**Complexity:** Medium.

### Feature 3: Evidence-grounded conversational recall with Walrus Memory

**User story:** As a retailer, I want to ask about a previous supplier deal in a later session, so that I can make the next purchase with the real history available.  
**Acceptance criteria:** The system recalls only the authenticated shop’s Walrus Memory account and namespace; every factual answer cites one or more deal events; a query with no evidence receives an explicit “I could not find a saved record” answer; cross-shop access tests pass; a memory-write failure is surfaced as pending or failed rather than silently claimed as saved.  
**Complexity:** High.

### Feature 4: Draft a supplier follow-up

**User story:** As a retailer, I want a short follow-up drafted from selected deal evidence, so that I can raise a discrepancy clearly without reconstructing the facts.  
**Acceptance criteria:** The draft lists the deal and evidence used; the user can edit, copy or discard it; Vendra never sends a supplier message or places an order automatically.  
**Complexity:** Medium.

**The V1 feature that earns payment:** reliable recall of a retailer’s own previous terms and outcomes, with evidence attached, especially when that memory is shared with authorised shop staff.

### Explicitly out of scope

No supplier marketplace, catalogue procurement, POS, inventory ledger, bookkeeping suite, credit or BNPL, public supplier ratings, cross-shop benchmarking, automatic supplier messaging, automatic purchasing, native mobile app or soundbox in V1. These would dilute the deal-memory lifecycle and add trust or integration risks before the core value is proven.

## 4. Monetisation

Pricing is a testable hypothesis, not a validated price list. Use a no-card pilot first. Do not charge until users repeatedly return to use recall.

| Plan hypothesis | Price | Scope |
|---|---:|---|
| Pilot | ₦0 for 30 days | One shop, owner plus invited testers, structured deal records and sourced recall. Feedback requested. |
| Solo | ₦2,500/month | One shop, one seat, up to 50 new deal records/month, evidence-linked recall and follow-up drafts. |
| Team | ₦7,500/month | One shop, up to five seats, shared shop memory and role-based access. |
| Multi-shop | ₦20,000/month | Later validation only. Up to three shops, shared owner administration, separate memory scopes. |

Start with monthly billing. Test willingness to pay through interviews and a paid pilot, not a survey alone. A 10% activated-trial-to-paid conversion is a planning assumption only. Paystack is the initial Nigeria payment-provider candidate because it publishes local NGN pricing and payment rails. Its [current pricing page](https://paystack.com/pricing) lists 1.5% + ₦100 for local transactions, with the ₦100 waived below ₦2,500 and fees capped at ₦2,000. Confirm recurring billing, refunds and settlement behaviour before enabling subscriptions.

At a conservative blended paid ARPA of ₦2,500/month, before payment, AI, storage, tax or hosting costs:

| Paying shops | Monthly gross revenue | Annualised gross revenue |
|---:|---:|---:|
| 10 | ₦25,000 | ₦300,000 |
| 50 | ₦125,000 | ₦1,500,000 |
| 200 | ₦500,000 | ₦6,000,000 |
| 1,000 | ₦2,500,000 | ₦30,000,000 |

## 5. Stack and architecture

| Layer | Recommendation | Reason and boundary |
|---|---|---|
| Web application | Current stable Next.js App Router, TypeScript | One responsive web app for the marketing site and authenticated chat/deal experience. |
| Styling and motion | Tailwind CSS and `motion/react` | Matches the approved frontend system. Motion remains restrained. |
| Relational data | Supabase Postgres | Store canonical deal events, memberships, evidence metadata and audit references. Enforce row-level security by shop. |
| Authentication | Supabase Auth | Simple account and session handling. Start with the lowest-friction pilot method, then test phone OTP with retailers before committing to production SMS costs. |
| Evidence files | Private Supabase Storage bucket | Raw receipts and screenshots stay private. Use short-lived signed URLs. Do not store public file URLs in Walrus memories. |
| Persistent semantic memory | `@mysten-incubation/memwal` / Walrus Memory | `remember` only validated, evidence-linked deal facts. `recall` before answering later-session questions. Walrus Memory scopes recall by owner account and namespace, as described in the [quick start](https://docs.wal.app/walrus-memory/getting-started/quick-start). |
| LLM | Google Gemini Flash through the Vercel AI SDK, exact model pinned after a test | It avoids the Anthropic/OpenAI-only path and may qualify for the challenge’s alternative-model prize track. Use the current [Google Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing) when selecting the exact model. No claim of prize eligibility until the organiser confirms the implementation. |
| Hosting | Railway for the first hosted web app; Render is the fallback | Railway’s [published Hobby plan](https://railway.com/pricing) has a $5/month minimum that includes $5 of usage, with extra usage billed separately. Set alerts and hard usage limits where available. |
| Payments | Paystack, after pilot validation | Local NGN charging; keep billing outside the memory-recall path. |
| Analytics and errors | PostHog and Sentry, with content redaction | Track funnel events and failures, never raw deal text, evidence contents or chat prompts. |

### Walrus Memory tenant design and privacy risk

- A shop’s memory is scoped to its own Walrus Memory owner account and namespace. Do not use one shared account/namespace for all retailers. The official [Walrus Memory quick start](https://docs.wal.app/walrus-memory/getting-started/quick-start) explains account and namespace scope and warns that reusing another account identifier can mix memories.
- A Walrus Memory account is associated with a Sui owner and delegate keys. The implementation agent must choose and document who controls the owner account and how a per-shop delegate is stored before real retailer data is accepted; the user has delegated that technical decision to the builder. The app should not tell retailers they own an on-chain account unless they actually control it. The [agent-runtime integration guide](https://docs.wal.app/walrus-memory/guides/agent-runtimes) explains the owner/delegate requirement.
- Store only concise, validated deal facts and opaque internal record IDs in Walrus Memory. Keep photos, receipts and contact details in the private evidence store. Do not send raw documents to a model unless the user requests extraction and the data path is disclosed.
- Use direct `remember` and `recall` calls rather than automatically saving every line of chat. A write happens after a deal event is confirmed or a user-approved extraction. The UI shows asynchronous memory status.
- Every answer is grounded twice: retrieve a memory, then load the corresponding canonical deal event and evidence metadata from Supabase. The model cannot invent a supplier term or present an unsupported number as fact.
- **Deletion is a launch blocker to validate.** Walrus documents a wallet-authenticated Security Delete API [official guide](https://docs.wal.app/walrus-memory/guides/delete-memories-programmatically). The [MemWal SDK issue tracker](https://github.com/MystenLabs/MemWal/issues/1043) reports that the SDK does not expose an individual `forget` method and that the delete flow needs a lower-level signed API. Test whether the selected relayer and owner-key model support deletion of the actual blobs before promising permanent erasure. Under retailer-controlled custody, keep each request pending until the owner signature, successful Security Delete transaction and post-delete retrieval/index checks are verified. Clearing an index is not the same as deleting the stored blob.
- Supabase RLS is still required. Walrus isolation is an additional boundary, not a substitute for application authorisation. Apply privacy by design and review the Nigeria Data Protection Act and relevant [Nigeria Data Protection Commission guidance](https://ndpc.gov.ng/) before processing customer or staff personal data.

### Hosting and cost model

Use free or entry plans for a non-sensitive prototype. The [Supabase Free plan](https://supabase.com/pricing) is $0 but can pause inactive projects; Supabase Pro is published from $25/month and includes higher production limits. [Railway Hobby](https://railway.com/pricing) starts at $5/month and usage can exceed the included amount. Gemini, Walrus Memory, evidence storage, SMS and payments are variable or require plan verification. Do not promise a fixed total cost until the app has been measured.

| Stage | Known platform floor | Variable costs to measure |
|---|---|---|
| Prototype / 0–10 testers | Railway trial or Hobby; Supabase Free for disposable data | Gemini tokens, Walrus relayer/storage terms, evidence uploads. |
| 100 active shops | Supabase Pro likely; Railway based on measured traffic | Recall volume, memory writes, files, backups, SMS and payment fees. |
| 1,000 active shops | Supabase Pro or higher after usage review; Railway scaled by measured load | Per-shop memory accounts, LLM token use, evidence retention and observability. |
| 10,000 active shops | Recalculate architecture and plan limits before committing | Do not extrapolate prototype pricing linearly. Load-test, review storage and model spend, and set quotas. |

## 6. Data model and API

The canonical schema and API contracts are in `DATA_API_CONTRACTS.md`. The core entities are shops, memberships, suppliers, products, deals, deal lines, deal events, evidence files, Walrus memory-sync records, chat sessions and billing records. Each tenant-owned table includes `shop_id`; all queries are authenticated and constrained by membership. Do not create a public supplier-performance database.

The API is a server-side boundary around Supabase, MemWal and the LLM. The browser never receives a Walrus delegate private key, Supabase service-role key, LLM key or Paystack secret. Recall endpoints derive the shop scope from the authenticated user’s membership, not a client-supplied `shop_id`.

## 7. User flow and screens

1. **Landing:** explain one deal lifecycle and show the approved video background. No fabricated testimonials or metrics.
2. **Create account:** establish a user session, create a shop and explain memory storage in plain language.
3. **Add first supplier:** save only the details needed to distinguish the supplier in the retailer’s own records.
4. **Capture a deal:** enter the quote and agreed terms, attach evidence, review any extracted fields, then confirm.
5. **Update delivery:** record received quantity/status and link evidence.
6. **Resolve an issue:** create an issue event and save the outcome.
7. **Return later:** ask a natural-language question in a new session. Show answer, date, source deal and evidence links.
8. **Draft follow-up:** select the relevant facts, edit the draft, then copy it. Vendra does not send it.

**Empty states:** prompt the retailer to start with one recent deal, add a supplier, or attach a quote/receipt. Never display invented records as if they belong to the user.  
**Loading states:** skeletons for deal cards; a clear “saving memory” state while Walrus jobs are pending.  
**Errors:** preserve the user’s draft, show whether the relational record saved, whether Walrus recall/write failed, and provide retry. Do not report a memory as saved until the write job succeeds.

## 8. Launch and distribution

### First 100 users

1. Recruit the first three consenting retailers through the founder’s Delta network and in-person visits. Do not assume a city or market before confirming access.
2. Observe real purchase-deal workflows and offer assisted onboarding. Do not ask suppliers to adopt Vendra.
3. After the three-user test, invite additional shop owners through trusted retailer referrals and local business groups.
4. Use WhatsApp only for opt-in reminders or invitation links. Do not scrape contact lists or send unsolicited messages.
5. Use X, Product Hunt, Reddit and Indie Hackers for builder and AI-memory visibility, not as the only retailer acquisition channel. The sole X draft is in `MARKETING.md`.

### Growth loops and targets

- A shop owner invites an authorised staff member to share the same shop memory.
- A retailer can export or share a selected evidence-backed deal summary with a chosen recipient. No default public sharing.
- Pilot referral test: one referral invitation per activated shop, with a target viral coefficient of 0.2–0.5 as an experiment, not an existing result. Do not add rewards until referral quality is understood.
- Track first deal saved, first later-session recall, source-click rate, repeat use and paid intent. Avoid vanity metrics.

## 9. Launch checklist

- [ ] Walrus Memory account ownership, namespace isolation and per-shop delegate lifecycle tested.
- [ ] Three consented users each create at least ten genuine memories for the challenge demo.
- [ ] Cross-session recall demonstrated in a new browser/session for each user.
- [ ] Negative access test proves one shop cannot retrieve another shop’s memories or evidence.
- [ ] Deletion/retention path tested end to end, including the Walrus blob and the search index.
- [ ] Public repository contains setup instructions, environment template, exact model/runtime and Walrus version.
- [ ] Real hosted deployment used by testers for several days; preserve real logs and screenshots with consent.
- [ ] One honest 500–800 word build article drafted after testing, including what failed and what changed.
- [ ] Exactly one original X post, no thread, tags `@WalrusProtocol` and `#WalrusMemory`, with no unverified claims.
- [ ] Privacy policy, terms and NDPA review before onboarding non-test users.
- [ ] Video export uploaded and its exact filename, duration, dimensions, codec and size recorded.

## 10. Build sequence

A four-week, AI-assisted part-time baseline is recorded in `BUILD_PLAN.md`. It is a planning estimate, not a promise. Sequence is determined by product risk: first prove isolated Walrus memory and sourced recall, then implement the deal lifecycle, then test with retailers. Do not cut privacy, evidence provenance or cross-user isolation to save time.

## 11. Project destination and status

The intended local project path supplied by the user is `C:\Users\Paul\Documents\Coding Area\Agents\Vendra`. This environment cannot write directly to a local Windows drive. Planning files are staged in `/home/user/DreamDex` for download or copying to that destination. The approved video has not been attached to the shared workspace, so the frontend spec marks the binary, final metadata and deployable asset path as pending. The stills in `video/` are storyboard references, not the approved video file.

## Sources

- [NBS/SMEDAN 2021 MSME survey](https://www.nigerianstat.gov.ng/pdfuploads/MSMES.pdf); [SMEDAN 2022 competitiveness report](https://fatefoundation.org/wp-content/uploads/2024/03/7.-SMEDAN-1.pdf); [World Bank/IFC Nigeria MSME report](https://documents1.worldbank.org/curated/en/099055202202331735/pdf/IDU0ff38186304ab204c9209dd1037aeeb43b3d8.pdf); [GSMA Nigeria MSME e-commerce study](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma_resources/webinar-e-commerce-in-nigeria-unleashing-the-opportunity-for-msmes/).
- [Bumpa pricing](https://www.getbumpa.com/pricing); [Fisco](https://www.usefisco.com/); [Alerzoshop](https://alerzoshop.com/); [OmniRetail/OmniBiz overview](https://blog.omnibiz.com/omnibiz-announces-a-brand-refresh/); [Sabi overview](https://www.weforum.org/organizations/sabi/); [Bumpa App Store reviews](https://apps.apple.com/us/app/bumpa-manage-orders-easily/id1497638594?see-all=reviews&platform=iphone).
- [Walrus Memory overview](https://docs.wal.app/walrus-memory/getting-started/what-is-walrus-memory); [quick start](https://docs.wal.app/walrus-memory/getting-started/quick-start); [agent runtimes](https://docs.wal.app/walrus-memory/guides/agent-runtimes); [deletion guide](https://docs.wal.app/walrus-memory/guides/delete-memories-programmatically); [MemWal SDK issue #1043](https://github.com/MystenLabs/MemWal/issues/1043).
- [Supabase pricing](https://supabase.com/pricing); [Railway pricing](https://railway.com/pricing); [Paystack pricing](https://paystack.com/pricing); [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing); [Nigeria Data Protection Commission](https://ndpc.gov.ng/).