'use client';

import { useState } from 'react';
import {
  Button,
  ErrorMessage,
  Field,
  InfoMessage,
  Select,
  StatusBadge,
  SuccessMessage,
  TextInput,
} from './ui';

const CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP'];
const TIMEZONES = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Abidjan',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Africa/Johannesburg',
];

interface MemoryState {
  memoryStatus: string;
  memoryStatusDetail: string | null;
  custodyMode: string;
  walrusConfigured: boolean;
  namespaceReady: boolean;
  providerStoredCount: number;
  providerCountKnown: boolean;
}

/**
 * /app/settings (FRONTEND_SPEC 4.8)
 *
 * Groups: Shop details, Deal memory, Team access. Billing is deliberately
 * absent: it stays hidden until paid billing is explicitly enabled.
 *
 * The Deal memory panel renders the custody disclosure for the model that was
 * actually implemented and the real deletion limits.
 */
export function SettingsView({
  shopId,
  initialShop,
  memory,
  canManageSettings,
  canManageTeam,
  canErase,
  canExport,
  displayName,
  email,
  roleLabel,
}: {
  shopId: string;
  initialShop: { name: string; marketArea: string | null; currencyCode: string; timezone: string };
  memory: MemoryState;
  canManageSettings: boolean;
  canManageTeam: boolean;
  canErase: boolean;
  canExport: boolean;
  displayName: string | null;
  email: string | null;
  roleLabel: string;
}) {
  const [name, setName] = useState(initialShop.name);
  const [marketArea, setMarketArea] = useState(initialShop.marketArea ?? '');
  const [currency, setCurrency] = useState(initialShop.currencyCode);
  const [timezone, setTimezone] = useState(initialShop.timezone);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [retrying, setRetrying] = useState(false);
  const [memoryState, setMemoryState] = useState<MemoryState>(memory);

  const save = async () => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          name: name.trim(),
          marketArea: marketArea.trim() || null,
          currencyCode: currency,
          timezone,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'Those settings could not be saved.');
        setFieldErrors(payload?.error?.fields ?? {});
        return;
      }

      setMessage(payload.message ?? 'Shop settings saved.');
    } catch {
      setError('We could not reach Vendra. Your changes are still on screen — try again.');
    } finally {
      setBusy(false);
    }
  };

  const retryMemory = async () => {
    setRetrying(true);
    setError(null);

    try {
      const response = await fetch(`/api/shops/${shopId}/memory`, { method: 'POST' });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'Memory setup could not be completed.');
        return;
      }

      setMemoryState((previous) => ({
        ...previous,
        memoryStatus: payload.memoryStatus,
        memoryStatusDetail: payload.memoryStatusDetail,
        namespaceReady: payload.namespaceReady,
      }));
      setMessage('Deal memory setup retried.');
    } catch {
      setError('Memory setup could not be reached. Check your connection and try again.');
    } finally {
      setRetrying(false);
    }
  };

  const memoryReady = memoryState.memoryStatus === 'active';

  return (
    <div className="max-w-[900px]">
      <h1
        id="page-heading"
        tabIndex={-1}
        className="font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] focus:outline-none md:text-4xl"
      >
        Settings
      </h1>
      <p className="mt-2 max-w-[64ch] font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
        Shop details, deal memory and who can reach your records.
      </p>

      {message && (
        <div className="mt-5">
          <SuccessMessage>{message}</SuccessMessage>
        </div>
      )}
      {error && (
        <div className="mt-5">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {/* ACCOUNT */}
      <section className="mt-8 border-t border-[var(--border-default)] py-5">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Your account</h2>
        <p className="mt-1 max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          The details Vendra holds about you.
        </p>

        <div className="mt-4 flex flex-col">
          <ActionRow label="Name" value={displayName ?? 'Not set'} />
          <ActionRow label="Email address" value={email ?? 'Not available'} />
          <ActionRow
            label="Access in this shop"
            value={roleLabel}
            hint={
              roleLabel === 'Owner'
                ? 'You control team access, shop settings and deletion requests.'
                : roleLabel === 'Manager'
                  ? 'You can manage the team and settings, but cannot delete the shop.'
                  : 'You can record deals and use Ask Vendra.'
            }
          />
        </div>
      </section>

      {/* SHOP DETAILS */}
      <section className="border-t border-[var(--border-default)] py-5">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Shop details</h2>
        <p className="mt-1 max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          How this shop appears in your records and which currency deals use.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Shop name" htmlFor="settingsName" required error={fieldErrors.name}>
            <TextInput
              id="settingsName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManageSettings}
              error={fieldErrors.name}
            />
          </Field>

          <Field label="Market or area" htmlFor="settingsMarket" error={fieldErrors.marketArea}>
            <TextInput
              id="settingsMarket"
              value={marketArea}
              onChange={(e) => setMarketArea(e.target.value)}
              disabled={!canManageSettings}
              error={fieldErrors.marketArea}
            />
          </Field>

          <Field label="Currency" htmlFor="settingsCurrency" error={fieldErrors.currencyCode}>
            <Select
              id="settingsCurrency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={!canManageSettings}
              error={fieldErrors.currencyCode}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Timezone" htmlFor="settingsTimezone" error={fieldErrors.timezone}>
            <Select
              id="settingsTimezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!canManageSettings}
              error={fieldErrors.timezone}
            >
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {canManageSettings ? (
          <div className="mt-5">
            <Button type="button" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save shop details'}
            </Button>
          </div>
        ) : (
          <p className="mt-4 font-body text-xs leading-relaxed text-[var(--text-muted)]">
            Only an owner or manager can change shop settings.
          </p>
        )}
      </section>

      {/* DEAL MEMORY */}
      <section className="border-t border-[var(--border-default)] py-5">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Deal memory</h2>
        <p className="mt-1 max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Deal memory is what lets you ask about a past deal in a later session.
        </p>

        <div className="mt-4 flex flex-col">
          <ActionRow
            label="Memory setup"
            value={
              memoryState.memoryStatus === 'active'
                ? 'Ready'
                : memoryState.memoryStatus === 'degraded'
                  ? 'Needs attention'
                  : 'Setting up'
            }
            hint={memoryState.memoryStatusDetail ?? 'Confirmed deal facts are being added to your shop’s memory.'}
            badge={
              <StatusBadge
                tone={
                  memoryState.memoryStatus === 'active'
                    ? 'success'
                    : memoryState.memoryStatus === 'degraded'
                      ? 'warning'
                      : 'info'
                }
              >
                {memoryState.memoryStatus === 'active'
                  ? 'Active'
                  : memoryState.memoryStatus === 'degraded'
                    ? 'Degraded'
                    : memoryState.memoryStatus === 'revoked'
                      ? 'Revoked'
                      : 'Pending'}
              </StatusBadge>
            }
          />

          <ActionRow
            label="Memories stored"
            value={
              memoryState.providerCountKnown
                ? `${memoryState.providerStoredCount} in your shop's memory scope`
                : 'Cannot be confirmed in this environment'
            }
            hint={
              memoryState.providerCountKnown
                ? 'Reported by the memory service for your shop only.'
                : 'Vendra will not guess a count. This number comes from the memory service.'
            }
          />

          {canManageSettings && !memoryReady && (
            <div className="mt-4">
              <Button variant="secondary" type="button" onClick={() => void retryMemory()} disabled={retrying}>
                {retrying ? 'Retrying setup…' : 'Retry memory setup'}
              </Button>
            </div>
          )}
        </div>

        {/* Custody disclosure — matches the implemented model exactly. */}
        <div className="mt-6 rounded-xl border border-[var(--border-default)] bg-[var(--surface-wash)] p-4">
          <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
            Who controls this shop’s memory account
          </h3>
          {memoryState.custodyMode === 'retailer_controlled' ? (
            <>
              <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                Your shop controls its Walrus owner account. Vendra uses a delegated key for the operations
                described here.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                For this pilot, Vendra’s service controls the Walrus owner account for this shop. Your shop has
                its own separate memory scope that no other shop can read, but the owner key is not held by you.
              </p>
              <div className="mt-3">
                <InfoMessage>
                  An operator of the Vendra service could, in principle, reach the account holding this shop’s
                  memories. Please do not store anything you would not want a service operator to be able to
                  access until this changes.
                </InfoMessage>
              </div>
            </>
          )}
        </div>

        {/* Deletion limits, stated honestly. */}
        <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">Deletion and retention</h3>
          <ul className="mt-2 flex flex-col gap-2">
            <LimitRow label="Records, messages and audit entries" value="Can be deleted from the database." />
            <LimitRow
              label="Attached files"
              value="Removed from private storage. A backup copy may persist until the backup cycle completes."
            />
            <LimitRow
              label="Memories"
              value="Not erasable by us. Walrus Security Delete is signed by the account that owns the blob, and Vendra holds a delegate key rather than the owner key, so we cannot sign it. This was checked, not assumed. A deletion request switches memory off and records that layer as blocked."
              tone="warning"
            />
          </ul>
          <p className="mt-3 font-body text-xs leading-relaxed text-[var(--text-muted)]">
            Vendra will not tell you something has been permanently erased unless it has checked the stored data
            itself.
          </p>
        </div>
      </section>

      {/* TEAM ACCESS */}
      <section className="border-t border-[var(--border-default)] py-5">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Team access</h2>
        <p className="mt-1 max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Choose who can work with this shop’s supplier records.
        </p>
        <div className="mt-4">
          {canManageTeam ? (
            <a href="/app/team" className="font-body text-sm font-semibold text-[var(--accent)] hover:underline">
              Manage team
            </a>
          ) : (
            <a href="/app/team" className="font-body text-sm text-[var(--text-secondary)] hover:underline">
              View who is in this shop
            </a>
          )}
        </div>
      </section>

      {/* PRIVACY AND DATA */}
      <section className="border-t border-[var(--border-default)] py-5">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Privacy and data</h2>
        <p className="mt-1 max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Export your records or ask for this shop’s data to be deleted.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/app/settings/privacy"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-panel)] px-5 py-2.5 font-body text-sm font-semibold text-[var(--text-primary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]"
          >
            Privacy and data
          </a>
          {(canExport || canErase) && (
            <span className="inline-flex min-h-11 items-center font-body text-xs text-[var(--text-muted)]">
              {canErase
                ? 'You can export and request deletion.'
                : 'You can request an export. Deletion requires the shop owner.'}
            </span>
          )}
        </div>
      </section>

      {/* Billing deliberately absent until paid billing is enabled. */}
    </div>
  );
}

function ActionRow({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border-subtle)] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="font-body text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {hint && <p className="mt-1 max-w-[52ch] font-body text-xs leading-relaxed text-[var(--text-muted)]">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-body text-sm text-[var(--text-primary)]">{value}</span>
        {badge}
      </div>
    </div>
  );
}

function LimitRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warning' }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="font-body text-sm font-medium text-[var(--text-primary)]">{label}</span>
      <span
        className={`font-body text-xs leading-relaxed ${
          tone === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        {value}
      </span>
    </li>
  );
}