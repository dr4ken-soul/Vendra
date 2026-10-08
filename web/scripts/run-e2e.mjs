// Load .env.local into process.env, then run the end-to-end smoke test.
//
// The test drives the real application over HTTP against the real Supabase
// project and the real Gemini model. Nothing is mocked.
//
//   cd web && npm run test:e2e   (with `npm run dev` running)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');

const raw = fs.readFileSync(path.join(webRoot, '.env.local'), 'utf8');
let loaded = 0;

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

  process.env[key] = value;
  loaded += 1;
}

console.log(`Loaded ${loaded} variables from .env.local`);

// The test reads the env file relative to the web root.
process.chdir(webRoot);

// Importing runs the scenario; it calls process.exit when finished.
await import('./e2e-smoke.mjs');