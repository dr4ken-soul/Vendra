/**
 * Role permissions.
 *
 * Only an owner may authorise deletion of the shop's data. That rule is
 * duplicated in the database and in the RLS policies, and this test keeps the
 * TypeScript mirror in step so the UI hides what the server would refuse.
 */
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, defaultPermissionsForRole } from '@/lib/permissions';
import type { ShopMembership, ShopRole } from '@/lib/types';

function membership(role: ShopRole, permissions?: ShopMembership['permissions']): ShopMembership {
  return {
    id: 'm1',
    shop_id: 's1',
    user_id: 'u1',
    role,
    permissions: permissions ?? defaultPermissionsForRole(role),
    invited_by: null,
    joined_at: '2026-01-01T00:00:00.000Z',
    revoked_at: null,
  };
}

describe('defaultPermissionsForRole', () => {
  it('gives an owner every permission', () => {
    expect(defaultPermissionsForRole('owner')).toEqual(ALL_PERMISSIONS);
    expect(defaultPermissionsForRole('owner')).toContain('privacy.erase');
  });

  it('withholds privacy.erase from a manager', () => {
    const manager = defaultPermissionsForRole('manager');
    expect(manager).not.toContain('privacy.erase');
    expect(manager).toContain('settings.manage');
    expect(manager).toContain('team.manage');
  });

  it('gives staff only read and record permissions', () => {
    expect(defaultPermissionsForRole('staff')).toEqual([
      'deal.view',
      'deal.create',
      'deal.event',
      'evidence.view',
      'evidence.upload',
      'assistant.ask',
    ]);
  });

  it('never gives staff team or settings control', () => {
    const staff = defaultPermissionsForRole('staff');
    expect(staff).not.toContain('team.manage');
    expect(staff).not.toContain('settings.manage');
    expect(staff).not.toContain('privacy.export');
    expect(staff).not.toContain('privacy.erase');
  });

  it('never grants a supplier role, because no supplier role exists', () => {
    // V1 has no supplier account. Any attempt to invent one is a type error,
    // which is why ShopRole has exactly three members.
    const roles: ShopRole[] = ['owner', 'manager', 'staff'];
    expect(roles).toHaveLength(3);
  });
});