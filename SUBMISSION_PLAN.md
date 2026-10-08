# Walrus Session 8 Submission Plan

**Challenge:** Walrus Session 8: Chatbots That Remember  
**Organiser brief:** [DeepSurge challenge page](https://www.deepsurge.xyz/hackathons/c0141a4a-21be-4009-bc63-7c168608c849)  
**Challenge end date:** 9 October 2026  
**Planning date:** 6 October 2026  
**Status:** The application is built and tested. **None of the challenge's usage and evidence requirements are met yet.** This is a checklist with honest state, not a claim of completion.

## Where this stands (8 October 2026)

Done:

- [x] Working application, open-source licensed (MIT), public-repository-ready source
- [x] Setup instructions and an environment template (`.env.example`)
- [x] Database schema, RLS policies and private storage migrations written
- [x] 76 passing unit tests; `tsc`, `eslint`, `next build` all clean
- [x] Tenant-isolation and Walrus-isolation test suites written
- [x] Exact model and runtime documented (`gemini-2.5-flash`, `@mysten-incubation/memwal` 0.1.8)
- [x] Custody disclosure matching the implemented service-managed model
- [x] Deletion limitation stated plainly instead of claimed

Blocked or not started:

- [ ] **Walrus Memory integration exercised live** — blocked on credentials
- [ ] **Deployed and used for a few days** — blocked on Supabase project, Gemini key and a Vercel account
- [ ] **Three consenting users** — no users exist
- [ ] **Ten stored memories per user** — zero real memories written
- [ ] **Public GitHub repository** — push pending; source is complete
- [ ] **500–800 word article** — cannot be written honestly until there is real evidence
- [ ] **One X post** — the draft in `MARKETING.md` is unchanged and unposted
- [ ] **Deletion/retention verification** — Security Delete flow not exercised; reported as blocked in the product

## Official requirement checklist

- [ ] **Walrus Memory integration:** Vendra writes and recalls actual memories through Walrus Memory. Record package/version, owner-account setup, namespace and relevant request/job IDs.
- [ ] **Deployed and used for a few days:** publish the app to a reachable deployment and record actual use dates. A local demo or screenshot alone is not enough.
- [ ] **At least three different users:** recruit three consenting users who use distinct shop scopes. Do not count the same person’s multiple accounts as separate users.
- [ ] **At least ten stored memories per user:** each memory must be genuine and useful to that user. Retain evidence of the count and the account/namespace mapping. Synthetic fixtures do not count.
- [ ] **Public open-source GitHub repository:** publish source under an approved open-source licence and include tested setup instructions, environment template, model/runtime details and tests.
- [ ] **500–800 word Medium or Inkray article:** write after the test. Include real before/after behaviour, real usage evidence and honest limits.
- [ ] **One X post:** publish exactly one original post, tag `@WalrusProtocol` and include `#WalrusMemory`. The draft is in `MARKETING.md`. No thread or alternative drafts.
- [ ] **Model/runtime disclosure:** name the exact model and version plus runtime/integration used. Gemini is a candidate only; do not write “Gemini” as an implemented fact until the model is actually integrated.
- [ ] **Consent and privacy:** obtain participant consent for tests and public screenshots/quotes. Redact personal, supplier and commercial information.
- [ ] **Deletion/retention disclosure:** verify the wallet-signed Walrus Security Delete flow and state limitations honestly. Do not promise deletion until verified.

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

**Working title:** *What a shop’s last supplier deal can teach its next order*  
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

This outline totals 600–800 words. The published article must fall within the organiser’s 500–800 word requirement. Add the public repo and live demo links only when they work. Use original screenshots with consent and redact names, phone numbers, prices and supplier-identifying details unless explicitly approved.

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

As of 6 October 2026, three calendar days remain before the stated challenge end date. The required deployment and “few days” use make the timeline particularly tight. If the app is not already built and used, do not claim compliance or fabricate evidence. Confirm with the organiser whether a late submission or extension is possible; this plan does not assume one.