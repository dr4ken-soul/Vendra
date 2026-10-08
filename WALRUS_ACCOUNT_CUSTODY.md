# Walrus Memory Account Custody: Build-Agent Decision

**Decision status:** The user has delegated the technical custody choice to the implementation agent. Do not ask the user to select between wallet custody options. The agent must investigate, choose, test and document the safest workable path before enabling real retailer data.

## Product constraints

Walrus Memory account setup uses a Sui owner account and a registered delegate. A normal Vendra login does not by itself make the retailer the owner of that Walrus account. The production privacy goal remains retailer-controlled access, separate shop scopes, honest disclosure and a verified deletion path. The exact custody mechanism is an implementation decision, not a user-facing design gate.

## Required decision process for the implementation agent

1. Re-check the current official Walrus Memory and MemWal documentation at implementation time. Verify account provisioning, per-shop namespace behavior, delegate permissions/revocation, service or wallet signing options, Security Delete requirements and supported post-delete reads in the selected deployment. Do not assume that a provider feature exists because it sounds plausible.
2. Prototype at least two isolated shop scopes with disposable, synthetic facts. Prove that one shop cannot read or write another shop’s account, namespace, memory or evidence.
3. Choose the custody model that can actually be operated securely and explained to the target retailer:
   - Prefer a retailer-controlled Sui owner account if onboarding, delegate registration/revocation, recovery and owner-signed deletion can be made practical and tested.
   - If that flow is not workable for the pilot, a separate service-managed owner account and namespace per shop is an allowed implementation fallback. Keep it explicitly custodial and disclosed in the UI and participant notice. It is not retailer-owned.
   - Never use one shared global Walrus account/namespace or a broad key that silently gives every shop the same memory scope.
4. Keep owner/delegate secrets in a suitable server-side key-management system. Store only a key reference in app configuration/database. Do not put private keys in browser code, local storage, source control, logs or screenshots.
5. Verify the actual Security Delete path end to end. A retailer-controlled deletion stays pending until the valid owner signature, successful transaction and supported post-delete retrieval/index checks are confirmed. A service-managed test account may be signed for by the service only under the documented custody model; disclose that fact and do not represent it as retailer-signed ownership.
6. If account isolation, key custody, revocation or deletion cannot be demonstrated, disable Walrus writes for real shop data. Keep testing to disposable synthetic data and report that the challenge’s real-user evidence requirement has not been met. Do not bypass the blocker to meet a deadline.
7. Record the selected model, rejected alternatives, threat controls, participant-facing copy, test evidence and remaining limitations in `TECH_DECISIONS.md`, `PRIVACY_SECURITY.md`, `WALRUS_MEMORY_PLAN.md` and the final submission material. Update the data contract and UI wording if the chosen model changes.

## Data and consent safeguards

- Keep accounts, namespaces and delegates distinct per shop under every supported model.
- For any pilot with real participants, explain who controls the Walrus owner account, what the service can access, what is stored, and how deletion works. Obtain participant consent. Use only the minimum, low-sensitivity deal facts needed for testing until deletion and retention are verified.
- A service-managed account is custodial even if each shop has a unique account, separate namespace and separate Vendra login.
- Do not claim retailer ownership, permanent erasure, privacy from the service operator or challenge completion without evidence.

## Decision record to complete during build

| Item | Required record |
|---|---|
| Chosen owner-account model | Retailer-controlled, service-managed per shop, or another verified option; name the actual provider/API. |
| Account and namespace isolation | Test IDs and the cross-shop negative-test result. |
| Delegate/key operations | Where the key is stored, who can use it, how it is revoked and what is logged. Never record the key itself. |
| Deletion | Owner-signing/custodian path, transaction result and independent read/index verification. |
| Retailer disclosure | Exact UI and consent wording matching the implemented model. |
| Limitations | Any unresolved recovery, retention, operator-access or deployment constraints. |

## Source references

- [Walrus Memory agent runtimes](https://docs.wal.app/walrus-memory/guides/agent-runtimes)
- [Walrus Memory account and namespace quick start](https://docs.wal.app/walrus-memory/getting-started/quick-start)
- [Official Walrus Memory Security Delete guide](https://docs.wal.app/walrus-memory/guides/delete-memories-programmatically)
- [MemWal SDK deletion issue #1043](https://github.com/MystenLabs/MemWal/issues/1043)
