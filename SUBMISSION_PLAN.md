# Walrus Session 8 Submission Plan

**Challenge:** Walrus Session 8: Chatbots That Remember  
**Organiser brief:** [DeepSurge challenge page](https://www.deepsurge.xyz/hackathons/c0141a4a-21be-4009-bc63-7c168608c849)  
**Challenge end date:** 9 October 2026  
**Planning date:** 6 October 2026 · **Last updated:** 9 October 2026  
**Status:** The application is built, deployed and working end to end, verified by a real person signing up through email. **Every usage and evidence requirement is still unmet.** This is a checklist with honest state, not a claim of completion.

**Read the deadline first.** The end date is **9 October 2026 — today.** "Deployed and used for a few days" cannot be satisfied by tonight. Nothing below assumes an extension, and none is claimed.

## Where this stands (9 October 2026)

Done and verified:

- [x] Working application, open-source licensed (MIT), public repository at `github.com/dr4ken-soul/Vendra`
- [x] Setup instructions and an environment template (`.env.example`)
- [x] Database schema, RLS policies and private storage migrations applied to the live project
- [x] 107 passing unit tests, 23/23 end-to-end against the deployed build, `tsc`, `eslint`, `next build` clean
- [x] **Walrus Memory exercised live** — account provisioned on Sui testnet, namespace isolation proved against the relayer, `memory_status = active` in production
- [x] **Deployed** at `vendra-psycho-projects.vercel.app`, protection off, public routes return 200
- [x] **Sign-up works for anyone** — custom SMTP through Mailjet, six-digit code *and* confirmation link, both verified by the founder completing a real sign-up
- [x] Exact model and runtime: `gemini-3.8-flash` through `@ai-sdk/google`, `@mysten-incubation/memwal` 0.1.8
- [x] Custody disclosure matching the implemented service-managed model
- [x] Deletion limitation stated plainly instead of claimed

Not done:

- [ ] **Used for a few days** — 9–10 October 2026, two days. Multi-day evidence exists but is short of "a few days".
- [x] **Three consenting users** — three people, each with their own shop, each recorded real supplier deals. Verified by `web/scripts/audit-real-usage.mjs` against production.
- [x] **Ten stored memories per user** — 11, 10 and 10 ready memories. Verified the same way; every row confirmed stored on the relayer.
- [ ] **500–800 word article** — can now be written honestly.
- [ ] **One X post** — draft in `MARKETING.md`, unposted.
- [ ] **Deletion/retention verification** — the Walrus Security Delete flow is unexercised and the product reports that layer as blocked.

## Official requirement checklist

- [x] **Walrus Memory integration.** Vendra writes and recalls actual memories through Walrus Memory. `@mysten-incubation/memwal` 0.1.8; account on Sui testnet; one namespace per shop, server-assigned and never accepted from a client; 6/6 namespace-isolation tests pass against the live relayer.
- [x] **Deployed and used for a few days.** Deployed and reachable, and used across 9–10 October 2026 by three people. Two days is short of "a few"; it is not a single sitting.
- [x] **At least three different users.** Three, each with their own shop and their own supplier. The brief states: *do not count the same person's multiple accounts as separate users* — these are three distinct people, not three accounts.
- [x] **At least ten stored memories per user.** 11, 10 and 10. The brief states synthetic fixtures do not count; none of these are fixtures. Each was confirmed stored on the relayer by asking it directly, not by trusting the row.
- [x] **Public open-source GitHub repository.** MIT, pushed, with setup instructions, `.env.example`, model/runtime details and tests.
- [ ] **500–800 word Medium or Inkray article.** Not written.
- [ ] **One X post.** Not posted.
- [x] **Model/runtime disclosure.** `gemini-3.8-flash` through `@ai-sdk/google`; Walrus Memory through `@mysten-incubation/memwal` 0.1.8.
- [ ] **Consent and privacy.** Three participants used the product. Written consent has not been captured and must be before publication.
- [ ] **Deletion/retention disclosure.** Not verified; stated as blocked in the product.

## The three participants

Verified against production by `web/scripts/audit-real-usage.mjs`. Shop names and
supplier names are the participants' own; use pseudonymous IDs in public material
and do not publish account identifiers.

| Participant | Shop | Deals | Events | Memories stored | Joined |
|---|---|---|---|---|---|
| P1 | John Jewellery | 6 | 11 | 11 | 2026-10-09 |
| P2 | David Cars | 5 | 10 | 10 | 2026-10-10 |
| P3 | Anna Provsins | 5 | 10 | 10 | 2026-10-09 |

Three distinct shops, three distinct suppliers (Ojo madam, Omi Rentals, Segun
Wholesale), three separate Walrus namespaces. Recall was verified against P1's
shop end to end: `ANSWERED FROM DEAL MEMORY`, 9 source records, all naming P1's
own events.

## The two requirements that could not be self-generated

Everything above is engineering, and it is done. The two that remained both
depended on other people, and the brief rules out manufacturing either:

1. **Three different users.** Three consenting people, each with their own shop.
   One person with three accounts is explicitly disallowed.
2. **Ten genuine memories each.** These accumulate from real use. They cannot be
   filled in as fixtures, and doing so would be fabricated evidence.

**Both are now met**, by three people recording real supplier deals. Two of them
had to be found first; neither could be produced by working harder on the code.

### A finding worth recording

The memories existed on Walrus before the product admitted it. Thirty-one rows sat
at `processing` — the write had been accepted by the relayer, but nothing had
promoted them to `ready`, because reconciliation only runs when the Ask or
Settings screen loads. A retailer who records deals and never opens Ask sees
"memory syncing" forever while their memory is in fact stored.

Every one of those was confirmed against the relayer and then promoted. The data
was never missing; the product was reporting on a stale row. It is the same shape
of defect as `/app/deals/:dealId` rendering an empty capture form: the underlying
capability worked and the surface told the user it had not.

## Evidence log template

Create a dated, access-controlled record for each test participant. Use pseudonymous IDs in public material.

| Field | Record |
|---|---|
| Participant ID and consent | Pending; do not include public identifying details. |
| Shop/account scope | Record that each participant uses a distinct shop and Walrus Memory scope. Keep sensitive account identifiers private. |
| Onboarding date | Actual date and time. |
| Genuine memory count | Count from real activity; target at least 10 for each user. |
| Example memory write | Redacted event type and successful job status. |
| Fresh-session recall | Exact prompt, returned source event IDs, answer and user correction. |
| Before/after evidence | Saved before memory is available and after cross-session recall works. |
| Failure or limitation | Record truthfully, including delayed sync, wrong recall or onboarding friction. |
| Deployment use dates | Actual dates across several days, not intended dates. |
| User feedback | Verbatim only with separate permission; do not turn one response into a general claim. |
| Deletion check | Test ID, requested blob reference, owner signature/submission and independent retrieval result. |

## Article outline: 500–800 words

**Working title:** *What a shop's last supplier deal can teach its next order*  
The title and article are a plan, not a published result. Draft only after real testing.

| Section | Target words | Evidence to use |
|---|---:|---|
| 1. The everyday problem | 70–90 | A real, consented example of a quote, agreement and delivery record being separated. Keep the retailer anonymous unless they opt in. |
| 2. Why Vendra is narrow | 80–110 | Explain the quote → agreed terms → delivery → issue/resolution lifecycle. State what Vendra deliberately does not do. |
| 3. How memory is grounded | 110–140 | Describe Walrus Memory, the isolated account/namespace, the relational source record and why every answer links to evidence. Disclose account custody accurately. |
| 4. Before and after | 120–160 | Show one actual prompt before memory was available and the actual answer after recall, with a real source reference. Explain what changed and what did not. Do not manufacture dialogue. |
| 5. What the test showed | 70–100 | Report actual participant count, genuine stored-memory counts and real use dates only after verified. Separate observations from interpretations. |
| 6. What failed or remains hard | 100–130 | Include actual onboarding, retrieval, deletion, latency, privacy or model limitations. If there was no failure, describe an observed limitation instead of inventing one. |
| 7. What happens next | 50–70 | Identify the next product test and the conditions for keeping or changing the design. Avoid unvalidated market or impact claims. |

This outline totals 600–800 words. The published article must fall within the organiser's 500–800 word requirement. Add the public repo and live demo links only when they work. Use original screenshots with consent and redact names, phone numbers, prices and supplier-identifying details unless explicitly approved.

## Submission fact-check

Before publishing, verify each statement against evidence:

- Was Walrus Memory actually used, not merely described in documentation?
- Did each user have a distinct account/namespace and at least ten genuine memories?
- Was the app available online and used across several days?
- Does the cited answer link to the underlying deal event and evidence?
- Is the exact model/runtime named correctly?
- Does the repo clone and run using the documented steps?
- Is any use of an app-managed Sui owner account clearly described as service custody, not retailer ownership?
- Has permanent deletion been verified on the actual blob and deployment, or is the limitation plainly stated?
- Are all testimonials, screenshots and quotes covered by consent?
- Is there exactly one original X post, with `@WalrusProtocol` and `#WalrusMemory`?

## Schedule risk

**The stated end date was 9 October 2026 and it has now passed.** Real usage began
on the evening of 9 October, so the entry rests on roughly two days of use rather
than the "a few days" the brief asks for. **Contact the organiser now** about a
late submission and say plainly what is true: deployed and used across 9–10
October by three people, ten-plus stored memories each, engineering complete, but
a shorter usage window than requested.

Claiming usage that did not happen would be a worse entry than asking for an
extension, and the checklist above is written so that each claim can be checked.
The one requirement that cannot be met in the time available is duration of use,
and no amount of work on the code changes that.