/**
 * Load web/.env.local into process.env before any test runs.
 *
 * The application reads its configuration from process.env, which Next.js
 * populates from .env.local. Without this, a test that calls the app's own
 * config helpers sees an empty environment and reports the feature as
 * unconfigured even when it is configured and working.
 *
 * That already happened: the Walrus suite skipped itself claiming credentials
 * were absent while a real account and delegate key sat in .env.local. A skip
 * for the wrong reason is worse than no skip, because it looks like a pass.
 *
 * Values already present in the real environment win, so CI can supply secrets
 * without a file and a developer can override a single value inline.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not new URL(...).pathname. The pathname form leaves the path
// percent-encoded, so a directory containing a space ("Coding Area") yields a
// path that does not exist and the env file is silently never found. That is
// exactly what happened: every suite saw an empty environment and the Walrus
// suite reported a working account as unconfigured.
const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, '.env.local');

if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
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

    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}
