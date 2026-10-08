/**
 * Walrus Memory adapter.
 *
 * Custody decision (recorded in TECH_DECISIONS.md and
 * docs/walrus-memory-notes.md): SERVICE-MANAGED, one owner account and one
 * namespace per shop. The retailer does NOT hold the Walrus owner key, and the
 * UI says exactly that. A service-managed account is custodial even when each
 * shop has its own account, namespace and Vendra login.
 *
 * This is the only module that touches MemWal. It:
 *   - writes one concise, evidence-anchored fact per confirmed deal event
 *   - recalls memories scoped strictly to a single shop namespace
 *   - reports honest write status instead of claiming a save succeeded
 *
 * It never stores evidence images, signed URLs, contact details or transcripts.
 *
 * SDK contract verified against @mysten-incubation/memwal 0.1.8:
 *   MemWal.create({ key, accountId, serverUrl?, namespace? })
 *   memwal.remember(text, namespace?, { idempotencyKey? }) -> { job_id, status }
 *   memwal.getRememberStatus(jobId)
 *       -> { status: pending|running|uploaded|done|failed|not_found, blob_id?, error? }
 *   memwal.recall({ query, limit?, namespace?, maxDistance?, sort?, maxTokens? })
 *       -> { results: [{ blob_id, text, distance, created_at? }], total, meta? }
 *   memwal.listNamespaces({ cursor?, limit? }) -> { namespaces: [{ name, memory_count, ... }] }
 *
 * NOTE: the SDK exposes no forget/delete method. Clearing the application index
 * is NOT erasure. See docs/walrus-memory-notes.md for the Security Delete path.
 */

import { walrusEnv, type WalrusEnv } from '@/lib/env';

export type MemoryWriteStatus = 'queued' | 'ready' | 'failed' | 'skipped';

export interface MemoryWriteResult {
  status: MemoryWriteStatus;
  /** MemWal job identifier, when the relayer accepted the write. */
  jobId: string | null;
  blobId: string | null;
  /** Short, non-sensitive diagnostic code. Never memory content. */
  errorCode: string | null;
  detail: string;
}

export interface RecalledMemory {
  text: string;
  dealId: string | null;
  eventId: string | null;
  blobId: string | null;
  distance: number | null;
  createdAt: string | null;
}

export interface RecallResult {
  ok: boolean;
  memories: RecalledMemory[];
  unavailableReason: string | null;
}

export interface NamespaceStatus {
  name: string;
  memoryCount: number;
  exists: boolean;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// ---------------------------------------------------------------------------
// Memory statement composition
// ---------------------------------------------------------------------------

/**
 * Compose the memory statement for a confirmed deal event.
 *
 * Format follows DATA_API_CONTRACTS.md section 6: a short atomic statement
 * carrying a date, the event type, a shop-local supplier label and opaque
 * source identifiers. Deliberately excluded: contact details, file names, URLs,
 * bank details and conversation text.
 */
export function composeMemoryText(input: {
  occurredAt: string;
  eventType: string;
  summary: string;
  supplierLabel: string;
  dealId: string;
  eventId: string;
}): string {
  const date = input.occurredAt.slice(0, 10);
  return (
    `On ${date}, deal ${input.dealId} with ${normalise(input.supplierLabel)} ` +
    `recorded ${humanEventType(input.eventType)}: ${normalise(input.summary)}. ` +
    `Source event: ${input.eventId}.`
  );
}

function humanEventType(type: string): string {
  switch (type) {
    case 'quote_received':
      return 'a quote';
    case 'terms_agreed':
      return 'agreed terms';
    case 'delivery_checked':
      return 'a delivery check';
    case 'issue_opened':
      return 'an issue';
    case 'resolution_recorded':
      return 'a resolution';
    case 'correction':
      return 'a correction';
    case 'note_added':
      return 'a note';
    default:
      return type.replace(/_/g, ' ');
  }
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 400);
}

/**
 * Extract the opaque source identifiers from a recalled statement.
 * Returns nulls when the statement cannot be traced, in which case the caller
 * must discard it rather than use it to support an answer.
 */
export function parseMemorySource(text: string): {
  dealId: string | null;
  eventId: string | null;
} {
  const eventMatch = text.match(/Source event:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const dealMatch = text.match(/deal\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

  if (eventMatch && dealMatch) {
    return { dealId: dealMatch[1].toLowerCase(), eventId: eventMatch[1].toLowerCase() };
  }

  const uuids = text.match(UUID_RE);
  if (uuids && uuids.length >= 2) {
    return { dealId: uuids[0].toLowerCase(), eventId: uuids[1].toLowerCase() };
  }

  return { dealId: null, eventId: null };
}

// ---------------------------------------------------------------------------
// Client construction
// ---------------------------------------------------------------------------

/**
 * Build a namespace-isolated client for one shop.
 *
 * `accountId` is the shop's own Walrus Memory account object id and `namespace`
 * is the shop's unique namespace. Neither is ever taken from the browser: both
 * come from the `shops` row that the session's membership resolved.
 */
function buildClient(env: WalrusEnv, namespace: string) {
  // Imported lazily: the SDK pulls in Sui dependencies and must never be part
  // of a client bundle.
  const memwalModule = requireMemWal();
  return memwalModule.MemWal.create({
    key: env.delegateKey,
    accountId: env.accountId,
    serverUrl: env.apiUrl,
    namespace,
  });
}

/**
 * Synchronous require of an ESM module is not available, so the SDK is loaded
 * once via a module-scoped promise created by an async bootstrap. Callers all
 * await `loadMemWal()` before touching this.
 */
let memwalPromise: Promise<typeof import('@mysten-incubation/memwal')> | null = null;

function loadMemWal() {
  if (!memwalPromise) {
    memwalPromise = import('@mysten-incubation/memwal');
  }
  return memwalPromise;
}

let loadedModule: typeof import('@mysten-incubation/memwal') | null = null;
let loaded = false;

function requireMemWal(): typeof import('@mysten-incubation/memwal') {
  if (!loaded || !loadedModule) {
    throw new Error('MemWal was not loaded before use.');
  }
  return loadedModule;
}

/** Load and cache the SDK module. Call before any remember/recall. */
export async function initMemWal(): Promise<void> {
  if (loaded) return;
  loadedModule = await loadMemWal();
  loaded = true;
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

/**
 * Store one memory for a confirmed deal event.
 *
 * On any failure the caller persists the sync row as `failed` and shows
 * "Memory needs attention". It must never report the memory as saved.
 */
export async function remember(input: {
  env: WalrusEnv | null;
  namespace: string;
  text: string;
  /**
   * Stable idempotency key derived from the event and memory version, so a
   * retry collapses onto the original job instead of writing a duplicate.
   */
  idempotencyKey: string;
}): Promise<MemoryWriteResult> {
  if (!input.env) {
    return {
      status: 'skipped',
      jobId: null,
      blobId: null,
      errorCode: 'walrus_not_configured',
      detail:
        'Deal memory is not connected in this environment. The deal record is saved; the memory could not be written.',
    };
  }

  if (input.env.ownerSigningMode === 'external_owner') {
    return {
      status: 'skipped',
      jobId: null,
      blobId: null,
      errorCode: 'external_owner_signing',
      detail:
        'This shop\'s memory account requires the owner wallet to authorise writes, which has not happened yet.',
    };
  }

  try {
    await initMemWal();
    const client = buildClient(input.env, input.namespace);

    const accepted = await client.remember(input.text, input.namespace, {
      idempotencyKey: input.idempotencyKey,
    });

    return {
      status: 'queued',
      jobId: accepted.job_id ?? null,
      blobId: null,
      errorCode: null,
      detail: 'The memory job was accepted and is processing.',
    };
  } catch (error) {
    const code = classifyError(error);
    console.error('[vendra] walrus remember failed', code, safeMessage(error));
    return {
      status: 'failed',
      jobId: null,
      blobId: null,
      errorCode: code,
      detail: 'The deal was saved, but the memory could not be written. Retry from the deal record.',
    };
  }
}

export type JobState = 'queued' | 'processing' | 'ready' | 'failed' | 'unknown';

/** Resolve a MemWal job so a queued write can be promoted to `ready`. */
export async function checkJob(input: {
  env: WalrusEnv | null;
  namespace: string;
  jobId: string;
}): Promise<{ state: JobState; blobId: string | null; errorCode: string | null }> {
  if (!input.env) {
    return { state: 'unknown', blobId: null, errorCode: 'walrus_not_configured' };
  }

  try {
    await initMemWal();
    const client = buildClient(input.env, input.namespace);
    const status = await client.getRememberStatus(input.jobId);

    switch (status.status) {
      case 'done':
      case 'uploaded':
        return { state: 'ready', blobId: status.blob_id ?? null, errorCode: null };
      case 'pending':
      case 'running':
        return { state: 'processing', blobId: status.blob_id ?? null, errorCode: null };
      case 'failed':
        return { state: 'failed', blobId: null, errorCode: 'job_failed' };
      case 'not_found':
      default:
        return { state: 'unknown', blobId: null, errorCode: 'job_not_found' };
    }
  } catch (error) {
    console.error('[vendra] walrus job check failed', classifyError(error));
    return { state: 'unknown', blobId: null, errorCode: 'job_check_failed' };
  }
}

// ---------------------------------------------------------------------------
// Recall path
// ---------------------------------------------------------------------------

/**
 * Recall memories for ONE shop namespace only.
 *
 * On failure the caller must present the timeline and label semantic recall as
 * unavailable rather than falling back to an invented answer.
 */
export async function recall(input: {
  env: WalrusEnv | null;
  namespace: string;
  query: string;
  limit?: number;
  maxTokens?: number;
}): Promise<RecallResult> {
  if (!input.env) {
    return {
      ok: false,
      memories: [],
      unavailableReason:
        'Deal memory is not connected in this environment. You can still browse your saved deals.',
    };
  }

  try {
    await initMemWal();
    const client = buildClient(input.env, input.namespace);

    const result = await client.recall({
      query: input.query,
      namespace: input.namespace,
      limit: input.limit ?? 8,
      // Bound the payload so a large recall cannot blow the model context.
      maxTokens: input.maxTokens ?? 2000,
      sort: 'recent',
    });

    const memories: RecalledMemory[] = [];
    for (const hit of result.results ?? []) {
      if (typeof hit.text !== 'string' || hit.text.length === 0) continue;
      const { dealId, eventId } = parseMemorySource(hit.text);
      memories.push({
        text: hit.text,
        dealId,
        eventId,
        blobId: hit.blob_id ?? null,
        distance: typeof hit.distance === 'number' ? hit.distance : null,
        createdAt: hit.created_at ?? null,
      });
    }

    return { ok: true, memories, unavailableReason: null };
  } catch (error) {
    const code = classifyError(error);
    console.error('[vendra] walrus recall failed', code, safeMessage(error));
    return {
      ok: false,
      memories: [],
      unavailableReason:
        'Deal memory is temporarily unavailable. Your saved deals are still in the Deals list.',
    };
  }
}

// ---------------------------------------------------------------------------
// Namespace verification
// ---------------------------------------------------------------------------

/**
 * Report the memory count the relayer holds for a shop namespace.
 *
 * This is the honest, provider-reported measure used when reporting stored
 * memories. It is never synthesised from a local counter.
 */
export async function namespaceStatus(input: {
  env: WalrusEnv | null;
  namespace: string;
}): Promise<NamespaceStatus> {
  if (!input.env) {
    return { name: input.namespace, memoryCount: -1, exists: false };
  }

  try {
    await initMemWal();
    const client = buildClient(input.env, input.namespace);
    const result = await client.listNamespaces({ limit: 500 });

    const match = (result.namespaces ?? []).find((ns) => ns.name === input.namespace);

    return {
      name: input.namespace,
      memoryCount: match?.memory_count ?? 0,
      exists: Boolean(match),
    };
  } catch (error) {
    console.error('[vendra] walrus namespace check failed', classifyError(error));
    return { name: input.namespace, memoryCount: -1, exists: false };
  }
}

/** Probe whether the relayer is reachable and accepting writes. */
export async function health(env: WalrusEnv | null): Promise<{
  reachable: boolean;
  writeReady: boolean | null;
  relayerVersion: string | null;
}> {
  if (!env) return { reachable: false, writeReady: null, relayerVersion: null };

  try {
    await initMemWal();
    const client = buildClient(env, 'health-probe');
    const result = await client.health();
    return {
      reachable: true,
      writeReady: typeof result.write_ready === 'boolean' ? result.write_ready : null,
      relayerVersion: result.relayerVersion ?? null,
    };
  } catch (error) {
    console.error('[vendra] walrus health check failed', classifyError(error));
    return { reachable: false, writeReady: null, relayerVersion: null };
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function classifyError(error: unknown): string {
  const message = safeMessage(error).toLowerCase();
  if (message.includes('namespace')) return 'namespace_error';
  if (message.includes('signature') || message.includes('sign')) return 'signature_error';
  if (message.includes('insufficient') || message.includes('gas')) return 'insufficient_gas';
  if (message.includes('unauthorised') || message.includes('unauthorized') || message.includes('forbidden')) {
    return 'not_authorised';
  }
  if (message.includes('timeout') || message.includes('econn') || message.includes('fetch')) {
    return 'network_error';
  }
  if (message.includes('incompatible') || message.includes('compatibility')) return 'relayer_incompatible';
  return 'walrus_error';
}

/** Error text may contain identifiers but must never contain memory content. */
function safeMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  return String(error).slice(0, 200);
}

export { walrusEnv };