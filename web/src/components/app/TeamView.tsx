'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  ErrorMessage,
  Field,
  InfoMessage,
  Select,
  StatusBadge,
  SuccessMessage,
  TextInput,
} from './ui';
import { PERMISSION_LABELS } from '@/lib/permissions';
import { formatDate } from '@/lib/format';

interface Member {
  id: string;
  userId: string;
  displayName: string;
  isYou: boolean;
  role: 'owner' | 'manager' | 'staff';
  roleLabel: string;
  permissions: string[];
  joinedAt: string;
}

const ROLE_EXPLAINER: Record<string, string> = {
  owner: 'Full access, including team management, shop settings and data deletion requests.',
  manager:
    'Can record deals, manage the team and change shop settings. Cannot authorise shop deletion.',
  staff:
    'Can view and record deals, attach files and use Ask Vendra. Cannot manage the team or settings.',
};

/**
 * /app/team (FRONTEND_SPEC 4.8)
 *
 * A supplier is never granted access through an invitation; V1 has no supplier
 * role. Revocation is a separated danger action behind a confirmation dialog.
 */
export function TeamView({
  initialMembers,
  shopId,
  canManage,
}: {
  initialMembers: Member[];
  shopId: string;
  canManage: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Member | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'staff'>('staff');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const invite = async () => {
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, email: email.trim(), role }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'That invitation could not be sent.');
        setFieldErrors(payload?.error?.fields ?? {});
        return;
      }

      setInviteOpen(false);
      setEmail('');
      setMessage(payload.message);
      window.location.reload();
    } catch {
      setError('We could not reach Vendra. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/team/${revokeTarget.id}`, {
        method: 'DELETE',
        headers: { 'x-vendra-shop': shopId },
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'That access could not be removed.');
        return;
      }

      setMembers((previous) => previous.filter((m) => m.id !== revokeTarget.id));
      setRevokeTarget(null);
      setMessage(`${revokeTarget.displayName} no longer has access to this shop.`);
    } catch {
      setError('We could not reach Vendra. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            id="page-heading"
            tabIndex={-1}
            className="font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] focus:outline-none md:text-4xl"
          >
            Team
          </h1>
          <p className="mt-2 max-w-[64ch] font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
            Choose who can work with this shop’s supplier records.
          </p>
        </div>

        {canManage && (
          <Button type="button" onClick={() => setInviteOpen(true)}>
            Invite a team member
          </Button>
        )}
      </div>

      {message && (
        <div className="mb-5">
          <SuccessMessage>{message}</SuccessMessage>
        </div>
      )}
      {error && !revokeTarget && !inviteOpen && (
        <div className="mb-5">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {members.length === 1 && (
        <div className="mb-5">
          <InfoMessage>You’re the only person in this shop. Invite a teammate when you’re ready.</InfoMessage>
        </div>
      )}

      {/* DESKTOP TABLE */}
      <div className="hidden border-t border-[var(--border-default)] sm:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">People with access to this shop</caption>
          <thead className="border-b border-[var(--border-default)] font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            <tr>
              <th scope="col" className="px-3 py-3 first:pl-0">Name</th>
              <th scope="col" className="px-3 py-3">Access</th>
              <th scope="col" className="px-3 py-3">Joined</th>
              <th scope="col" className="px-3 py-3">Status</th>
              {canManage && <th scope="col" className="px-3 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-[var(--border-subtle)]">
                <td className="px-3 py-4 align-middle first:pl-0">
                  <span className="font-body text-sm font-semibold text-[var(--text-primary)]">
                    {member.displayName}
                    {member.isYou && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        You
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-4 align-middle">
                  <StatusBadge tone={member.role === 'owner' ? 'accent' : member.role === 'manager' ? 'info' : 'neutral'}>
                    {member.roleLabel}
                  </StatusBadge>
                </td>
                <td className="px-3 py-4 align-middle font-mono text-[10px] tracking-[0.04em] text-[var(--text-muted)]">
                  {formatDate(member.joinedAt)}
                </td>
                <td className="px-3 py-4 align-middle font-body text-sm text-[var(--text-secondary)]">
                  Active
                </td>
                {canManage && (
                  <td className="px-3 py-4 text-right align-middle">
                    {member.role !== 'owner' && !member.isYou && (
                      <Button variant="danger" type="button" onClick={() => setRevokeTarget(member)}>
                        Remove access
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE */}
      <ul className="border-t border-[var(--border-default)] sm:hidden">
        {members.map((member) => (
          <li key={member.id} className="border-b border-[var(--border-subtle)] py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-body text-sm font-semibold text-[var(--text-primary)]">
                {member.displayName}
                {member.isYou && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    You
                  </span>
                )}
              </span>
              <StatusBadge tone={member.role === 'owner' ? 'accent' : member.role === 'manager' ? 'info' : 'neutral'}>
                {member.roleLabel}
              </StatusBadge>
            </div>
            <p className="mt-1 font-mono text-[10px] tracking-[0.04em] text-[var(--text-muted)]">
              Joined {formatDate(member.joinedAt)} · Active
            </p>
            {canManage && member.role !== 'owner' && !member.isYou && (
              <div className="mt-3">
                <Button variant="danger" type="button" onClick={() => setRevokeTarget(member)}>
                  Remove access
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* PERMISSION REFERENCE */}
      <section className="mt-10 border-t border-[var(--border-default)] pt-6">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          What each role can do
        </h2>
        <dl className="mt-4 flex flex-col">
          {(['owner', 'manager', 'staff'] as const).map((role) => (
            <div
              key={role}
              className="flex flex-col gap-1 border-b border-[var(--border-subtle)] py-3 sm:flex-row sm:items-start sm:gap-6"
            >
              <dt className="w-28 shrink-0">
                <StatusBadge tone={role === 'owner' ? 'accent' : role === 'manager' ? 'info' : 'neutral'}>
                  {role === 'owner' ? 'Owner' : role === 'manager' ? 'Manager' : 'Staff'}
                </StatusBadge>
              </dt>
              <dd className="font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                {ROLE_EXPLAINER[role]}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 font-body text-xs leading-relaxed text-[var(--text-muted)]">
          Vendra never grants supplier access. A supplier cannot be added to a shop in this version.
        </p>
      </section>

      {/* INVITE DIALOG */}
      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a team member"
        description="They need a Vendra account first. Suppliers cannot be invited."
        disableEscape={busy}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setInviteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void invite()} disabled={busy}>
              {busy ? 'Inviting…' : 'Send invitation'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Email address"
            htmlFor="inviteEmail"
            required
            error={fieldErrors.email}
            help="The person must already have a Vendra account with this email address."
          >
            <TextInput
              id="inviteEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              placeholder="them@yourshop.com"
            />
          </Field>

          <Field label="Role" htmlFor="inviteRole" required>
            <Select id="inviteRole" value={role} onChange={(e) => setRole(e.target.value as 'manager' | 'staff')}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </Select>
          </Field>

          <div className="rounded-lg bg-[var(--surface-wash)] p-3">
            <p className="font-body text-xs font-medium text-[var(--text-primary)]">
              {role === 'manager' ? 'Manager' : 'Staff'} will be able to:
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {permissionsFor(role).map((permission) => (
                <li
                  key={permission}
                  className="font-body text-xs leading-relaxed text-[var(--text-secondary)]"
                >
                  {PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS]}
                </li>
              ))}
            </ul>
          </div>

          {error && <ErrorMessage>{error}</ErrorMessage>}
        </div>
      </Dialog>

      {/* REVOKE CONFIRMATION */}
      <Dialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Remove access to this shop?"
        description={
          revokeTarget
            ? `${revokeTarget.displayName} will immediately lose access to every deal, record and file in this shop. The change is recorded in the audit log.`
            : undefined
        }
        disableEscape={busy}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setRevokeTarget(null)} disabled={busy}>
              Keep access
            </Button>
            <Button variant="danger" type="button" onClick={() => void revoke()} disabled={busy}>
              {busy ? 'Removing…' : 'Remove access'}
            </Button>
          </>
        }
      >
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </Dialog>
    </>
  );
}

function permissionsFor(role: 'manager' | 'staff'): string[] {
  const all = [
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
  ];
  if (role === 'manager') return all;
  return ['deal.view', 'deal.create', 'deal.event', 'evidence.view', 'evidence.upload', 'assistant.ask'];
}