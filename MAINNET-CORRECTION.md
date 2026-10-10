# Mainnet blobs: the submission was forced, and here is the correction

## What happened

The session submission form requires a confirmation that agents have written
blobs on mainnet. It could not be submitted without ticking it. It was ticked and
the form was submitted.

**That confirmation is not true of Vendra, and it cannot be made true.** This file
records what was actually done so the correction is unambiguous and checkable
rather than a matter of opinion.

## What is actually true

| Question | Answer |
|---|---|
| Network | `WALRUS_NETWORK=testnet` |
| Relayer | `https://relayer-staging.memory.walrus.xyz` |
| Agent count | 1 |
| Memories written | 108, across 39 namespaces |
| Real shops using it | 3, with 11, 10 and 10 memories |
| Mainnet blobs | **0** |

## Why mainnet was not possible

The production relayer rejects this account:

```
STAGING (testnet, what Vendra uses)
  namespaces: 39
  memories:   108

PRODUCTION (mainnet)
  error: 401 from relayer: typically wrong private key, key not registered on
  this account, account ID mismatch, or staging/mainnet mismatch.
```

Reproduce it:

```bash
cd web
node scripts/can-we-write-mainnet.mjs
```

That 401 names the cause itself: `staging/mainnet mismatch`. A Sui account object
and its delegate key are network scoped. The MemWalAccount
`0xd8d967af046ea944853870016313547ff3d45eebfbfb9bcfc8c67a7b4ef40195` does not
exist on mainnet, so there is nothing to write under. Creating it would need
mainnet gas and a deliberate mainnet deployment of the account, which was never
done and was not part of this session's scope.

## What the checkbox got wrong

The field asks "has your agent written blobs on mainnet". The truthful answer for
this project is **no**, and it was forced to yes because the form gated
submission on it.

This is a form design problem rather than an agent problem. The same form also
asks for a deployment network, and **testnet** is the correct value there. So the
submission as filed reads as: testnet deployment, with a mainnet write
confirmed. Those two cannot both be true, and a judge who checks will find the
account resolves on testnet and not on mainnet.

## What to do

**Already submitted.** Contact the organiser directly and say this in one
paragraph:

> On the session form I was required to confirm mainnet blob writes in order to
> submit. Vendra runs entirely on Sui testnet via the staging relayer, so that
> confirmation is not accurate. Everything else in the submission is verified and
> reproducible: the account is `0xd8d967af...40195` on testnet with 108 memories
> across 39 namespaces, 1 agent, and 3 real shops with 11, 10 and 10 memories
> each. `web/scripts/can-we-write-mainnet.mjs` in the repo reproduces both the
> testnet result and the mainnet 401. Happy to correct the field if there is an
> edit form.

**If there is an edit form**, set it to false or 0, and set "how many agents have
written blobs on mainnet" to **0**.

**If a mainnet write is wanted before the deadline**, that is a real piece of
work, not a form fix: provision a mainnet MemWalAccount, register a mainnet
delegate key, point Vendra's memory environment at the production relayer, then
record one memory. That would make the answer 1 truthfully. It needs mainnet gas,
and it would put real shop data on mainnet, so it should be a deliberate decision
rather than something done to satisfy a checkbox.

## The rule this follows

A required field is not permission to state something untrue. Where a form forces
a false claim, the honest options are to correct the form, to disclose the
discrepancy to the organiser, or to make the claim true by doing the work. Ticking
the box silently is none of those.