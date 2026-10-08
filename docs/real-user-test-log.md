# Real User Test Log

**This log is empty because no real retailer has used Vendra yet.**

That is the accurate state, and it is recorded here rather than left implied. No
participant, memory count, testimonial, savings figure or usage date has been
invented anywhere in this repository.

The Walrus Session 8 challenge requires at least three distinct consenting users,
each with at least ten genuine memories, used over several days from a deployed
application. None of that has happened.

---

## Why this is blank

A live deployment needs a Supabase project, a Gemini key and Walrus credentials.
Each requires manual account creation that has not been completed. See
[`README.md`](../README.md) → *Required manual setup*.

---

## How to fill this in

One row per participant. Use pseudonymous IDs. Never record names, phone
numbers, supplier names, exact prices or any commercial detail in a document
intended for publication.

| Field | Record |
|---|---|
| Participant ID and consent | Pseudonymous ID + date written consent obtained |
| Shop scope | Confirm each participant uses a **distinct** shop id and Walrus namespace |
| Onboarding date and time | Actual, not intended |
| Account setup result | Custody disclosure shown and acknowledged |
| Genuine memory count | From `listNamespaces().memory_count` for that shop's namespace, **not** a local counter |
| Example memory write | Event type + job status. Redacted |
| Fresh-session recall | Exact prompt, returned source event ids, answer, and any retailer correction |
| Before/after evidence | The answer *before* memory was available and the sourced answer after |
| Failure or limitation | Record truthfully, including slow sync, wrong recall or onboarding friction |
| Deployment use dates | Actual dates across several days |
| User feedback | Verbatim only with separate written permission |
| Deletion check | Test id, blob reference, signing path, independent retrieval result |

---

## Test prompts worth running once live

1. **The headline test.** Fresh session, new browser profile: "What did I agree to
   pay last time?" Record the answer and whether the sources resolve.
2. **Cross-session.** Close the browser, return the next day, ask about a
   supplier recorded a week earlier. This is the behaviour the product exists for.
3. **Negative control.** Ask about a supplier that was never recorded. The
   answer must say no saved record was found. Anything else is a critical bug.
4. **Cross-shop.** As participant B, ask about participant A's supplier. Nothing
   from A may appear.
5. **Correction.** Correct a recorded quantity, then re-ask. The newest confirmed
   fact must win.

---

## Consent wording to use

Written consent is required separately for (a) using the app and (b) publishing
any screenshot, quote or detail. Declining publication must not remove access to
the test.

The participant notice must state, before they start:

- What Vendra stores in Supabase and in Walrus Memory.
- That **Vendra's service controls the Walrus Memory owner account** for the
  pilot, and that the retailer does not hold the key.
- Which model provider may receive selected text, and for what purpose.
- Who in the shop can see their records.
- How to correct, export, share or request deletion.
- That permanent erasure of memories is **not yet verified**, and that deletion
  requests report that layer as blocked.

---

## Deletion verification record

To be completed before any sensitive data is accepted.

| Step | Result |
|---|---|
| Disposable shop and identifiable synthetic blob created | _pending_ |
| Owner account, namespace, blob ids and delegate state recorded | _pending_ |
| Security Delete requested through the documented flow | _pending_ |
| Transaction accepted | _pending_ |
| Blob unreachable via the supported read path | _pending_ |
| Semantic index no longer returns the memory | _pending_ |
| App evidence, caches and derived text removed | _pending_ |
| Provider retention limits recorded | _pending_ |

Until every row above is filled in, no document in this repository may claim that
memories are permanently erased.