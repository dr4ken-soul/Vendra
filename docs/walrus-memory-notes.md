# Walrus Memory: custody decision and verification state

This file records what was decided about Walrus Memory, what has actually been
verified, and what remains blocked. It is written to be read by someone deciding
whether to trust the claims in this repository.

**Short version: no Walrus Memory claim in this repository is verified.** The
adapter is written against the real SDK's published TypeScript interface, but it
has never been executed against a live Walrus Memory account, because no such
account exists yet.

---

## 1. Custody decision

**Decision: service-managed custody.** The Vendra server holds a Walrus owner key
and signs memory writes itself. Each shop receives:

- its own Walrus Memory account reference, and
- its own unique namespace derived from the shop id.

**Why.** A retailer running a provision shop has no Sui wallet, no gas budget and
no interest in key management. Requiring a wallet at signup would put the
hardest possible step first and would exclude the exact users the product is for.
A per-shop account reference plus a per-shop namespace means one shop can never
read another shop's memories even though the service holds the keys for all of
them.

**This is custodial, and it is disclosed as custodial.** The privacy notice and
the in-app disclosure both state that the operator holds the keys and can
compulsorily access stored memories. It is never described as retailer-owned or
self-custodied. See [`WALRUS_ACCOUNT_CUSTODY.md`](../WALRUS_ACCOUNT_CUSTODY.md)
for the full reasoning.

### Consequence that cannot be softened

Because the operator holds the keys, the operator's promise is the only thing
standing between a retailer and compelled access. That is a real limitation, not
a detail. The alternative — retailer-held keys — was rejected for the reasons
above, and the trade-off is recorded rather than hidden.

---

## 2. What the adapter actually calls

The adapter in `web/src/lib/memory/walrus.ts` was written against the installed
package's own type declarations, not against documentation or memory of the API.
The interface read from `node_modules/@mysten-incubation/memwal` is:

```
MemWal.create(...)
memwal.remember(...)
memwal.getRememberStatus(...)
memwal.recall(...)
memwal.listNamespaces()
```

Those five methods are what the adapter uses, and nothing else. If the real SDK
differs at runtime, the adapter fails loudly; it does not fall back to writing
somewhere else and report success.

---

## 3. Verification matrix

| Claim | Status | How it would be verified | Currently |
|---|---|---|---|
| A memory write reaches Walrus | **UNVERIFIED** | Provision a live account, write one memory, confirm `getRememberStatus` reports it | No account |
| A memory can be recalled | **UNVERIFIED** | `recall()` with a query whose answer is known | No account |
| One namespace cannot return another shop's memories | **UNVERIFIED** | `tests/walrus-memory/isolation.test.ts` | **Skipped** |
| Deleting a shop removes its memories | **BLOCKED — impossible** | — | See below |
| The memory count shown to the retailer is real | **UNVERIFIED** | Compare `listNamespaces().memory_count` to a manual count | No account |

The isolation test suite **skips loudly and prints why** when credentials are
absent. It does not pass vacuously. A green test run with no credentials does
**not** mean isolation is verified, and the README says so explicitly.

---

## 4. Permanent deletion is not possible, and the product says so

The MemWal SDK exposes no production delete method. The only `forget` in the
package is on `MemWalMock`, which is a mock.

This has a direct consequence that the application does not soften:

- `POST /api/privacy/erase` **does** delete everything Vendra controls: the
  Postgres rows, the private Storage objects, and the auth account.
- It reports the Walrus Memory layer as **`blocked`**, never as `complete`.

A retailer who erases their data is therefore told, in the response and in the
UI, that one layer could not be deleted and why. Silently reporting success here
would be the single most dishonest thing this application could do, because the
retailer's belief that their data is gone would be false.

This is recorded in `docs/privacy-and-data-flow.md` and in the `/privacy` page.

---

## 5. What is needed to close this out

1. **The Walrus Memory package id** for the target Sui network.
2. **The AccountRegistry shared object id** for that network.
3. A funded Sui testnet wallet to pay for the account-creation transaction.

With those, provisioning uses the SDK's own account entry point:

```ts
import { createAccount, addDelegateKey } from '@mysten-incubation/memwal/account';
```

Those two ids are not published on a credentials page the way a database key is.
They are deployment parameters of the Walrus Memory contracts on a specific
network, and they have deliberately **not been guessed**. A wrong id produces a
transaction that either fails or, worse, succeeds against the wrong contract.

---

## 6. Why the application still works without any of this

Walrus Memory is the cross-session recall layer. It is not the system of record.

- Confirmed deal events save to Postgres first. That write is authoritative.
- A `walrus_memory_sync` row is inserted **before** the network call, so a crash
  between the two cannot lose the fact that a memory was owed.
- If the write fails, the row records the failure and the shop's memory status
  shows as unavailable.
- Ask Vendra then falls back to searching the retailer's real Postgres records and
  says plainly that deal memory is unavailable.

So the product is usable and honest today. What it cannot yet do is recall across
sessions from the memory layer specifically. That capability is claimed nowhere.
