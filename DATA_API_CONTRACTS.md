# Vendra Data and API Contracts

**Status:** Planning contract only. These are not executable migrations or routes. No code has been written.  
**Rule:** every user-facing fact returned by Vendra must resolve to a canonical deal event or a cited evidence record.

## 1. Tenancy and identity

- `user_id` is the authenticated Supabase Auth user.
- `shop_id` is the tenant boundary. A shop is a retailer’s private workspace.
- A user may belong to one or more shops through `shop_memberships`.
- The server derives accessible `shop_id` values from the authenticated session. The client cannot widen scope by supplying a different shop identifier.
- Supabase Row Level Security applies to every tenant-owned row and private storage object.
- Each shop maps to its own Walrus Memory owner account and namespace. Do not use a shared global account/namespace for all shops. Walrus access keys are server-side and per-tenant; never expose them to the browser.

## 2. Relational schema

The schema is conceptual. Exact SQL types, constraints and migration order are deferred until the user approves implementation.

### `profiles`

| Field | Meaning |
|---|---|
| `id` | Primary key, same UUID as Supabase Auth user. |
| `display_name` | Optional user display name. |
| `preferred_locale` | Defaults to `en-NG` after confirmation. |
| `created_at`, `updated_at` | Audit timestamps. |

### `shops`

| Field | Meaning |
|---|---|
| `id` | Tenant primary key. |
| `owner_user_id` | Initial owner. |
| `name` | Retailer’s chosen shop name. |
| `country_code` | Defaults to `NG` for the first market. |
| `currency_code` | Defaults to `NGN`; keep explicit on each deal as well. |
| `timezone` | Defaults to `Africa/Lagos`. |
| `walrus_account_id` | Walrus Memory account object identifier. Never a secret. |
| `walrus_namespace` | Tenant namespace. Must be unique per shop. |
| `walrus_owner_address` | Sui owner address, if applicable to the selected custody model. |
| `memory_status` | `pending`, `active`, `degraded` or `revoked`. |
| `created_at`, `updated_at`, `deleted_at` | Lifecycle fields. |

### `shop_memberships`

| Field | Meaning |
|---|---|
| `shop_id`, `user_id` | Composite unique membership. |
| `role` | `owner`, `manager` or `staff`. |
| `permissions` | Explicit allowed actions, not a client-controlled JSON policy. |
| `invited_by`, `joined_at`, `revoked_at` | Invitation and audit history. |

### `suppliers`

| Field | Meaning |
|---|---|
| `id`, `shop_id` | Tenant-scoped identity. |
| `display_name` | Name as the retailer recognises it. |
| `phone`, `notes` | Optional, minimise personal data. |
| `created_by`, `created_at`, `updated_at`, `archived_at` | Audit fields. |

### `products`

| Field | Meaning |
|---|---|
| `id`, `shop_id` | Tenant-scoped identity. |
| `label` | Retailer’s product name. No global catalogue in V1. |
| `category`, `unit_label` | Optional local labels. |
| `created_at`, `archived_at` | Lifecycle fields. |

### `deals`

| Field | Meaning |
|---|---|
| `id`, `shop_id`, `supplier_id` | Tenant and supplier relation. |
| `status` | `draft`, `quoted`, `agreed`, `part_delivered`, `delivered`, `issue_open`, `resolved` or `cancelled`. |
| `deal_date` | Local deal date, stored with timezone context. |
| `expected_delivery_at` | Optional expected delivery date/time from confirmed terms, stored with timezone context. |
| `external_reference` | Optional retailer reference. |
| `currency_code` | Required, initially NGN. |
| `headline` | Short user-confirmed description. |
| `created_by`, `created_at`, `updated_at`, `archived_at` | Audit fields. |

### `deal_lines`

| Field | Meaning |
|---|---|
| `id`, `deal_id`, `shop_id` | Tenant-scoped item line. |
| `product_id` | Optional relation to the shop’s product list. |
| `product_label_snapshot` | Preserve the exact wording used in this deal. |
| `quoted_quantity`, `agreed_quantity`, `received_quantity` | Decimal quantities. |
| `unit_label` | Carton, crate, piece or retailer-defined unit. |
| `quoted_unit_price`, `agreed_unit_price` | Decimal monetary amounts. |
| `currency_code` | Required to avoid silent conversion. |

### `deal_events`

| Field | Meaning |
|---|---|
| `id`, `shop_id`, `deal_id` | Tenant-scoped event. |
| `event_type` | `quote_received`, `terms_agreed`, `delivery_checked`, `issue_opened`, `resolution_recorded`, `correction` or `note_added`. |
| `occurred_at` | When the event happened, if known. |
| `recorded_at` | When Vendra received it. |
| `summary` | User-confirmed plain-language fact. |
| `structured_payload` | Typed fields for quantities, price or outcome. Avoid unbounded untrusted JSON. |
| `created_by`, `supersedes_event_id` | Provenance and correction chain. |

### `evidence_files`

| Field | Meaning |
|---|---|
| `id`, `shop_id`, `deal_id`, `event_id` | Tenant and source links. |
| `storage_object_key` | Private Supabase Storage key, not a public URL. |
| `content_type`, `byte_size`, `sha256` | Validation and integrity metadata. |
| `original_filename`, `uploaded_by`, `uploaded_at` | Minimal file metadata. |
| `extraction_status`, `extracted_text_redacted` | OCR/LLM processing state and reviewed text only. |
| `deleted_at` | Application deletion state, pending verified Walrus deletion behaviour. |

### `walrus_memory_sync`

| Field | Meaning |
|---|---|
| `id`, `shop_id`, `deal_id`, `event_id` | Links a memory write to its canonical source. |
| `memory_blob_id` | Opaque Walrus blob reference, if returned. |
| `namespace` | Copy of the shop-scoped namespace used for the operation. |
| `job_id` | Asynchronous MemWal job identifier. |
| `status` | `queued`, `processing`, `ready`, `failed`, `superseded` or `deletion_pending`. |
| `memory_version` | Version for corrections and supersession. |
| `created_at`, `updated_at` | Sync audit fields. |

Do not put private keys, signed URLs, raw receipt images or unrestricted chat transcripts in this table.

### `assistant_sessions` and `assistant_messages`

Store only what is required to continue an explicitly saved conversation. Keep chat retention limited and configurable. A message that becomes durable memory must be represented by a reviewed `deal_event` and a separate `walrus_memory_sync` row. Do not treat the raw chat log as the source of truth.

### `subscriptions` and `audit_events`

Add `subscriptions` only when paid billing is approved. Store provider references and status, never card details. `audit_events` records membership changes, exports, sharing and deletion requests without copying sensitive deal content into the audit log.

## 3. Key indexes and invariants

- Index each tenant-owned table by `(shop_id, created_at)` or `(shop_id, occurred_at)` for common history views.
- Index `deals(shop_id, supplier_id, deal_date)` and `deal_events(shop_id, deal_id, occurred_at)`.
- Unique index `shop_memberships(shop_id, user_id)`.
- Unique namespace/account mapping per shop, subject to the chosen Walrus account model.
- Use database constraints for valid event/status values, positive quantities and currency codes.
- A correction appends a new event and marks the old event as superseded. It does not silently rewrite the audit trail.
- Every memory sync row must refer to a canonical event. A memory without a source event is not eligible to support an answer.

## 4. Row-level security and storage policy

- Users can read a shop row only when they have an active membership.
- Users can read or create suppliers, deals, lines, events and evidence only within a shop where their role permits that action.
- Staff can record events if granted that permission; only owner/manager can invite or revoke members and change shop settings.
- Storage buckets are private. Object paths begin with a server-verified `shop_id`; storage policies check membership, not only path text.
- Signed file URLs are short-lived and issued only after checking session, shop membership and evidence association.
- Server-only service credentials are never included in client bundles.

## 5. API contract

All routes use JSON except the signed evidence-upload flow. All user routes require an authenticated session. The API derives tenant scope from the session and membership. Rate limits are initial guardrails to tune from pilot traffic.

| Method and path | Auth | Request and response summary | Initial limit |
|---|---|---|---:|
| `POST /api/shops` | User | Create a shop and initialise its memory-account onboarding state. Returns shop ID and setup status. | 5/hour/user |
| `GET /api/shops` | User | Returns only the user’s active memberships. | 60/min/user |
| `POST /api/suppliers` | Shop member | `{ displayName, phone?, notes? }`. Returns supplier ID. | 30/min/user |
| `GET /api/suppliers` | Shop member | Filtered list for an authorised shop. | 60/min/user |
| `POST /api/deals` | Shop member | Creates a draft/quoted deal and optional lines. Returns deal and validation errors. | 30/min/user |
| `GET /api/deals` | Shop member | Filters by supplier, date, status and query. Returns paginated deals. | 60/min/user |
| `GET /api/deals/:dealId` | Shop member | Deal, lines, timeline and evidence metadata. | 60/min/user |
| `PATCH /api/deals/:dealId` | Shop manager or creator | Updates allowed fields; immutable deal history is written as events. | 30/min/user |
| `POST /api/deals/:dealId/events` | Shop member | `{ eventType, occurredAt?, summary, structuredPayload?, evidenceIds? }`. Returns event and memory-sync state. | 30/min/user |
| `POST /api/evidence/uploads` | Shop member | Requests a short-lived signed upload after server-side validation. Returns object key and upload URL. | 10/min/user |
| `POST /api/evidence/complete` | Shop member | Confirms upload, validates size/type/hash and associates evidence with a deal event. | 20/min/user |
| `POST /api/assistant/recall` | Shop member | `{ question, sessionId? }`. Returns `{ answer, sources[], memoryStatus }`. Sources contain deal/event/evidence IDs and display-safe excerpts. | 10/min/user |
| `POST /api/assistant/drafts` | Shop member | `{ dealId, selectedEventIds, goal }`. Returns an editable draft and cited source IDs. It does not send it. | 10/min/user |
| `POST /api/memory/retry` | Shop manager | Retries a failed write for a confirmed event. Returns job status. | 5/min/user |
| `POST /api/privacy/erase` | Shop owner | Creates an erasure request and enumerates relational rows, evidence and Walrus blob IDs. In the retailer-controlled model, returns the owner-signing step for the Security Delete transaction. Reports completion only after the signed deletion and read-path checks are verified; otherwise reports the blocker. | 3/day/user |
| `POST /api/webhooks/paystack` | Provider signature | Later. Verifies Paystack signature and updates subscription state idempotently. No billing in the challenge MVP. | Provider-defined |

### Recall response behaviour

- Retrieve Walrus memories using the authenticated shop’s owner account and namespace only.
- Resolve returned memory references to canonical `deal_events` and `evidence_files` inside the same shop.
- If a memory has no matching source, discard it from the answer context.
- If no source is relevant, say that no saved record was found. Do not infer a price, date or supplier outcome.
- Return source IDs alongside the answer so the UI can show clickable record cards.
- If Walrus is unavailable, allow browsing the canonical Supabase timeline but label semantic recall as unavailable. Never silently claim persistent recall succeeded.

## 6. Walrus memory contract

Each memory is a short, atomic statement derived from a user-confirmed deal event. It includes a date, event type and opaque source identifiers. Example pattern, not project data: “On [date], deal [opaque-id] with [shop-local supplier label] recorded [confirmed event]. Source event: [opaque-event-id].”

- Do not store a supplier’s personal contact details, raw image text, signed URLs, bank details or an entire conversation.
- Do not store unconfirmed LLM guesses. The retailer confirms extracted terms before the memory is written.
- Keep separate accounts/namespaces per shop. A staff member’s access comes from Vendra membership checks plus the shop’s delegate configuration.
- Corrections create a new memory version that explicitly supersedes the old source. Recall must prefer the newest valid version.
- Memory writes are asynchronous. Persist the MemWal job ID and show `queued`, `processing`, `ready` or `failed` in the UI.
- The exact key-owner model, account creation and deletion flow must be proven in a technical spike before production data is accepted.

## 7. Privacy and deletion requirements

Walrus Memory has a wallet-authenticated Security Delete flow in its current documentation, while the TypeScript SDK issue tracker records that the normal SDK does not expose an individual deletion helper. The project must test the signed deletion flow, blob and index behaviour with the chosen owner account before it promises permanent deletion. Superseding a memory or clearing an index must not be described as permanent erasure. Store only low-risk, necessary pilot data until this is tested.

Users must be able to correct a deal, export their records, revoke staff access and request deletion. Any retention limitation in Walrus must be made clear before a retailer stores sensitive deal information.