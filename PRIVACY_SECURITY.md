# Vendra Privacy and Security Plan

**Status:** Product and engineering plan, not a legal opinion or proof of compliance.  
**Initial scope:** Nigeria, independent grocery/provisions shops in Delta State.  
**Data rule:** no sensitive real retailer data in the prototype until tenant isolation, account custody and deletion have been tested.

## 1. Privacy model

- Each shop has a private workspace. The retailer owner controls invitations, roles and sharing.
- Shop staff receive only the permissions granted by the owner or manager.
- Suppliers have no Vendra account or access by default. The retailer can choose to export or share one specific record.
- Vendra’s assistant can read only the authenticated user’s authorised shop context.
- Do not create public supplier ratings, pooled cross-retailer pricing data or cross-shop benchmarking in V1.
- Keep personal data to what is needed to distinguish a supplier or user. Prefer shop-local labels over unnecessary personal identifiers.

## 2. Data inventory and purpose

| Data | Purpose | Location and control |
|---|---|---|
| User login and profile | Authenticate users and display the account | Supabase Auth/profile; minimum fields. |
| Shop and membership | Enforce tenant access and staff permissions | Supabase Postgres with Row Level Security. |
| Supplier/product labels | Help the retailer find their own records | Supabase Postgres, scoped to a shop. Optional contact details should be minimised. |
| Deal and event records | Canonical quote, agreement, delivery, issue and resolution history | Supabase Postgres, scoped to a shop, with corrections audited. |
| Photos, receipts and evidence | Support extraction and later evidence review | Private object storage, short-lived signed links, controlled retention. |
| Walrus memory facts | Cross-session semantic recall of confirmed, low-minimisation deal facts | One Walrus Memory account and namespace per shop. Store opaque source IDs, not files or public URLs. |
| Chat text and prompts | Answer a user’s question and possibly continue a session | Retain only when necessary; do not make the full transcript the durable memory. |
| Model requests | Extract selected fields or generate a sourced response | Send the minimum necessary text to the chosen provider; verify its current data-processing terms before launch. |
| Audit and security events | Detect access changes, exports, deletion and failures | Store minimal event metadata; do not duplicate sensitive deal content. |

## 3. Data flow

1. A retailer signs in. Supabase Auth establishes identity.
2. The server verifies membership and role. Tenant scope is derived from that authenticated membership, never trusted from an arbitrary browser field.
3. The retailer creates a deal or uploads evidence. The server validates the file and stores it in a private bucket.
4. Any OCR or model extraction uses only the selected file/text needed for that operation. The retailer reviews and confirms extracted terms.
5. Supabase stores the confirmed deal event and evidence reference as the canonical record.
6. Vendra sends a concise, source-linked fact to the correct Walrus Memory shop account and namespace. The server stores the async job ID and reports `pending`, `ready` or `failed` honestly.
7. At recall, the server retrieves only that shop’s memory. It resolves each memory reference back to a canonical Supabase event and evidence record before sending context to the model.
8. The answer displays links to the source records. The model cannot assert a price, term, date or outcome without a matching source.
9. If the retailer asks for deletion, Vendra enumerates app records and Walrus references, performs the verified deletion workflow and reports any item that could not be confirmed erased.

## 4. Walrus account, key and tenant isolation

Walrus Memory’s documented agent-runtime flow requires a Sui owner account and an Ed25519 delegate key. Ordinary Vendra login does not automatically make the retailer owner of the Walrus account.

### Production target

- Prefer a retailer-controlled owner account where feasible and usable.
- Register only the minimum delegate needed for Vendra’s server operations.
- Keep private keys in a managed key store or HSM-backed solution, never in browser storage or a source file.
- Separate owner account, namespace and delegate lifecycle per shop. Test that an attacker with one shop’s session cannot access another shop’s account, namespace, memory or evidence.
- Provide a clear path to revoke a delegate, recover access and request deletion.

### Temporary challenge fallback

The implementation agent may select an app-managed account to reduce wallet friction for a time-boxed test if it verifies per-shop isolation, key controls, revocation and deletion. It remains **service-managed**, not retailer-owned. Use a separate account and namespace per shop, disclose custody to each participant before onboarding, obtain consent and limit data to low-sensitivity records until the full deletion path is verified. Do not quietly present service custody as retailer ownership. The pilot choice does not settle the production privacy model.

## 5. Walrus deletion and retention

The official Walrus documentation describes a wallet-authenticated Security Delete API. Its documented flow includes challenge/verification, enumerating deletable blobs, preparing a sponsored Sui transaction, signing with the owner wallet and submitting the transaction. The reviewed MemWal TypeScript SDK does not expose a high-level production deletion helper; an SDK issue reports the gap. A mock `forget` method or clearing a semantic index is not proof that a blob has been deleted.

A retailer-controlled deletion request stays **pending** until the owner’s valid signature has authorised the Security Delete transaction, the transaction succeeds and post-delete retrieval/index checks pass. In a service-managed pilot selected by the implementation agent, the service signs as custodian only under the verified model and after participant notice/consent; that must never be described as retailer-signed ownership.

### Required end-to-end deletion test

- Create a disposable shop and identifiable synthetic test blob.
- Record the owner account, namespace, blob IDs and delegate state.
- Request deletion using the actual deployment’s owner-wallet signing flow.
- Verify the transaction was accepted and the target blob is no longer retrievable through supported read and relayer paths.
- Verify the semantic/index layer no longer returns the memory.
- Confirm app evidence, cached data, signed URLs and derived extraction data are removed or invalidated.
- Record failures and provider retention limits. Do not state “permanently erased” unless the storage layer and access path support that conclusion.

Until this test passes, keep real personal/supplier information out of Walrus. Offer a truthful deletion limitation and do not promise permanent erasure.

### Retention proposal

- Keep active shop records only while the retailer uses Vendra and needs the deal history.
- Give the owner an export and deletion-request path.
- Set a defined deletion schedule for account closure and backups after verifying technical and legal requirements.
- Retain the minimum security/audit metadata required to investigate access or billing disputes, without retaining deal contents unnecessarily.
- Final time periods require legal review and confirmation that the Walrus and backup paths can honour them. Do not publish a retention period that the system cannot enforce.

## 6. Threat model and controls

| Threat | Controls and tests |
|---|---|
| Cross-shop memory leakage | Separate Walrus account and namespace per shop; server-side tenant derivation; adversarial integration tests. |
| Broken object-level authorisation | Supabase RLS on every tenant table; storage policy verifies membership and object relation; test direct API/object-key access. |
| Client-supplied shop ID | Server derives scope from verified membership; ignore or reject foreign shop IDs. |
| Delegate or owner-key compromise | Server-side key vault, least privilege, rotation/revocation runbook, no logs/secrets, restricted operator access. |
| Prompt injection in supplier messages or files | Treat evidence as untrusted input; parse only after authorisation; do not let extracted instructions change tool permissions; confirm writes with the retailer. |
| Hallucinated supplier fact | Resolve retrieved memories to source events; show citations; refuse unsupported factual answers. |
| Accidental raw-data exposure to an LLM | Redact/minimise before request; use only selected context; check current provider terms; do not send full chat or file by default. |
| Public evidence-file access | Private bucket, short-lived signed URLs, per-request auth and content-type/size validation. |
| Lost or incorrect deletion | Maintain blob/source map and deletion status; test the Security Delete flow; reconcile unresolved items and report honestly. |
| Staff misuse or account takeover | Role-based permissions, revocation, audit log, secure authentication and notification of membership changes. |
| Cost abuse | User and shop rate limits, upload caps, model-token limits, spending alerts and usage monitoring. |

## 7. Nigeria privacy and governance

Before real retailer onboarding, review the Nigeria Data Protection Act 2023, relevant Nigeria Data Protection Commission guidance, controller/processor roles, cross-border processing, data-subject rights, retention, security and breach obligations with a qualified privacy professional. This document is a design plan, not a legal compliance certification.

Before each pilot, explain in plain language:

- What Vendra stores in Supabase and Walrus Memory.
- Which AI/model provider may receive selected text and for what purpose.
- Who controls the Walrus owner account and delegate keys.
- Which shop members can access records.
- How a retailer can correct, export, share or request deletion.
- Any deletion, backup, model-provider or account-custody limitation.

Obtain consent for research notes, screenshots, quotes and article evidence separately from consent to use the app. Participants must be free to decline publication without losing access to the test.

## 8. Release blockers

- [ ] Account ownership and delegate-key custody are chosen and accurately described.
- [ ] Per-shop Walrus account/namespace isolation is proven.
- [ ] Supabase RLS and storage isolation tests pass.
- [ ] Walrus Security Delete is tested end to end in the target deployment.
- [ ] Model-provider data handling is reviewed for the chosen model and exact plan.
- [ ] Pilot notice and consent language is approved.
- [ ] NDPA and privacy notice review is complete.
- [ ] Incident, key-revocation and deletion runbooks exist.

## Source references

- [Walrus Memory agent runtime and owner/delegate setup](https://docs.wal.app/walrus-memory/guides/agent-runtimes)
- [Walrus Memory account/namespace quick start](https://docs.wal.app/walrus-memory/getting-started/quick-start)
- [Official Walrus Memory Security Delete guide](https://docs.wal.app/walrus-memory/guides/delete-memories-programmatically)
- [MemWal SDK deletion issue #1043](https://github.com/MystenLabs/MemWal/issues/1043)
- [Nigeria Data Protection Commission](https://ndpc.gov.ng/)