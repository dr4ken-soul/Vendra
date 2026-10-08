/**
 * Runtime environment validation.
 *
 * A missing server secret must fail loudly at the boundary rather than
 * silently degrading a production flow. Nothing here ever invents a value,
 * and nothing secret is exported to the browser.
 */

export class MissingEnvError extends Error {
  readonly names: string[];

  constructor(names: string[]) {
    super(
      `Missing required environment variable${names.length > 1 ? 's' : ''}: ${names.join(', ')}. ` +
        `Copy .env.example to .env.local and fill in the values for this environment.`,
    );
    this.name = 'MissingEnvError';
    this.names = names;
  }
}

function requireEnv(names: string[]): string[] {
  const missing = names.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === '';
  });
  if (missing.length > 0) {
    throw new MissingEnvError(missing);
  }
  return names;
}

/** Browser-safe Supabase values. Exposed to the client bundle by design. */
export function publicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  };
}

export function hasPublicSupabaseEnv(): boolean {
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

/** Server-only Supabase credentials. Never returned to a client. */
export function serverSupabaseEnv() {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  };
}

/**
 * Model provider. Returns null when no key is configured so that the assistant
 * can degrade to timeline browsing with an honest "memory unavailable" state
 * rather than pretending recall succeeded.
 *
 * The pinned default is gemini-3.8-flash. Verified live on 8 October 2026:
 * gemini-2.5-flash and gemini-2.0-flash now return 404 "no longer available"
 * for new keys, so the previously planned default would have failed at runtime.
 */
export function modelEnv() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key || key.trim() === '') return null;
  return {
    apiKey: key,
    // Pinned after verifying the current Gemini model catalogue and pricing.
    modelId: process.env.GOOGLE_MODEL_ID || 'gemini-3.8-flash',
  };
}

/**
 * Walrus Memory configuration.
 *
 * Custody decision: service-managed, one owner account and one namespace per
 * shop. See WALRUS_ACCOUNT_CUSTODY.md and docs/walrus-memory-notes.md.
 *
 * Returns null when no delegate is configured. Callers must treat that as
 * "semantic recall unavailable" and must not claim a memory was stored.
 */
export function walrusEnv() {
  const accountId = process.env.WALRUS_MEMORY_ACCOUNT_ID;
  const readerCredential = process.env.WALRUS_READER_CREDENTIAL;
  const delegateKey = process.env.WALRUS_DELEGATE_PRIVATE_KEY;

  if (!accountId || !readerCredential || !delegateKey) {
    return null;
  }

  return {
    accountId,
    apiUrl: process.env.WALRUS_MEMORY_API_URL || undefined,
    relayerUrl: process.env.WALRUS_RELAYER_URL || undefined,
    readerCredential,
    delegateKey,
    network: process.env.WALRUS_NETWORK || 'testnet',
    // Owner signing is never performed in a browser request path.
    ownerSigningMode: process.env.WALRUS_OWNER_SIGNING_MODE || 'service_custodian',
  };
}

export type WalrusEnv = NonNullable<ReturnType<typeof walrusEnv>>;
export type ModelEnv = NonNullable<ReturnType<typeof modelEnv>>;