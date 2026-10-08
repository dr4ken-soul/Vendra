import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Cache Components is intentionally OFF.
   *
   * Every authenticated Vendra route reads the session cookie and derives shop
   * scope on the server, so those routes are dynamic by nature. With Cache
   * Components enabled each of them would additionally need an explicit
   * Suspense boundary around the cookie read, which adds complexity without
   * changing the caching outcome: nothing tenant-scoped is ever prerendered.
   *
   * The marketing pages are static and are prerendered as usual.
   */
  cacheComponents: false,

  /**
   * Server-only dependencies.
   *
   * These must stay outside the bundler so their Node-only crypto and Sui code
   * is never pulled into a client build. This is a correctness guarantee, not
   * only a bundle-size one.
   */
  serverExternalPackages: [
    '@mysten-incubation/memwal',
    '@mysten/sui',
    '@mysten/keypairs.js',
    '@mysten/bcs',
    '@mysten/seal',
  ],

  poweredByHeader: false,

  /**
   * The app lives in web/ inside a repository whose root is one level up.
   * Without this, Next refuses to use the lockfile and trace files outside the
   * project directory.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, '..'),

  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            // The landing background video needs no camera, microphone or
            // geolocation. Denying them keeps the surface minimal.
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        // Evidence and the approved background video are private-scoped.
        source: '/video/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;