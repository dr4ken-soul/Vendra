'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, ErrorMessage, Field, InfoMessage, Select, StatusBadge, TextInput } from '@/components/app/ui';

const CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP'];
const TIMEZONES = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Abidjan',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Africa/Johannesburg',
];

/**
 * /onboarding (FRONTEND_SPEC 4.4)
 *
 * Two steps: `1. Your shop`, `2. Deal memory`.
 *
 * Step 2 renders the ACTUAL custody disclosure for the implemented model and the
 * real memory status. It never implies the retailer holds a key they do not
 * hold, and it never asks for a seed phrase.
 */
export function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [step, setStep] = useState<1 | 2>(1);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');

  const [name, setName] = useState('');
  const [marketArea, setMarketArea] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [timezone, setTimezone] = useState('Africa/Lagos');

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [memoryStatus, setMemoryStatus] = useState<string>('pending');
  const [memoryDetail, setMemoryDetail] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) nameRef.current?.focus();
  }, [error]);

  const createShop = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (name.trim().length < 2) {
      setFieldErrors({ name: 'Shop name must be at least 2 characters.' });
      nameRef.current?.focus();
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), marketArea: marketArea.trim() || null, currencyCode: currency, timezone }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'We could not create your shop just now. Try again.');
        setFieldErrors(payload?.error?.fields ?? {});
        return;
      }

      setShopId(payload.shop.id);
      setShopName(payload.shop.name);
      setMemoryStatus(payload.shop.memoryStatus ?? 'pending');
      setMemoryDetail(payload.shop.memoryStatusDetail ?? null);
      setStep(2);
    } catch {
      setError('We could not reach Vendra. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const retrySetup = async () => {
    if (!shopId) return;
    setRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/shops/${shopId}/memory`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? 'Memory setup could not be completed.');
        return;
      }
      setMemoryStatus(payload.memoryStatus ?? 'pending');
      setMemoryDetail(payload.memoryStatusDetail ?? null);
    } catch {
      setError('Memory setup could not be reached. Check your connection and try again.');
    } finally {
      setRetrying(false);
    }
  };

  const finish = () => {
    router.push(returnTo && returnTo.startsWith('/') ? returnTo : '/app');
    router.refresh();
  };

  const steps = ['Your shop', 'Deal memory'];
  const memoryReady = memoryStatus === 'active';

  return (
    <main className="min-h-dvh bg-[var(--bg-primary)] px-4 py-10">
      <div className="mx-auto w-full max-w-[720px]">
        <p className="mb-6 text-center font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
          Vendra
        </p>

        {/* Progress: 1. Your shop / 2. Deal memory */}
        <ol className="mb-7 grid grid-cols-2 gap-2" aria-label={`Step ${step} of 2: ${steps[step - 1]}`}>
          {steps.map((label, index) => {
            const position = index + 1;
            const state = position === step ? 'current' : position < step ? 'done' : 'todo';
            return (
              <li
                key={label}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`border-t-2 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] ${
                  state === 'current'
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : state === 'done'
                      ? 'border-[var(--success)] text-[var(--success)]'
                      : 'border-[var(--border-default)] text-[var(--text-muted)]'
                }`}
              >
                <span className="md:hidden">
                  Step {position} of 2 · {label}
                </span>
                <span className="hidden md:inline">
                  {position}. {label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-sm)] md:p-8">
          {step === 1 ? (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Set up your shop
              </h1>
              <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                This is your private workspace. Suppliers and other shops cannot see anything you record here.
              </p>

              <form onSubmit={createShop} className="mt-6 flex flex-col gap-4" noValidate>
                <Field label="Shop name" htmlFor="shopName" required error={fieldErrors.name}>
                  <TextInput
                    id="shopName"
                    ref={nameRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="organization"
                    placeholder="e.g. Amina Provisions"
                    error={fieldErrors.name}
                  />
                </Field>

                <Field
                  label="Market or area"
                  htmlFor="marketArea"
                  error={fieldErrors.marketArea}
                  help="Optional. Helps you keep several shops apart."
                >
                  <TextInput
                    id="marketArea"
                    value={marketArea}
                    onChange={(e) => setMarketArea(e.target.value)}
                    placeholder="e.g. Warri market"
                    error={fieldErrors.marketArea}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Currency" htmlFor="currency" error={fieldErrors.currencyCode}>
                    <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} error={fieldErrors.currencyCode}>
                      {CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Timezone" htmlFor="timezone" error={fieldErrors.timezone}>
                    <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} error={fieldErrors.timezone}>
                      {TIMEZONES.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {error && <ErrorMessage>{error}</ErrorMessage>}

                <div className="mt-2 flex justify-end">
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating your shop…' : 'Continue'}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Set up deal memory
              </h1>
              <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                {shopName} now has its own deal history and its own separate memory scope. No other shop can read
                it.
              </p>

              <div className="mt-6 flex flex-col gap-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-wash)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Memory setup</h2>
                    <StatusBadge tone={memoryStatus === 'active' ? 'success' : memoryStatus === 'degraded' ? 'warning' : 'info'}>
                      {memoryStatus === 'active' ? 'Ready' : memoryStatus === 'degraded' ? 'Needs attention' : 'Setting up'}
                    </StatusBadge>
                  </div>

                  {memoryDetail && (
                    <p role="status" className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                      {memoryDetail}
                    </p>
                  )}
                </div>

                {/* Custody disclosure — service-managed, stated plainly. */}
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                  <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                    Who controls this shop’s memory account
                  </h2>
                  <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                    For this pilot, Vendra’s service controls the Walrus owner account for this shop. Your shop has
                    its own separate memory scope that no other shop can read, but the owner key is not held by
                    you.
                  </p>
                  <div className="mt-3">
                    <InfoMessage>
                      This means an operator of the Vendra service could, in principle, reach the account holding
                      this shop’s memories. Please do not store anything you would not want a service operator to be
                      able to access until this changes.
                    </InfoMessage>
                  </div>
                </div>

                <p className="font-body text-xs leading-relaxed text-[var(--text-muted)]">
                  Vendra never asks for a recovery phrase and never asks you to paste one anywhere. See the{' '}
                  <a href="/privacy" className="underline underline-offset-2 hover:text-[var(--accent)]">
                    privacy notice
                  </a>{' '}
                  for what is stored, who can see it and how to request deletion.
                </p>

                {error && <ErrorMessage>{error}</ErrorMessage>}

                <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="quiet"
                    onClick={retrySetup}
                    disabled={retrying || memoryReady}
                    type="button"
                  >
                    {retrying ? 'Retrying setup…' : 'Retry setup'}
                  </Button>
                  <Button onClick={finish} disabled={!memoryReady} type="button">
                    Finish setup
                  </Button>
                </div>

                {!memoryReady && (
                  <p className="font-body text-xs leading-relaxed text-[var(--text-muted)]">
                    Finish setup is available once deal memory is ready. You can still record deals in the
                    meantime — nothing is lost.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}