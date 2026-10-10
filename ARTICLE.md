# The deal, the argument, and the delivery that was short

Nobody writes down the argument.

A retailer quotes a supplier on Tuesday. They agree a price on Wednesday, after
the supplier pushes back. The goods arrive on Friday and two cartons are missing.
By Monday the argument is gone — it lived in a phone call, and what survives is a
memory: *that supplier, that attitude.*

That memory is wrong in the useful way. It is built from the last thing that
happened, not from everything that happened. So the same shop re-negotiates from
zero, accepts a worse price, and cannot say why.

## What Vendra does instead

Vendra records a deal as a sequence of confirmed events: `quote_received`,
`terms_agreed`, `delivery_checked`, `issue_opened`, `resolution_recorded`. Each
one is a fact someone confirmed, not a note someone typed. Events are append-only
— correcting a past record adds a correction and keeps the original, so the
history stays auditable instead of being quietly rewritten.

Then it asks the question you would have asked if you remembered: *what did we
agree with this supplier, and what went wrong?*

## Memory that has to earn the answer

An assistant about money is only useful if it is wrong less often than you are.
So Vendra does not let the model decide what is true.

Each confirmed event is composed into a memory record carrying its event ID,
deal ID and date, then written to Walrus Memory on Sui. Retrieval is scoped to one
shop's namespace and nothing else. A second shop cannot read the first — that is
asserted by isolation tests against the live relayer, not by documentation.

When you ask something, the answer is composed only from retrieved memories, and
every sentence names the source it came from. Here is a real answer from a real
shop, returned by the deployed product:

> "According to SOURCE 6, you agreed on 6 cartons of tomato paste at 2,917 NGN per
> carton, totalling 17,500 NGN, following negotiation on 30 September 2026."

That is 18,000 quoted, negotiated down to 17,500. The source line is not
decoration. It is the reason to trust the number.

## What happens when memory isn't there

This is the part I would rather admit than hide.

Walrus Security Delete is signed by the account that owns the blob. Vendra holds a
delegate key, not the owner key, so we cannot sign that deletion. I verified this
rather than assuming it — the SDK has no deletion method, the relayer advertises
none, and our key does not match the account owner. The privacy notice says
exactly that, and a deletion request reports that layer as blocked rather than
erased.

So when memory is unavailable, Vendra says so and falls back to searching the
relational record. It labels the answer as a record search, not memory. I would
rather return the right answer with an honest label than a confident one.

It also cannot backdate. Event timestamps are set server-side, so a retailer
cannot record a deal as though it happened last month. The deal date is real and
the event date is the day it was entered.

## Where it actually stands

Three people I know personally have been using it since 9 October 2026, across two
days. They have recorded 11, 10 and 10 memories between them, every one confirmed
stored on the relayer rather than trusted from a database row.

Two of those facts only came out because I looked. Signing out silently did
nothing — the route was at the wrong path, and a 404 is a successful fetch, so the
button never knew it had failed. And 31 memories sat marked "syncing" forever
because reconciliation only ran on two screens; the writes had succeeded, the
product was just reporting a stale row. Both shipped past a clean build and a
passing test suite.

The demo film was rebuilt only after I screenshotted the live site and looked at
the frame — it was showing an empty form under a caption claiming real figures.

The tooling works. It also lied to me four times, politely, until I checked.