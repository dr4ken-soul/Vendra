# Walrus Memory: custody decision and verification state

This file records what was decided about Walrus Memory, what has actually been
verified, and what remains blocked. It is written to be read by someone deciding
whether to trust the claims in this repository.

**Status: provisioned and verified. One account, one namespace per shop, and
namespace isolation is proved against the live relayer.** The single remaining
limitation is permanent deletion, which the SDK cannot do.

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

## 2. What is provisioned

Created 9 October 2026 by `web/scripts/provision-walrus.mjs`, which is committed
and re-runnable on a fresh wallet.

| Item | Value | Where it lives |
|---|---|---|
| Network | Sui testnet | `WALRUS_NETWORK` |
| MemWalAccount object | `0xd8d967af…40195` | `WALRUS_MEMORY_ACCOUNT_ID` |
| Owner | the Sui wallet that signed `create_account` | on chain |
| Delegate key | Ed25519, registered on chain via `add_delegate_key` | `WALRUS_DELEGATE_PRIVATE_KEY` |
| Relayer | `https://relayer-staging.memory.walrus.xyz` | `WALRUS_MEMORY_API_URL` |

The network package and registry ids are **published deployment parameters**, not
secrets, and they live in the provisioning script rather than the environment:

```
testnet   package 0x0a625e2db2af6f591a4c80a3d8551ddf11656089cc3a20c5e9e7f8fb75b9265c
          registry 0x736aef9906798fca4460490ccdf8e8502ef170122dc26ecae32111b78c6b42dd
mainnet   package 0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5
          registry 0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f
```

Source: <https://docs.wal.app/walrus-memory/contract/overview#network-ids>

The runtime `MemWal` path does **not** need the package or registry id. Only
`MemWalManual`, which signs Seal operations locally, does. Provisioning needs
both, because `create_account` is a Move call.

**Verify the account yourself:** <https://suiscan.xyz/testnet/object/0xd8d967af046ea944853870016313547ff3d45eebfbfb9bcfc8c67a7b4ef40195>

### Why the account id and delegate key are not in this repository

They are credentials. `WALRUS_DELEGATE_PRIVATE_KEY` signs every memory write. It
lives in `web/.env.local`, which is gitignored, and in a secrets manager in any
real deployment.

Rotation does not require moving ownership: register a new delegate key, redeploy,
then remove the old one on chain. Removed keys cannot read anything written after
removal, though memories written while the key was valid stay readable to it
until re-encrypted.

---

## 3. What is verified, and how

`tests/walrus-memory/isolation.test.ts` runs against the live relayer. **All six
assertions pass.**

| Assertion | Result |
|---|---|
| The configured relayer is reachable | passes |
| A memory can be written into Shop A's namespace | passes |
| A different memory can be written into Shop B's namespace | passes |
| Recalling Shop A never returns Shop B's memory | passes |
| Recalling Shop B never returns Shop A's memory | passes |
| An empty namespace reports empty, not another shop's memories | passes |

This is the check `WALRUS_ACCOUNT_CUSTODY.md` required **before real retailer data
is accepted**, and it is now satisfied. It is the second isolation boundary
alongside Supabase RLS.

Two shop memories are written and recalled during the suite and remain on the
testnet relayer. That is test data in a namespace named `vendra-test-*`, not
retailer data.

### A bug that made this untestable

`walrusEnv()` required `WALRUS_READER_CREDENTIAL`. **No such credential exists.**
`MemWalConfig` accepts exactly four fields — `key`, `accountId`, `serverUrl`,
`namespace` — and the adapter never passed a reader credential to the SDK either.
Its only effect was to return `null` forever, so memory could never activate even
after an operator had provisioned a real account. The field is now ignored, and
`walrusEnv()` reports if a stale value is set rather than pretending it mattered.

A second bug hid the first: vitest never loaded `.env.local`, so every suite saw
an empty environment. The tenant-isolation suite had worked around this by parsing
the file itself, through a path built with `new URL(...).pathname`, which
percent-encodes spaces. On a path containing "Coding Area" it silently found
nothing. Both are fixed; tests now load the same environment the app does.

---

## 4. Permanent deletion is not possible, and the product says so

The MemWal SDK exposes no production delete method. The only `forget` in the
package is on `MemWalMock`, which is a mock.

This has a direct consequence that the application does not soften:

- `POST /api/privacy/erase` **does** delete everything Vendra controls: the
  Postgres rows, the private Storage objects, and the auth account.
- It reports the Walrus Memory layer as **`blocked`**, never as `complete`.

A retailer who erases their data is told, in the response and in the UI, that one
layer could not be deleted and why. Silently reporting success here would be the
single most dishonest thing this application could do, because the retailer's
belief that their data is gone would be false.

Two tests in the Walrus suite skip for exactly this reason, and the suite says so
rather than passing vacuously.
