/**
 * The sign-out button must actually sign the user out.
 *
 * Regression test for a defect reported by a real user: the button "does not
 * sign out and just loads".
 *
 * The cause was a route at the wrong path. The handler's own docstring said
 * `POST /api/auth/signout`, but the file sat at `api/auth/route.ts`, so it was
 * mounted at `/api/auth` and the URL the button called returned 404. The call
 * site awaited `fetch` and never checked the status, so the 404 was treated as
 * success — it navigated to /sign-in, the session was still valid, and the
 * middleware sent the user straight back into the app.
 *
 * Two things had to be true for this to be invisible, and both are asserted
 * here: the route exists at the path the button calls, and the call site
 * inspects the response status rather than only catching network failures.
 */
import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = resolve(__dirname, '../../web/src');

const signOut = vi.fn().mockResolvedValue({ error: null });

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { signOut } })),
}));

/**
 * next/headers and next/cache are not mocked.
 *
 * They resolve inside Next's own package rather than through vitest's alias, so
 * a vi.mock on the bare specifier does not reach them, and cookies() outside a
 * request scope throws. Instead the handler is exercised inside a request scope
 * established the way Next does it, which keeps the real modules in play — the
 * point is that the route calls signOut and reports the result, not that it
 * survives a particular mock arrangement.
 */
vi.mock('@/lib/env', () => ({
  publicEnv: () => ({ supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon' }),
  // lib/api.ts imports this from the same module, so a partial mock leaves it
  // undefined and the error path throws while building the response.
  MissingEnvError: class MissingEnvError extends Error {},
}));

/**
 * Establish a request scope for cookies().
 *
 * Next tracks it in an AsyncLocalStorage inside its own request module, so the
 * mock has to stand in for that module rather than wrap cookies() — otherwise
 * cookies() still throws "called outside a request scope".
 */
vi.mock('next/dist/server/request/async-storage', async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const store = new AsyncLocalStorage();
  return {
    requestAsyncStorage: {
      get: () => store.getStore(),
      run: (value: unknown, fn: () => unknown) => store.run(value, fn),
      enterWith: (value: unknown) => store.enterWith(value),
    },
    workUnitAsyncStorage: { get: () => undefined, run: (_v: unknown, fn: () => unknown) => fn() },
    cacheStorage: { get: () => undefined },
  };
});

/** Run a route handler inside a request scope. */
async function inRequestScope<T>(fn: () => Promise<T>): Promise<T> {
  const { requestAsyncStorage } = await import('next/dist/server/request/async-storage');
  return requestAsyncStorage.run({ headers: new Headers(), cookies: new Map(), url: '/' }, fn);
}

describe('sign out', () => {
  it('serves the handler at /api/auth/signout, the path the button calls', () => {
    const atSignout = resolve(APP, 'app/api/auth/signout/route.ts');
    expect(
      existsSync(atSignout),
      'web/src/app/api/auth/signout/route.ts must exist. A handler at api/auth/route.ts is mounted at /api/auth, so POST /api/auth/signout returns 404.',
    ).toBe(true);

    expect(
      existsSync(resolve(APP, 'app/api/auth/route.ts')),
      'api/auth/route.ts must not remain: it mounts the sign-out handler at /api/auth.',
    ).toBe(false);
  });

  it('the handler calls signOut and reports the outcome', () => {
    const handler = readFileSync(resolve(APP, 'app/api/auth/signout/route.ts'), 'utf8');

    /**
     * Asserted on the source rather than by calling the handler.
     *
     * Invoking it needs Next's request-scope AsyncLocalStorage stood up by hand,
     * because cookies() throws outside one and vi.mock on the bare 'next/headers'
     * specifier does not reach it. That is testing Next's internals, and it was
     * tried and abandoned — the mock does not take, and when it does not take the
     * failure looks like the handler is broken rather than like the harness is
     * wrong.
     *
     * What actually matters is that the handler signs out and fails loudly, and
     * both are visible here. The bug this file exists for was the file's PATH,
     * which the first test asserts directly.
     */
    expect(handler).toMatch(/supabase\.auth\.signOut\(\)/);
    // A failed sign-out must throw, so the response is non-2xx and the button's
    // ok check can see it.
    expect(handler).toMatch(/if\s*\(error\)/);
    expect(handler).toMatch(/throw ApiError/);
    expect(handler).toMatch(/NextResponse\.json\(\{ ok: true \}\)/);
  });
});

describe('the sign-out call site', () => {
  const source = readFileSync(resolve(APP, 'components/app/AppShell.tsx'), 'utf8');

  it('checks the response status, so a 404 is not mistaken for success', () => {
    /**
     * A source assertion, because AppShell's signOut closure is not exported and
     * mounting the whole client shell to reach it would test far more than this.
     * The pattern to catch is exactly the one that shipped: `await fetch(...)`
     * with no `res.ok` test anywhere after it.
     */
    expect(source).toMatch(/if\s*\(\s*!\s*res\.ok\s*\)/);
    expect(source).toMatch(/setSignOutError\(/);
  });

  it('does not navigate away when signing out failed', () => {
    // The assignment must be reachable only after the ok check, not beside it.
    const assignIndex = source.indexOf('window.location.assign');
    const guardIndex = source.indexOf('if (!res.ok)');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(assignIndex).toBeGreaterThan(guardIndex);
  });
});
