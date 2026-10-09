# Deploying Vendra

## The Vercel Root Directory must be `web`

This is the setting that silently breaks every deployment, and it cost fifteen
hours of the site being stale.

The Next.js app is in `web/`, not at the repository root. With the Vercel
project's Root Directory left at the repository root, the build runs `next build`
in a directory with no `app/` folder and fails in about seven seconds:

```
> Couldn't find any `pages` or `app` directory. Please create one under the project root
```

The failure is fast and total, which is the only reason it was easy to miss: the
live site keeps serving the last build that succeeded, so nothing looks broken
until you check what is actually deployed.

Set Root Directory to `web` in the Vercel project settings, or deploy from inside
`web/` with `npx vercel --prod`, which uses the linked project in `web/.vercel`.

**How to tell the deployed build is stale, without reading code.** The confirmation
route distinguishes its two link shapes:

| Request | Old build | Current build |
|---|---|---|
| `/auth/confirm?token_hash=…&type=email` | `/sign-in` with no query | `/sign-in?error=That confirmation link has expired…` |
| `/auth/confirm` with nothing | `/sign-in` | `/sign-in?error=That link was incomplete…` |

A missing `?error=` means the deployment predates the fix.

## Two hostnames, one deployment

`vendra-zeta.vercel.app` and `vendra-psycho-projects.vercel.app` both serve the
app; the first resolves to the second. `NEXT_PUBLIC_SITE_URL` on Vercel is
`https://vendra-psycho-projects.vercel.app`.

Supabase's **Site URL** is currently `https://vendra-zeta.vercel.app`, so every
email link is built on that hostname and takes one redirect hop to reach the
canonical one. It works. Aligning them removes the hop.

There is a subtler consequence. The app sends `emailRedirectTo` built from
`NEXT_PUBLIC_SITE_URL`, which is `vendra-psycho-projects`, while the Supabase
redirect allow-list contains only `vendra-zeta`. Supabase discards a
`redirect_to` that is not on the allow-list, silently, and falls back to the Site
URL. Nothing breaks today because the confirmation template does not use
`{{ .RedirectTo }}` — but a password reset would land on the homepage instead of
the reset page.

**Add `https://vendra-psycho-projects.vercel.app` to the redirect allow-list.**

## Walrus credentials must be pushed, and the relayer must match

Two environment variables were missing from production, and a third was wrong.
All three were invisible from the deployed site, which simply showed "deal memory
is not configured" and disabled the button that completes setup.

`WALRUS_MEMORY_ACCOUNT_ID` and `WALRUS_DELEGATE_PRIVATE_KEY` had never been pushed.
They were provisioned locally *after* the last push, so the earlier push was
correct when it ran and silently incomplete afterwards.

`WALRUS_MEMORY_API_URL` was the more interesting one. `.env.local` points at the
**staging** relayer, `https://relayer-staging.memory.walrus.xyz`, because the Walrus
Memory account was provisioned on **Sui testnet**. Production was pointed at
`https://relayer.memory.walrus.xyz`. Every call returned:

```
walrus_error 401 from relayer: typically wrong private key, key not registered on
this account, account ID mismatch, or staging/mainnet mismatch
```

The credentials were fine. The relayer was the wrong one, and the 401 says so in
its own text. A testnet account and a mainnet relayer cannot authenticate against
each other however correct the key is.

**Push Walrus variables with an explicit filter, never a blanket push:**

```bash
node scripts/push-env-to-vercel.mjs --dry-run --only WALRUS_MEMORY_ACCOUNT_ID,WALRUS_DELEGATE_PRIVATE_KEY
node scripts/push-env-to-vercel.mjs --only WALRUS_MEMORY_ACCOUNT_ID,WALRUS_DELEGATE_PRIVATE_KEY
```

The script refuses to push a localhost value into production, because
`.env.local` is the development file and a blanket push would otherwise overwrite
the production `NEXT_PUBLIC_SITE_URL` with `http://localhost:3000`. That is not
hypothetical; it is what the unfiltered dry run produced.

**To verify Walrus is actually working in production**, the end-to-end suite
reports it:

```
PASS  memory endpoint reports real state :: status=active walrusConfigured=true
```

`status=pending` means credentials are missing. `status=degraded` means they were
rejected or the relayer did not respond. Only `active` proves the namespace works.

## After deploying

```bash
cd web
npm run build                     # must be clean before deploying
npx vercel --prod --yes
$env:E2E_BASE_URL="https://vendra-psycho-projects.vercel.app"
npm run test:e2e:prod             # 23/23
npm run clean:test
npm run verify:clean
```

`verify:clean` exits 0 while still *reporting* a non-test account. That is
deliberate: the founder's own account `web3psycho000@gmail.com` exists because
sign-up was verified by hand, and deleting someone's real account to make a
number look tidier is exactly the behaviour this repository avoids elsewhere.