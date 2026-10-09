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