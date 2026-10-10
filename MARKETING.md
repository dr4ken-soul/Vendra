# Vendra: X posts

Six candidates, each **exactly 280 characters**, each carrying `@WalrusProtocol`
and `#WalrusMemory`. Post 1 is the strongest single post on its own; the rest are
alternatives or a follow-up set.

**The canonical drafts live in `demo/x-posts.txt`.** Do not retype them — the
character counts are verified:

```bash
cd demo
node analysis/count-x.mjs      # checks the body against the budget
node analysis/assemble-x.mjs   # prints exactly what gets pasted, and counts it
```

`assemble-x.mjs` is the one that matters. It assembles body + `" #WalrusMemory"`
and counts the pasted string, because the body budget is easy to hit and the
pasted result easy to get wrong — one missing space turns a valid 280 into 279.

Measured as Unicode code points, which is how X counts. Counting UTF-16 units
would make any post containing an em dash come out short.

**Publish gate.** These describe a deployed product used by three people, which
is true and verifiable:

```bash
cd web && node scripts/audit-real-usage.mjs
```

The counts in post 5 come from that script, not from memory. If a participant's
numbers change before publishing, re-run it and adjust — and note that adjusting
changes the character count, so re-run `assemble-x.mjs`.

**Do not add a "compare without memory" claim.** Vendra has no such mode. What it
does is label a fallback answer as a record search rather than memory, which post 3
describes. The reference projects' features are not ours.