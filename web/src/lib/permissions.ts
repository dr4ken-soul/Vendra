/**
 * Permission defaults, mirroring `default_permissions_for_role` in
 * supabase/migrations/20261007000001_foundation.sql.
 *
 * This exists so the server can seed a membership with the same permissions the
 * database would assign. The database function remains the source of truth for
 * the row default; this list must be kept in step with it.
 */

import type { ShopPermission, ShopRole } from '@/lib/types';

export const ALL_PERMISSIONS: ShopPermission[] = [
  'deal.view',
  'deal.create',
  'deal.edit',
  'deal.event',
  'evidence.view',
  'evidence.upload',
  'supplier.manage',
  'assistant.ask',
  'memory.retry',
  'team.view',
  'team.manage',
  'settings.manage',
  'privacy.export',
  'privacy.erase',
];

export function defaultPermissionsForRole(role: ShopRole): ShopPermission[] {
  switch (role) {
    case 'owner':
      return [...ALL_PERMISSIONS];
    case 'manager':
      // Everything operational, but NOT privacy.erase. Only an owner may
      // authorise deletion of the shop's data.
      return ALL_PERMISSIONS.filter((p) => p !== 'privacy.erase');
    case 'staff':
      return ['deal.view', 'deal.create', 'deal.event', 'evidence.view', 'evidence.upload', 'assistant.ask'];
  }
}

export const PERMISSION_LABELS: Record<ShopPermission, string> = {
  'deal.view': 'View deals',
  'deal.create': 'Create deals',
  'deal.edit': 'Edit deals',
  'deal.event': 'Record delivery, issues and resolutions',
  'evidence.view': 'View attached files',
  'evidence.upload': 'Attach files',
  'supplier.manage': 'Add and edit suppliers',
  'assistant.ask': 'Use Ask Vendra',
  'memory.retry': 'Retry deal memory',
  'team.view': 'See who is in the shop',
  'team.manage': 'Invite and remove people',
  'settings.manage': 'Change shop settings',
  'privacy.export': 'Request a data export',
  'privacy.erase': 'Request shop deletion',
};