'use client';

import { useState } from 'react';
import type { SupplierSummary } from '@/lib/data/queries';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorMessage,
  Field,
  PageHeader,
  StatusBadge,
  SuccessMessage,
  TextInput,
  Textarea,
} from './ui';
import { formatDate } from '@/lib/format';

/**
 * /app/suppliers (FRONTEND_SPEC 4.7)
 *
 * Summaries are computed from this shop's own canonical events. There is no
 * supplier rating, score or cross-shop comparison, by design.
 */
export function SuppliersView({
  initialSuppliers,
  shopId,
  canManage,
}: {
  initialSuppliers: SupplierSummary[];
  shopId: string;
  canManage: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const addSupplier = async () => {
    if (name.trim().length === 0) {
      setFieldErrors({ displayName: 'Enter a supplier name.' });
      return;
    }

    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          displayName: name.trim(),
          phone: phone.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'That supplier could not be added.');
        setFieldErrors(payload?.error?.fields ?? {});
        return;
      }

      setDialogOpen(false);
      setName('');
      setPhone('');
      setNotes('');
      setMessage(`${payload.supplier.display_name} added.`);
      window.location.reload();
    } catch {
      setError('We could not reach Vendra. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        headingId="page-heading"
        title="Suppliers"
        description="Supplier details stay within this shop."
        actions={
          canManage ? (
            <Button type="button" onClick={() => setDialogOpen(true)}>
              Add supplier
            </Button>
          ) : undefined
        }
      />

      {message && (
        <div className="mb-5">
          <SuccessMessage>{message}</SuccessMessage>
        </div>
      )}

      {initialSuppliers.length === 0 ? (
        <EmptyState
          title="No suppliers added yet"
          body="Add the supplier from a recent quote or start a new deal."
          action={
            canManage ? (
              <Button type="button" onClick={() => setDialogOpen(true)}>
                Add supplier
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="hidden border-t border-[var(--border-default)] sm:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Suppliers in this shop</caption>
              <thead className="border-b border-[var(--border-default)] font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                <tr>
                  <th scope="col" className="px-3 py-3 first:pl-0">Supplier</th>
                  <th scope="col" className="px-3 py-3">Last deal</th>
                  <th scope="col" className="px-3 py-3">Latest saved terms</th>
                  <th scope="col" className="px-3 py-3">Open issue</th>
                </tr>
              </thead>
              <tbody>
                {initialSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-[var(--border-subtle)] transition-colors duration-[120ms] hover:bg-[var(--surface-wash)]"
                  >
                    <td className="px-3 py-4 align-middle first:pl-0">
                      <p className="font-body text-sm font-semibold text-[var(--text-primary)]">
                        {supplier.displayName}
                      </p>
                      {supplier.phone && (
                        <p className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">{supplier.phone}</p>
                      )}
                    </td>

                    <td className="px-3 py-4 align-middle">
                      {supplier.lastDealId ? (
                        <a
                          href={`/app/deals/${supplier.lastDealId}`}
                          className="font-body text-sm text-[var(--accent)] hover:underline"
                        >
                          {formatDate(supplier.lastDealAt)}
                        </a>
                      ) : (
                        <span className="font-body text-sm text-[var(--text-muted)]">No deals yet</span>
                      )}
                    </td>

                    <td className="px-3 py-4 align-middle">
                      {supplier.latestTerms ? (
                        <a
                          href={`/app/deals/${supplier.latestTermsDealId}`}
                          className="block max-w-[46ch] font-body text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]"
                        >
                          {supplier.latestTerms}
                        </a>
                      ) : (
                        <span className="font-body text-sm text-[var(--text-muted)]">
                          No agreed terms recorded
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-4 align-middle">
                      {supplier.openIssueCount > 0 ? (
                        <a href={`/app/deals/${supplier.openIssueDealId}`}>
                          <StatusBadge tone="error">
                            {supplier.openIssueCount} open
                          </StatusBadge>
                        </a>
                      ) : (
                        <span className="font-body text-sm text-[var(--text-muted)]">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE STACKED */}
          <ul className="border-t border-[var(--border-default)] sm:hidden">
            {initialSuppliers.map((supplier) => (
              <li key={supplier.id} className="border-b border-[var(--border-subtle)] py-4">
                <p className="font-body text-sm font-semibold text-[var(--text-primary)]">{supplier.displayName}</p>
                {supplier.phone && (
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">{supplier.phone}</p>
                )}

                <dl className="mt-2 grid grid-cols-[8rem_minmax(0,1fr)] gap-y-1 font-body text-xs">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">Last deal</dt>
                  <dd>
                    {supplier.lastDealId ? (
                      <a href={`/app/deals/${supplier.lastDealId}`} className="text-[var(--accent)] hover:underline">
                        {formatDate(supplier.lastDealAt)}
                      </a>
                    ) : (
                      <span className="text-[var(--text-muted)]">No deals yet</span>
                    )}
                  </dd>

                  <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">Open issue</dt>
                  <dd>
                    {supplier.openIssueCount > 0 ? (
                      <a href={`/app/deals/${supplier.openIssueDealId}`}>
                        <StatusBadge tone="error">{supplier.openIssueCount} open</StatusBadge>
                      </a>
                    ) : (
                      <span className="text-[var(--text-muted)]">None</span>
                    )}
                  </dd>
                </dl>

                {supplier.latestTerms && (
                  <div className="mt-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
                      Latest saved terms
                    </p>
                    <a
                      href={`/app/deals/${supplier.latestTermsDealId}`}
                      className="font-body text-xs leading-relaxed text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    >
                      {supplier.latestTerms}
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add a supplier"
        description="Save only what you need to recognise this supplier in your own records."
        disableEscape={busy}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void addSupplier()} disabled={busy}>
              {busy ? 'Adding…' : 'Add supplier'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Supplier name" htmlFor="supplierName" required error={fieldErrors.displayName}>
            <TextInput
              id="supplierName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Okonkwo Wholesale"
              error={fieldErrors.displayName}
            />
          </Field>

          <Field label="Phone" htmlFor="supplierPhone" help="Optional.">
            <TextInput id="supplierPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>

          <Field label="Note" htmlFor="supplierNotes" help="Optional. For example the best day to order.">
            <Textarea id="supplierNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>

          {error && <ErrorMessage>{error}</ErrorMessage>}
        </div>
      </Dialog>
    </>
  );
}