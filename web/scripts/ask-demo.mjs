/**
 * Ask Vendra a real question and print the real answer.
 *
 * This is the gate for the demo film. The film's central beat is a grounded
 * answer with citations, so that beat cannot be built until this returns one. If
 * the answer is wrong, or uncited, or empty, the film has to deal with that — the
 * answer is not edited, re-rolled, or replaced with a better one.
 *
 * Goes through the deployed API under the retailer's own session, so RLS and
 * tenant derivation both apply exactly as they do in the browser.
 *
 *   node scripts/ask-demo.mjs <email> <password> "<question>"
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const raw = fs.readFileSync('.env.local', 'utf8');
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  const f = v[0];
  if ((f === '"' || f === "'") && v[v.length - 1] === f) v = v.slice(1, -1);
  process.env[t.slice(0, i).trim()] = v;
}

const [email, password, question] = process.argv.slice(2);
if (!email || !password || !question) {
  console.error('usage: node scripts/ask-demo.mjs <email> <password> "<question>"');
  process.exit(1);
}

const BASE = process.env.DEMO_BASE_URL ?? 'https://vendra-psycho-projects.vercel.app';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error('sign-in failed:', signInError.message);
  process.exit(1);
}

/**
 * The application authenticates with **SSR cookies**, not a bearer token.
 * Sending `Authorization: Bearer` returns 401, which is correct: the API routes
 * read the session from cookies because they are server routes behind the
 * middleware. This is the same technique e2e-prod.mjs uses.
 */
async function captureSessionCookies(accessToken, refreshToken) {
  const captured = new Map();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (cookiesToSet) => {
          for (const cookie of cookiesToSet) captured.set(cookie.name, cookie.value);
        },
      },
    },
  );
  await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return captured;
}

const jar = await captureSessionCookies(signIn.session.access_token, signIn.session.refresh_token);
const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
console.log(`session   ${jar.size} cookie(s): ${[...jar.keys()].join(', ')}`);

const res = await fetch(`${BASE}/api/assistant/recall`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
  body: JSON.stringify({ question }),
});

console.log(`base     ${BASE}`);
console.log(`status   ${res.status} ${res.statusText}`);

const text = await res.text();
let payload;
try {
  payload = JSON.parse(text);
} catch {
  console.log(text.slice(0, 800));
  process.exit(1);
}

console.log('');
console.log('=== RAW RESPONSE ===');
console.log(JSON.stringify(payload, null, 2).slice(0, 4000));

fs.writeFileSync('../demo/analysis/recall-response.json', JSON.stringify(payload, null, 2));
console.log('');
console.log('saved to demo/analysis/recall-response.json');