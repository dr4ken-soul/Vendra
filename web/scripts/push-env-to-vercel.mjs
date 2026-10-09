/**
 * Push the non-empty values from web/.env.local into the linked Vercel project.
 *
 * Reads the local file, skips anything blank, and prints only variable NAMES and
 * value LENGTHS, so no secret is ever echoed to the console or the terminal
 * history. Always run --dry-run first.
 *
 *   node scripts/push-env-to-vercel.mjs --dry-run
 *   node scripts/push-env-to-vercel.mjs
 *   node scripts/push-env-to-vercel.mjs --only WALRUS_MEMORY_ACCOUNT_ID,WALRUS_DELEGATE_PRIVATE_KEY
 *
 * **Prefer --only.** `.env.local` is the development file, so a blanket push copies
 * development values into production. That is not hypothetical: running this with
 * no filter would have overwritten the production NEXT_PUBLIC_SITE_URL with
 * `http://localhost:3000`, which sends every confirmation link back to the
 * developer's own machine. The guard below refuses that outright rather than
 * relying on the operator to notice.
 *
 * Three details worth keeping, all of them learned from Vercel's own error
 * messages rather than guessed:
 *
 * 1. Values are passed with --value rather than on stdin. Piping stdin works, but
 *    it is interactive by default, and under a non-interactive shell the prompt
 *    aborts partway through, leaving the project half configured.
 *
 * 2. `--type config` and `--sensitive` are mutually exclusive; passing both fails
 *    with conflicting_type_flags. `--sensitive` alone implies Secret.
 *
 * 3. A NEXT_PUBLIC_ variable can never be a Secret, so every NEXT_PUBLIC_ value
 *    must use `--type config`. That is correct rather than a workaround: the anon
 *    key is sent to the browser by design, and marking it Secret would only stop
 *    the dashboard from echoing it back. Vercel refuses the combination, so the
 *    value is stored as config.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const raw = fs.readFileSync('.env.local', 'utf8');
const dryRun = process.argv.includes('--dry-run');

/** `--only A,B` restricts the push to named variables. */
const onlyArg = process.argv.indexOf('--only');
const only =
  onlyArg === -1 ? null : new Set(process.argv[onlyArg + 1].split(',').map((s) => s.trim()));

/** Escape hatch for a deliberate local push, e.g. a preview deployment. */
const allowLocalhost = process.argv.includes('--allow-localhost');

/**
 * `vercel link` writes VERCEL_OIDC_TOKEN into .env.local. It is a deployment
 * credential for the CLI, not application configuration, and must never be copied
 * into the project's own environment variables.
 */
const EXCLUDE = new Set(['VERCEL_OIDC_TOKEN']);

/**
 * Variables whose value is safe to expose to the browser, so Vercel must be told
 * they are plain config rather than secrets.
 */
const PUBLIC = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'GOOGLE_MODEL_ID',
  'WALRUS_NETWORK',
  'WALRUS_OWNER_SIGNING_MODE',
  'WALRUS_FAUCET_SUI',
  'WALRUS_MEMORY_API_URL',
  'WALRUS_DELEGATE_KEY_REF',
]);

const values = {};
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const index = trimmed.indexOf('=');
  if (index === -1) continue;

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  const first = value[0];
  if ((first === '"' || first === "'") && value[value.length - 1] === first) {
    value = value.slice(1, -1);
  }

  if (!value || EXCLUDE.has(key)) continue;
  values[key] = value;
}

/**
 * Refuse to point production at localhost.
 *
 * `NEXT_PUBLIC_SITE_URL` is the base every email link and confirmation redirect is
 * built from. Setting it to `http://localhost:3000` in production produces a site
 * whose sign-up email links to the developer's own machine, which is exactly the
 * failure this project spent a day undoing.
 */
function assertNotLocalhost(key, value) {
  if (allowLocalhost) return;
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(value)) return;
  console.error(`\nREFUSING to set ${key} to a local address: ${value}`);
  console.error('That would break production email links and confirmation redirects.');
  console.error('Pass --allow-localhost only if you mean a preview deployment.');
  process.exit(1);
}

let keys = Object.keys(values).sort();

if (only) {
  const missing = [...only].filter((k) => !values[k]);
  if (missing.length > 0) {
    console.error(`not in .env.local, or empty: ${missing.join(', ')}`);
    process.exit(1);
  }
  keys = keys.filter((k) => only.has(k));
}

for (const key of keys) assertNotLocalhost(key, values[key]);

if (dryRun) {
  console.log(`would set ${keys.length} variable(s)${only ? ` (filtered to ${[...only].join(', ')})` : ''}:`);
  for (const key of keys) {
    console.log(`  ${key}  (${values[key].length} chars, ${PUBLIC.has(key) ? 'config' : 'secret'})`);
  }
  for (const key of EXCLUDE) console.log(`  ${key}  EXCLUDED (deployment credential)`);
  process.exit(0);
}

const failed = [];

for (const key of keys) {
  const isPublic = PUBLIC.has(key);
  const args = [
    'env',
    'add',
    key,
    'production',
    '--value',
    values[key],
    '--yes',
    '--force',
  ];
  // A NEXT_PUBLIC_ variable can never be a Secret on Vercel, so it uses
  // `--type config`. Everything else uses `--sensitive`, which implies Secret.
  // The two flags are mutually exclusive.
  if (isPublic) {
    args.push('--type', 'config');
  } else {
    args.push('--sensitive');
  }

  process.stdout.write(`setting ${key} (${isPublic ? 'config' : 'secret'}) ... `);
  try {
    execFileSync('vercel', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true });
    console.log('ok');
  } catch (error) {
    console.log('FAILED');
    failed.push(key);
    process.stdout.write(String(error.stderr ?? error.message).split('\n').slice(0, 8).join('\n'));
    process.stdout.write('\n');
  }
}

console.log(`\nset ${keys.length - failed.length}/${keys.length} production variable(s).`);
if (failed.length > 0) {
  console.log(`failed: ${failed.join(', ')}`);
  process.exit(1);
}
