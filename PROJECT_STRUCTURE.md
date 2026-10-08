# Vendra Project Structure

This is a planning tree only. It describes the intended repository after code approval. It does not create source code, migrations or API route files.

```text
Vendra/
├── README.md
├── PRODUCT.md
├── APP_BLUEPRINT.md
├── FRONTEND_SPEC.md
├── AGENT_CONTEXT.md
├── BUILD_PLAN.md
├── DATA_API_CONTRACTS.md
├── MARKET_RESEARCH.md
├── PRIVACY_SECURITY.md
├── TECH_DECISIONS.md
├── WALRUS_ACCOUNT_CUSTODY.md
├── WALRUS_MEMORY_PLAN.md
├── SUBMISSION_PLAN.md
├── MARKETING.md                 # exactly one original X post
├── .env.example                 # placeholder names only, no secrets
├── video/                       # approved source video and storyboard references
│   ├── scene-01-quote-v2.png    # identity/style anchor for video generation
│   ├── sequence-01-agreement.png
│   ├── sequence-02-handoff.png
│   ├── sequence-03-inspection-v2.png
│   ├── sequence-04-recall.png
│   └── vendra-ambient-loop.mp4  # pending upload of the approved export
├── web/
│   ├── public/video/            # optimised web copy of the approved video
│   └── src/
│       ├── app/                 # marketing, authentication and app routes
│       ├── components/          # navigation, timeline, evidence and chat UI
│       ├── lib/                 # Supabase, MemWal and model adapters
│       ├── hooks/               # browser interactions and data hooks
│       └── styles/              # tokens, typography and global effects
├── supabase/
│   ├── migrations/              # written only after code approval
│   └── seed/                    # clearly labelled demo fixtures, never fake user proof
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── tenant-isolation/
│   └── walrus-memory/
└── docs/
    ├── privacy-and-data-flow.md
    ├── walrus-memory-notes.md
    └── real-user-test-log.md    # consented evidence only
```

## Boundary notes

- The five approved stills are video-generation references. They are not five separate embedded videos.
- The approved Google Flow export is not present in the shared workspace yet. `vendra-ambient-loop.mp4` is the intended source filename, not a claim that the file exists.
- Raw supplier evidence belongs in a private storage bucket. Walrus Memory stores short, source-linked facts, not public evidence URLs.
- Keep server secrets and per-shop Walrus delegate keys out of `web/public` and source control.
- Migrations, routes, components and tests are deferred until the user approves the planning documents.