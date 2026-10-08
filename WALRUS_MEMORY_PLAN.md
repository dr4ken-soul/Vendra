# Walrus Memory Integration Plan

**Status:** Integration design only. No implementation exists.  
**Purpose:** Give each retailer a private, cross-session memory of confirmed supplier-deal facts and link every recall back to the canonical deal record.

## 1. Integration boundary

Walrus Memory is the semantic recall layer. Supabase remains the canonical source for typed deal events, shop membership, evidence metadata, audit history and application status. Evidence files remain in private object storage. Walrus Memory does not replace tenant access checks, database records, file access controls or deletion procedures.

## 2. Write path

1. Retailer saves or confirms a deal event in Vendra.
2. Server validates user membership, shop scope and event provenance.
3. Server creates a concise memory candidate containing the event’s date, type, shop-local supplier label only if needed, and opaque `deal_id` / `event_id` references.
4. Avoid raw contact details, full conversations, document text, public URLs, signed URLs and unreviewed model guesses.
5. Server calls MemWal `remember` under the shop’s dedicated account and namespace.
6. Persist the async job identifier and status in `walrus_memory_sync`.
7. UI reports “Memory syncing” until successful completion; show failure and retry if needed.
8. A correction creates a new canonical event and superseding memory version; never silently overwrite the audit trail.

## 3. Recall path

1. User submits a natural-language question.
2. Server derives the authorised shop from the authenticated session and membership. Ignore a client-supplied account ID or `shop_id` for authorisation.
3. Server calls MemWal `recall` only in the correct shop account and namespace.
4. Resolve each recalled memory’s opaque event reference to a current canonical Supabase row in the same shop.
5. Discard orphaned, deleted, superseded or unauthorised results.
6. Send only the minimum retrieved canonical facts to the model.
7. Generate an answer with source cards. If nothing supports an answer, respond that no saved record was found.
8. Open evidence via a short-lived server-authorised URL only after a separate membership check.

## 4. Account and delegate scope

- One Walrus Memory owner account and namespace per shop. Never share one global memory account across retailers.
- Staff access is controlled by Vendra membership and per-shop delegate configuration. Do not create a broad delegate that can retrieve every shop’s data unless the design explicitly requires it and security review approves it.
- The application’s web session is not proof that a retailer owns the Sui account.
- Keep delegate secrets in a server-side key-management system. Do not store plaintext private keys in a database, browser local storage, logs, source control or screenshots.
- The implementation agent is responsible for choosing and documenting the custody model after checking current docs and testing isolation, key handling and deletion. If it uses a service-managed per-shop pilot account, disclose that it is service-controlled and not retailer-owned, obtain participant consent, and keep real data low-sensitivity until deletion is verified.
- Production should preserve the retailer-controlled ownership goal or explicitly renegotiate that privacy claim.

## 5. Failure and latency behaviour

- A failed Walrus write must not roll back a valid deal record. The app should show the record as saved in Supabase and the memory as failed/pending.
- A transient recall failure should allow browsing the Supabase timeline and explain that semantic memory is unavailable.
- Never claim cross-session recall has been saved until the Walrus job completes.
- Use retries only with idempotency/version checks to avoid duplicate memories.
- Record latency and error codes without logging raw memory content.

## 6. Privacy and deletion

Walrus’ official Security Delete guide describes a wallet-authenticated transaction flow. The reviewed TypeScript SDK reference does not expose a high-level production delete method. Before accepting sensitive data, test the signed Security Delete API against a real disposable blob in the chosen deployment. Verify blob retrieval and index behaviour after deletion. Clearing an index or testing a mock `forget` method does not prove the blob is erased.

A user deletion request should enumerate Supabase rows, evidence objects, Walrus memory/blob references, caches and derived text. Under the retailer-controlled model, the request remains **pending** until the account owner’s valid signature is supplied, the Security Delete transaction succeeds, and post-delete retrieval/index checks pass. A service-managed pilot account can be signed for by the service only under the implementation agent’s documented custody decision and after participant notice/consent; that is a custodial deletion operation, not retailer-signed ownership. Show pending/complete/blocked status for each data class. If a layer cannot be deleted or verified, report that limitation truthfully rather than claiming full deletion.

## 7. Acceptance test matrix

| Test | Expected result |
|---|---|
| Shop A writes one confirmed deal fact | Memory job completes in A’s scope and links to one canonical event. |
| Shop A asks in a new session | Relevant memory is found and answer cites the correct source event. |
| Shop B asks about Shop A’s supplier | No Shop A memory, deal or evidence is returned. |
| Client supplies another shop’s ID | Server rejects/ignores it and uses only authorised membership. |
| A memory has no canonical source row | It is excluded from the answer. |
| A deal fact is corrected | New version supersedes old; recall favours the confirmed current event. |
| Walrus write fails | Deal remains in Supabase; memory shows pending/failed; no false success message. |
| Walrus recall fails | App labels recall unavailable and provides timeline browsing. |
| Owner requests deletion | Actual Security Delete flow is exercised and blob retrieval is checked. |
| Delegate is revoked | Further writes/recalls through the revoked key are denied. |

## Sources

- [Walrus Memory overview](https://docs.wal.app/walrus-memory/getting-started/what-is-walrus-memory)
- [Walrus Memory quick start](https://docs.wal.app/walrus-memory/getting-started/quick-start)
- [Walrus Memory agent runtime guide](https://docs.wal.app/walrus-memory/guides/agent-runtimes)
- [MemWal TypeScript SDK API reference](https://docs.wal.app/walrus-memory/sdk/api-reference)
- [Official deletion guide](https://docs.wal.app/walrus-memory/guides/delete-memories-programmatically)
- [MemWal SDK deletion issue #1043](https://github.com/MystenLabs/MemWal/issues/1043)