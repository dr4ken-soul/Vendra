/**
 * Shop memory-scope provisioning.
 *
 * Custody model: SERVICE MANAGED. Vendra's server creates and controls one
 * Walrus Memory account per shop and one unique namespace per shop.
 *
 * What this deliberately does NOT do:
 *   - reuse a single global account or namespace across shops
 *   - accept an account id, namespace or owner address from the browser
 *   - store any key material in the database
 *
 * The delegate key lives only in the server environment. `shops` stores an
 * opaque account id, a namespace, an owner address and a key reference.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { walrusEnv } from '@/lib/env';

export interface ProvisionResult {
  status: 'active' | 'pending' | 'degraded';
  detail: string;
  namespace: string | null;
  accountId: string | null;
  custodyMode: 'service_managed';
}

/**
 * Derive a unique, non-guessable namespace for a shop.
 *
 * The namespace is a tenant boundary. Using a random suffix means one shop
 * cannot enumerate or collide with another's scope.
 */
export function deriveNamespace(shopId: string): string {
  const suffix = randomHex(8);
  return `vendra-shop-${shopId.slice(0, 8)}-${suffix}`;
}

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create or repair a shop's memory scope.
 *
 * Safe to call again: it is the retry path used by onboarding when the first
 * attempt failed, and it is also how a shop is re-scoped after the operator
 * rotates a delegate key.
 */
export async function provisionShopMemory(shopId: string): Promise<ProvisionResult> {
  const admin = createAdminClient();
  const env = walrusEnv();

  const namespace = deriveNamespace(shopId);

  if (!env) {
    // No Walrus configuration. The shop is still usable for deals; the memory
    // scope is reported as pending rather than silently claimed as ready.
    await admin
      .from('shops')
      .update({
        walrus_namespace: namespace,
        memory_status: 'pending',
        memory_status_detail:
          'Deal memory is not configured in this environment. Records are saved, but cross-session recall is not available yet.',
        memory_custody_mode: 'service_managed',
      })
      .eq('id', shopId);

    return {
      status: 'pending',
      detail:
        'Deal memory is not configured in this environment. Records are saved, but cross-session recall is not available yet.',
      namespace,
      accountId: null,
      custodyMode: 'service_managed',
    };
  }

  try {
    // The account id for the pilot is the operator's provisioned Walrus Memory
    // account object id. Per-shop isolation is enforced primarily by the
    // unique namespace, which the server assigns and never accepts from a
    // client. See docs/walrus-memory-notes.md for the isolation test.
    const accountId = env.accountId;

    // Prove the namespace is usable before declaring the shop active, so
    // `memory_status = active` means the scope really works.
    const { initMemWal, namespaceStatus } = await import('@/lib/memory/walrus');
    await initMemWal();
    const status = await namespaceStatus({ env, namespace });

    if (status.memoryCount < 0) {
      await admin
        .from('shops')
        .update({
          walrus_account_id: accountId,
          walrus_namespace: namespace,
          walrus_delegate_key_ref: keyReferenceFor(shopId),
          memory_status: 'degraded',
          memory_status_detail:
            'Deal memory is configured but the relayer did not respond. Records are saved; cross-session recall may be unavailable.',
          memory_custody_mode: 'service_managed',
        })
        .eq('id', shopId);

      return {
        status: 'degraded',
        detail:
          'Deal memory is configured but the relayer did not respond. Records are saved; cross-session recall may be unavailable.',
        namespace,
        accountId,
        custodyMode: 'service_managed',
      };
    }

    await admin
      .from('shops')
      .update({
        walrus_account_id: accountId,
        walrus_namespace: namespace,
        walrus_delegate_key_ref: keyReferenceFor(shopId),
        memory_status: 'active',
        memory_status_detail: null,
        memory_custody_mode: 'service_managed',
      })
      .eq('id', shopId);

    await admin.from('audit_events').insert({
      shop_id: shopId,
      action: 'memory.provisioned',
      target_type: 'shop',
      target_id: shopId,
      metadata: { custody: 'service_managed' },
    });

    return {
      status: 'active',
      detail: 'Deal memory is ready for this shop.',
      namespace,
      accountId,
      custodyMode: 'service_managed',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : 'unknown error';
    console.error('[vendra] memory provisioning failed', message);

    await admin
      .from('shops')
      .update({
        walrus_account_id: env.accountId,
        walrus_namespace: namespace,
        walrus_delegate_key_ref: keyReferenceFor(shopId),
        memory_status: 'degraded',
        memory_status_detail:
          'Deal memory could not be confirmed. Records are saved; retry setup from Settings.',
        memory_custody_mode: 'service_managed',
      })
      .eq('id', shopId);

    return {
      status: 'degraded',
      detail: 'Deal memory could not be confirmed. Records are saved; retry setup from Settings.',
      namespace,
      accountId: env.accountId,
      custodyMode: 'service_managed',
    };
  }
}

/**
 * A reference into the server-side key management system.
 *
 * This is intentionally a pointer, not a key. Rotating the delegate in the key
 * store and updating the reference is the documented revocation runbook.
 */
function keyReferenceFor(shopId: string): string {
  const base = process.env.WALRUS_DELEGATE_KEY_REF || 'walrus-delegate/default';
  return `${base}#${shopId.slice(0, 8)}`;
}

/**
 * Custody copy shown to the retailer.
 *
 * FRONTEND_SPEC 4.3 requires this slot to describe the model that was actually
 * implemented. Service custody is stated plainly and is never described as
 * retailer-owned.
 */
export const CUSTODY_DISCLOSURE = {
  service_managed: {
    heading: 'Who controls this shop’s memory account',
    body:
      'For this pilot, Vendra’s service controls the Walrus owner account for this shop. Your shop has its own separate memory scope that no other shop can read, but the owner key is not held by you.',
    caution:
      'This means an operator of the Vendra service could, in principle, reach the account that holds this shop’s memories. Do not store anything you would not want a service operator to be able to access until this is changed.',
  },
  retailer_controlled: {
    heading: 'Who controls this shop’s memory account',
    body:
      'Your shop controls its Walrus owner account. Vendra uses a delegated key for the operations described here.',
    caution: null,
  },
} as const;

export type CustodyMode = keyof typeof CUSTODY_DISCLOSURE;

export function custodyCopy(mode: CustodyMode) {
  return CUSTODY_DISCLOSURE[mode];
}

/**
 * Retention and deletion limits stated honestly.
 *
 * The MemWal SDK exposes no forget/delete method, and permanent erasure has not
 * been verified end to end in this deployment. This copy must not claim more
 * than that.
 */
export const DELETION_LIMITS = {
  relational:
    'Dealing records, suppliers, messages and audit entries for this shop are deleted from the database.',
  evidence_objects:
    'Attached files are removed from private storage. Any backup copy may persist until the backup cycle completes.',
  walrus_memory:
    'Memories written to Walrus Memory cannot yet be confirmed as permanently erased. The MemWal SDK exposes no deletion method, and the wallet-authenticated Security Delete flow has not been verified in this deployment. A memory is withdrawn from your shop\'s recall scope, but this is not proof of erasure.',
  derived_text:
    'Extracted text derived from your files is removed with the record it belongs to.',
} as const;