# Vendra Data Flow

This describes the system **as built**, not as planned. Where the two differ,
this document is right.

---

## 1. Where the truth lives

| Store | Holds | Authority |
|---|---|---|
| **Supabase Postgres** | shops, memberships, suppliers, deals, deal lines, deal events, evidence metadata, memory sync records, audit events, data requests | Canonical. Every user-facing fact resolves here. |
| **Supabase Storage** (private `evidence` bucket) | Receipts, message screenshots, delivery photos | Evidence. Only reachable through a short-lived signed URL. |
| **Walrus Memory** | Short, source-linked statements about confirmed deal events | Recall index only. Never the source of truth. |
| **Browser** | Nothing that matters | No deal data is persisted in `localStorage`. |

There is no client-side store of record. Closing the browser loses nothing.

---

## 2. Sign-in and scope derivation

1. The browser posts credentials to a server action (`src/lib/auth-actions.ts`).
2. Supabase Auth issues a session; `@supabase/ssr` writes it to cookies.
3. Every protected request calls `resolveShop(userId, requestedShopId)`
   (`src/lib/tenancy.ts`).

**The critical detail.** `requestedShopId` — from a route segment or query
string — is used only to *select among shops the user is already a member of*:

```ts
const membership = requestedShopId
  ? memberships.find((m) => m.shop_id === requestedShopId)
  : memberships[0];

if (!membership) return null;   // foreign id -> null, not that shop
```

A client that guesses another shop's UUID gets `null`, not access.

4. Every subsequent query uses the session-scoped Supabase client, so Row
   Level Security evaluates the caller's identity independently.

---

## 3. Capturing a deal

```
POST /api/deals
  → Zod validation
  → resolveShop()                    tenant scope
  → check deal.create                permission
  → verify supplier is in this shop
  → INSERT deals + deal_lines        RLS + composite FKs
  → appendDealEvent(quote_received)  ──┐
  → appendDealEvent(terms_agreed)   ──┤ only if terms were confirmed
                                      │
              ┌───────────────────────┘
              ▼
      writeMemoryForEvent()
        INSERT walrus_memory_sync (queued)   ← written BEFORE the network call,
        │                                      so a crash cannot lose the debt
        ▼
      remember() → Walrus
        status: queued | processing | failed | skipped
```

**Save-as-draft writes no event at all**, therefore no memory. Nothing is
remembered until the retailer confirms a factual event.

---

## 4. Recording delivery, issues and resolutions

`appendDealEvent()` (`src/lib/deals/events.ts`) is the single write path.

- Verifies the deal belongs to the shop.
- A `correction` must reference an event in the same shop, and the original is
  marked `superseded_at` rather than deleted.
- `deal_events` has a trigger that **blocks UPDATE and DELETE at the database
  level**, including for the service role. The audit trail cannot be rewritten.
- A database constraint rejects a status change to `agreed`, `delivered`,
  `part_delivered`, `issue_open` or `resolved` unless a matching current event
  exists. A client cannot assert a status the records do not support.
- Delivery status is **derived** from the recorded quantities, not asserted by
  the client: short on any line ⇒ `part_delivered`, complete ⇒ `delivered`.

---

## 5. Evidence files

```
POST /api/evidence/uploads
  → server builds the path:  <shop_id>/<deal_id>/<uuid>.<ext>
    (extension derived from the VALIDATED content type, never the filename)
  → short-lived signed upload URL

browser PUTs the file directly to storage

POST /api/evidence/complete
  → re-validates the object key belongs to this shop AND deal
  → storage.info() confirms the object exists and its real size
  → INSERT evidence_files
```

Reading a file requires three independent checks: active membership, the
`evidence.view` permission, and an evidence row inside that same shop. The raw
object key is never returned to the browser.

---

## 6. Recall

```
POST /api/assistant/recall { question }
  → resolveShop()                        tenant scope
  → reconcilePendingWrites(shopId)       promote finished jobs
  → resolveRecalledSources():
       recall(namespace = THIS SHOP ONLY)
       parse opaque source ids from each memory
       ── DISCARD anything that ──
          · has no parseable source event
          · has no matching event row
          · belongs to a different shop
          · has been superseded by a correction
       → resolve survivors to canonical events + lines + evidence
  → if nothing survived:
       fall back to a direct search of this shop's events,
       and label the result 'record_search' or 'unavailable'
  → answerFromSources()
  → persist the turn for continuity only
```

The model receives **only records that already resolved inside the authorised
shop**. Its prompt forbids inferring a number that is not written down, and a
missing value is rendered as the literal string `not recorded` so it cannot be
guessed.

Durable memory is always a `deal_events` row plus a `walrus_memory_sync` row.
The chat transcript is never treated as memory.

---

## 7. What can be deleted, and what is claimed

| Layer | Action | Reported status |
|---|---|---|
| Deals, events, lines, suppliers, messages, audit | Deleted | `complete` |
| Evidence objects | Removed, then re-listed to verify | `complete` or `verifying` |
| Extracted text | Deleted with its record | `complete` |
| **Walrus memory blobs** | Scope switched off; delegate revocation documented as a runbook step | **`blocked`** |

The Walrus layer is reported as blocked **because that is the truth**. The
MemWal SDK 0.1.8 exposes no `forget` or delete method, and the wallet-signed
Security Delete flow has not been exercised in this deployment. Vendra does not
claim erasure it has not checked.

---

## 8. What never leaves the server

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `WALRUS_DELEGATE_PRIVATE_KEY`

`next.config.ts` lists the Sui and MemWal packages as `serverExternalPackages`
so their Node-only code cannot enter a client bundle. The browser bundle
contains only the anon key.

No raw chat text, deal summary, file content or memory statement is logged.
Errors log codes and identifiers, never content.