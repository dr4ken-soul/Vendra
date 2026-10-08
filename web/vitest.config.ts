import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tests live at the repository root under tests/, per PROJECT_STRUCTURE.md,
 * while the application and its dependencies live in web/. Vitest therefore runs
 * with web/ as its root so node_modules resolves, and includes the test files
 * by their path relative to that root.
 */
export default defineConfig({
  root: here,
  test: {
    environment: 'node',
    include: ['../tests/**/*.test.ts'],
    // The tenant-isolation suite exercises the real Supabase REST API and needs
    // more than the default allowance.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
    },
  },
});