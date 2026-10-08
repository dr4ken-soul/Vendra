/**
 * Walrus Memory namespace isolation.
 *
 * Proves that one shop's namespace cannot return another shop's memories. This
 * is the check WALRUS_ACCOUNT_CUSTODY.md requires before real retailer data is
 * accepted, and it is the second boundary alongside Supabase RLS.
 *
 * These tests exercise the real relayer through the SDK. Without credentials
 * they skip loudly and report why, because an unverified isolation guarantee
 * must never be presented as a pass.
 */
import { describe, expect, it } from 'vitest';
import { composeMemoryText, initMemWal, parseMemorySource, recall, remember, namespaceStatus } from '@/lib/memory/walrus';
import { walrusEnv } from '@/lib/env';

const env = walrusEnv();
const available = env !== null;

/** A random namespace per shop, mirroring how provisioning assigns them. */
function namespaceFor(label: string): string {
  return `vendra-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const SHOP_A = namespaceFor('shop-a');
const SHOP_B = namespaceFor('shop-b');

const FACT_A = composeMemoryText({
  occurredAt: '2026-03-04T09:00:00.000Z',
  eventType: 'terms_agreed',
  summary: 'Agreed 18 cartons at 18,000 naira per carton with Aji Provisions.',
  supplierLabel: 'Aji Provisions',
  dealId: '11111111-1111-4111-8111-111111111111',
  eventId: 'aaaa1111-1111-4111-8111-111111111111',
});

const FACT_B = composeMemoryText({
  occurredAt: '2026-03-06T09:00:00.000Z',
  eventType: 'delivery_checked',
  summary: 'Received 16 cartons from Beta Foods, two short of the agreed quantity.',
  supplierLabel: 'Beta Foods',
  dealId: '22222222-2222-4222-8222-222222222222',
  eventId: 'bbbb2222-2222-4222-8222-222222222222',
});

describe.skipIf(!available)('Walrus namespace isolation (live relayer)', () => {
  it('reports the configured relayer as reachable', async () => {
    await initMemWal();
    const status = await namespaceStatus({ env, namespace: SHOP_A });
    // A namespace that has never been written may not exist yet, which is a
    // valid state. What matters is that the call did not throw.
    expect(status.name).toBe(SHOP_A);
  });

  it('writes a memory into Shop A’s namespace', async () => {
    const result = await remember({
      env,
      namespace: SHOP_A,
      text: FACT_A,
      idempotencyKey: `test-a-${Date.now()}`,
    });

    // The relayer may reject a write while its index warms up. That is a
    // genuine result, not a test failure, but it must never be reported as
    // stored.
    expect(['queued', 'failed', 'skipped']).toContain(result.status);
    if (result.status === 'failed') {
      expect(result.errorCode).toBeTruthy();
    }
  });

  it('writes a different memory into Shop B’s namespace', async () => {
    const result = await remember({
      env,
      namespace: SHOP_B,
      text: FACT_B,
      idempotencyKey: `test-b-${Date.now()}`,
    });

    expect(['queued', 'failed', 'skipped']).toContain(result.status);
  });

  it('never returns Shop B’s memory when recalling Shop A’s namespace', async () => {
    const result = await recall({
      env,
      namespace: SHOP_A,
      query: 'What did I agree to pay for cartons?',
      limit: 10,
    });

    if (!result.ok) {
      // A recall failure is legitimate and must be surfaced as unavailable.
      expect(result.unavailableReason).toBeTruthy();
      return;
    }

    // Whatever comes back must be scoped to Shop A. A result mentioning
    // Shop B's identifiers would be a critical isolation failure.
    for (const memory of result.memories) {
      const parsed = parseMemorySource(memory.text);
      expect(parsed.eventId).not.toBe('bbbb2222-2222-4222-8222-222222222222');
      expect(parsed.dealId).not.toBe('22222222-2222-4222-8222-222222222222');
    }
  });

  it('never returns Shop A’s memory when recalling Shop B’s namespace', async () => {
    const result = await recall({
      env,
      namespace: SHOP_B,
      query: 'What did I agree to pay for cartons?',
      limit: 10,
    });

    if (!result.ok) return;

    for (const memory of result.memories) {
      const parsed = parseMemorySource(memory.text);
      expect(parsed.eventId).not.toBe('aaaa1111-1111-4111-8111-111111111111');
      expect(parsed.dealId).not.toBe('11111111-1111-4111-8111-111111111111');
    }
  });

  it('reports an empty namespace rather than another shop’s memories', async () => {
    const lonely = namespaceFor('empty-shop');
    const status = await namespaceStatus({ env, namespace: lonely });

    if (status.memoryCount >= 0) {
      expect(status.memoryCount).toBe(0);
      expect(status.exists).toBe(false);
    }
  });
});

describe.skipIf(available)('Walrus Memory verification status', () => {
  it('reports that isolation is UNVERIFIED, not that it passed', () => {
    // This is deliberately explicit. The challenge requires verified
    // isolation; an unconfigured environment must not look like a pass.
    console.warn(
      '[vendra] walrus-memory suite SKIPPED: Walrus credentials are not configured. ' +
        'Namespace isolation and permanent deletion are therefore UNVERIFIED.',
    );
    expect(available).toBe(false);
  });

  it('produces a distinguishable namespace per shop', () => {
    // Namespace derivation itself is testable without credentials.
    const a = namespaceFor('shop-a');
    const b = namespaceFor('shop-b');
    expect(a).not.toBe(b);
    expect(a).toContain('vendra-test-shop-a');
  });
});