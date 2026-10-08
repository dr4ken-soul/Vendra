# Walrus Memory: Custody Decision and Verification Status

**Status: implemented, not yet verified against live credentials.**

This document completes the decision record required by
`WALRUS_ACCOUNT_CUSTODY.md`.

---

## 1. Chosen model

**Service-managed, one owner account and one namespace per shop.**

| Item | Value |
|---|---|
| Model | Service-managed (option B in `WALRUS_ACCOUNT_CUSTODY.md`) |
| Account | The operator's Walrus Memory account object id |
| Isolation boundary | A unique server-assigned namespace per shop |
| Delegate | One Ed25519 delegate key in the server environment |
| Owner signing | `service_custodian` — the server signs |
| Retailer holds the owner key? | **No** |
| Database stores | Opaque account id, namespace, owner address, key *reference* |

This is custodial and is described as custodial in onboarding, in settings and
in `/privacy`. The word "retailer-owned" is not used anywhere.

---

## 2. Why not retailer-controlled

Option A (retailer-controlled Sui owner account) remains the stated production
goal. It was not selected for the pilot because:

- It requires wallet onboarding, signing and recovery education from grocery
  retailers, which is a significant usability risk for the target user.
- Wallet recovery is a security design problem that has no confirmed path in the
  reviewed Walrus documentation. Shipping it would mean guessing.

Option C (embedded account with retailer-held recovery) has no confirmed
onboarding or recovery path and was not built from guesswork.

Option B is permitted by `WALRUS_ACCOUNT_CUSTODY.md` for a controlled pilot
provided isolation, key controls, revocation and deletion are addressed, the
custody is disclosed, and only low-sensitivity data is accepted until deletion is
verified. This document states exactly which of those are **verified** and which
are **not**.

---

## 3. Verification matrix — the honest state

| Check | Required by spec | Status | Notes |
|---|---|---|---|
| Two isolated shop scopes exist | Yes | **Unverified** | Needs credentials; `tests/walrus-memory/` skips loudly |
| Shop A cannot read Shop B's memories | Yes | **Unverified** | Test written, skips without credentials |
| Shop A cannot read Shop B's evidence | Yes | **Verified by design** | Enforced in Postgres RLS + storage policy |
| Server derives scope from session | Yes | **Verified** | `resolveShop`; covered by `tests/tenant-isolation/` |
| No single global namespace | Yes | **Verified** | Unique index `shops_walrus_namespace_key`; namespace derived server-side with 8 random bytes |
| Client cannot supply namespace | Yes | **Verified** | No client input reaches the namespace field at all |
| Delegate key not in DB / browser / logs | Yes | **Verified** | Only a reference is stored; `tests/unit` covers the shape |
| **Permanent blob erasure** | **Yes** | **NOT VERIFIED** | SDK has no delete method; Security Delete flow not exercised |
| Delegate revocation runbook | Yes | **Documented, untested** | See §6 |
| Real-user evidence (3 users × 10 memories) | Challenge | **Not gathered** | No users yet |

**Two release gates remain closed.** Both are recorded as blockers in
`SUBMISSION_PLAN.md` rather than worked around.

---

## 4. SDK contract, verified against the installed package

`@mysten-incubation/memwal@0.1.8`, read from the installed `dist/*.d.ts` rather
than assumed:

```ts
MemWal.create({ key, accountId, serverUrl?, namespace? })

remember(text, namespace?, { idempotencyKey? })
  → { job_id, status }

getRememberStatus(jobId)
  → { status: pending | running | uploaded | done | failed | not_found,
      blob_id?, error? }

recall({ query, limit?, namespace?, maxDistance?, maxTokens?, sort? })
  → { results: [{ blob_id, text, distance, created_at? }], total, meta? }

listNamespaces({ cursor?, limit? })
  → { namespaces: [{ name, memory_count, storage_used, updated_at }], ... }
```

Notable, and used deliberately:

- **`listNamespaces().memory_count`** is the only honest, provider-reported
  measure of stored memories. It is what the settings screen shows. A local
  counter would be a fabricated number, so none is used.
- **There is no `forget` / delete method.** This confirms the gap recorded in
  `TECH_DECISIONS.md` against issue #1043.
- `maxTokens` is passed to `recall` so a large recall cannot blow the model
  context.
- `sort: 'recent'` makes newest-wins deterministic, which matters when a
  correction supersedes an earlier fact.

---

## 5. What is written

One short, atomic statement per confirmed event:

```
On 2026-03-04, deal <deal-uuid> with Okonkwo Wholesale recorded agreed terms:
Agreed 18 cartons at 18,000 naira per carton. Source event: <event-uuid>.
```

Included: date, event type, shop-local supplier label, opaque `deal_id` and
`event_id`.

**Never included:** phone numbers, file names, signed URLs, bank details,
conversation transcripts, or any unconfirmed model output.

`composeMemoryText` is covered by unit tests, including that whitespace is
collapsed and length is bounded, so a memory statement stays short and
traceable.

---

## 6. Key handling

| Rule | Implementation |
|---|---|
| Never in the database | Only `shops.walrus_delegate_key_ref`, a pointer |
| Never in the browser | The adapter is server-only; `serverExternalPackages` enforces it |
| Never in logs | Errors log a short code, never the key or memory text |
| Never in source control | `.gitignore` excludes `.env*` and stray `*.key` / `*.pem` |
| Rotation | Change the key in the key store, update the reference, re-run `POST /api/shops/:id/memory` |
| Revocation | Remove the delegate from the Walrus account; the app then fails closed and reports memory as unavailable rather than silently succeeding |

---

## 7. Honest degradation

Every failure mode degrades to something true rather than something convenient.

| Failure | What the user sees |
|---|---|
| Walrus not configured | Deal saves. Memory row recorded as pending. Ask Vendra: "Deal memory is not connected in this environment." |
| Write fails | Deal saved. Memory shows "Memory needs attention". Retry available. A failed write never rolls back the deal. |
| Recall fails | "Deal memory is temporarily unavailable. Your saved deals are still in the Deals list." Plus a direct search of real records. |
| No model key | Deterministic summary of real records, labelled as not a model answer. |
| Recall returns untraceable memories | All discarded. Answer: "I couldn't find a saved record for that." |

The deal record is never lost to a memory failure. That is the single most
important failure-mode decision in the integration.

---

## 8. What must happen before a real pilot

1. Supply Walrus credentials and run `tests/walrus-memory/`. Do not proceed until
   namespace isolation passes.
2. Obtain the delegate public key registration and confirm revocation works.
3. Exercise the wallet-authenticated Security Delete flow against a disposable
   blob and verify the blob is unreachable through the supported read path.
4. Only then accept real retailer data.
5. If (3) cannot be completed, keep the pilot to deliberately low-sensitivity
   records and keep saying so in the UI — which the current copy already does.