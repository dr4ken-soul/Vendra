import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tests live at the repository root under tests/, per PROJECT_STRUCTURE.md,
 * while the application and its dependencies live in web/. Vitest therefore runs
 * with web/ as its root so node_modules resolves, and includes the test files
 * by their path relative to that root.
 *
 * Most suites are pure logic and run headless. A suite that renders React adds a
 * `@vitest-environment jsdom` docblock and needs no configuration here, but it
 * does need two things this file provides, because a test outside this root
 * cannot resolve packages the way an application inside it can:
 *
 *   - Vite must be allowed to serve files above the root.
 *   - The React entry points must be pointed at their real locations. Node's
 *     upward walk for a bare specifier starts at the test file, passes the
 *     repository root, and never reaches web/node_modules.
 *
 * The React aliases are ordered most-specific first on purpose. Vite matches a
 * string alias by prefix, so a bare `react` entry placed before them would also
 * capture `react/jsx-runtime` and rewrite it to a path that does not exist.
 */
export default defineConfig({
  root: here,
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'node',
    include: ['../tests/**/*.test.ts', '../tests/**/*.test.tsx'],
    // Load .env.local so a test calling the application's own config helpers sees
    // the same environment the running app does. Without it, a suite can report
    // a live feature as unconfigured when it is configured and working.
    setupFiles: ['./vitest.setup.ts'],
    // The tenant-isolation suite exercises the real Supabase REST API and needs
    // more than the default allowance.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
      'react-dom/client': path.join(here, 'node_modules/react-dom/client.js'),
      'react/jsx-runtime': path.join(here, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(here, 'node_modules/react/jsx-dev-runtime.js'),
      react: path.join(here, 'node_modules/react/index.js'),
    },
  },
});