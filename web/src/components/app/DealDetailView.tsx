'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DealDetail } from '@/lib/data/queries';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorMessage,
  Field,
  InfoMessage,
  MemoryStatus,
  Select,
  StatusBadge,
  SuccessMessage,
  TextInput,
  Textarea,
} from './ui';
import { DealStatusLabel, EventTypeLabel, dealStatusTone } from './dealStatus';
import { formatBytes, formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';

const ISSUE_TYPES = [
  { value: 'short_quantity', label: 'Short quantity' },
  { value: 'damaged', label: 'Damaged goods' },
  { value: 'wrong_item', label: 'Wrong item supplied' },
  { value: 'late_delivery', label: 'Late delivery' },
  { value: 'quality', label: 'Quality problem' },
  { value: 'overcharged', label: 'Charged more than agreed' },
  { value: 'other', label: 'Other' },
];

const CONDITIONS = [
  { value: 'as_agreed', label: 'As agreed' },
  { value: 'short', label: 'Short' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'other', label: 'Other' },
];

/**
 * /app/deals/:dealId (FRONTEND_SPEC 4.6)
 *
 * Timeline spans 7 columns, evidence 5, stacked on mobile. Events are
 * chronological and append-only: editing a past fact creates a correction and
 * keeps the original.
 */
export function DealDetailView({
  initialDetail,
  shopId,
  permissions,
  currencyCode,
  timezone,
  today,
}: {
  initialDetail: DealDetail;
  shopId: string;
  permissions: string[];
  /** Currency is taken from the shop record, never inferred from a locale. */
  currencyCode: string;
  timezone: string;
  today: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dialog, setDialog] = useState<'delivery' | 'issue' | 'resolution' | 'note' | 'draft' | 'evidence' | null>(null);
  /**
   * Incremented every time a dialog opens and used as the children's `key`.
   * Remounting on open is how each dialog's form state is reset, which avoids
   * resetting state from an effect.
   */
  const [dialogSeq, setDialogSeq] = useState(0);
  const [previewEvidence, setPreviewEvidence] = useState<{
    id: string;
    name: string;
    url: string;
    contentType: string;
  } | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const canRecord = permissions.includes('deal.event');
  const canAsk = permissions.includes('assistant.ask');
  const canUpload = permissions.includes('evidence.upload');

  const deal = detail.deal;
  const hasOpenIssue = deal.status === 'issue_open';

  /**
   * Server-rendered data is the baseline. Mutating operations (recording a
   * delivery, retrying a memory write) refresh it through `refresh()`, which
   * both updates local state and revalidates the route.
   */

  /** Opens a dialog and remounts it, so its form starts from a clean state. */
  const openDialog = (
    name: 'delivery' | 'issue' | 'resolution' | 'note' | 'draft' | 'evidence',
  ) => {
    setDialogSeq((n) => n + 1);
    setDialog(name);
  };

  const refresh = async () => {
    const response = await fetch(`/api/deals/${deal.id}?shop=${shopId}`);
    if (response.ok) {
      const payload = await response.json();
      setDetail(payload.deal as DealDetail);
    }
    router.refresh();
  };

  const postEvent = async (payload: Record<string, unknown>, successMessage: string) => {
    setBusy(true);
    setDialogError(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, shopId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setDialogError(result?.error?.message ?? 'That record could not be saved. Your entries are still here.');
        return false;
      }

      setDialog(null);
      setMessage(result.message ?? successMessage);
      setError(null);
      await refresh();
      return true;
    } catch {
      setDialogError('We could not reach Vendra. Your entries are still here — check your connection.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openEvidence = async (evidenceId: string) => {
    setEvidenceBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/evidence/${evidenceId}/url`, {
        method: 'POST',
        headers: { 'x-vendra-shop': shopId },
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? 'That file could not be opened.');
        return;
      }
      setPreviewEvidence({
        id: evidenceId,
        name: payload.fileName,
        url: payload.url,
        contentType: payload.contentType,
      });
    } catch {
      setError('That file could not be opened. Check your connection and try again.');
    } finally {
      setEvidenceBusy(false);
    }
  };

  const unlinkedEvidence = detail.evidence.filter((file) => !file.event_id);

  return (
    <>
      {/* HEADER */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Deals / {detail.supplier?.display_name ?? 'Supplier'}
          </p>
          <h1
            id="page-heading"
            tabIndex={-1}
            className="mt-1 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] focus:outline-none md:text-4xl"
          >
            {deal.headline || `${detail.lines.length} item(s) from ${detail.supplier?.display_name ?? 'supplier'}`}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-body text-sm text-[var(--text-secondary)]">
              {detail.supplier?.display_name ?? 'Unknown supplier'}
            </span>
            <span className="font-mono text-[10px] tracking-[0.04em] text-[var(--text-muted)]">
              {formatDate(deal.deal_date)}
            </span>
            <StatusBadge tone={dealStatusTone(deal.status)}>{DealStatusLabel(deal.status)}</StatusBadge>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {canAsk && (
            <Button variant="secondary" type="button" onClick={() => openDialog('draft')}>
              Draft a follow-up
            </Button>
          )}
          {canRecord && deal.status !== 'cancelled' && (
            <Button variant="secondary" type="button" onClick={() => openDialog('delivery')}>
              Record delivery
            </Button>
          )}
          {canRecord && deal.status !== 'cancelled' && (
            <Button
              type="button"
              onClick={() => openDialog('issue')}
              disabled={hasOpenIssue}
              title={hasOpenIssue ? 'An issue is already open on this deal.' : undefined}
            >
              Log an issue
            </Button>
          )}
          {canRecord && hasOpenIssue && (
            <Button type="button" onClick={() => openDialog('resolution')}>
              Record resolution
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className="mb-5">
          <SuccessMessage>{message}</SuccessMessage>
        </div>
      )}
      {error && (
        <div className="mb-5">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        {/* TIMELINE — 7 columns */}
        <section className="lg:col-span-7" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] md:text-2xl">
            Deal timeline
          </h2>

          {detail.events.length === 0 ? (
            <EmptyState
              title="Nothing recorded on this deal yet"
              body="Record the delivery when the goods arrive, and any issue or resolution as it happens."
            />
          ) : (
            <ol className="mt-4 border-l border-[var(--border-default)] pl-5">
              {detail.events.map((event) => (
                <li key={event.id} className="relative border-b border-[var(--border-subtle)] py-5">
                  <span
                    className={`absolute -left-[1.58rem] top-6 size-3 rounded-full border-2 border-[var(--bg-primary)] ${
                      event.event_type === 'issue_opened'
                        ? 'bg-[var(--error)]'
                        : event.event_type === 'resolution_recorded'
                          ? 'bg-[var(--success)]'
                          : 'bg-[var(--accent)]'
                    }`}
                    aria-hidden="true"
                  />

                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent)]">
                    {EventTypeLabel(event.event_type)}
                  </p>
                  <p className="mt-1 font-body text-sm leading-relaxed text-[var(--text-primary)]">{event.summary}</p>

                  <p className="mt-2 font-mono text-[10px] text-[var(--text-muted)]">
                    {event.occurred_at === event.recorded_at
                      ? formatDateTime(event.occurred_at, timezone)
                      : `Occurred ${formatDate(event.occurred_at, timezone)} · recorded ${formatDate(event.recorded_at, timezone)}`}
                  </p>

                  {(event.agreed_total ?? event.quoted_total ?? event.received_total) !== null && (
                    <p className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
                      {[
                        event.quoted_total !== null ? `Quoted ${formatMoney(event.quoted_total, currencyCode)}` : null,
                        event.agreed_total !== null ? `Agreed ${formatMoney(event.agreed_total, currencyCode)}` : null,
                        event.received_total !== null ? `Received value ${formatMoney(event.received_total, currencyCode)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}

                  {event.issue_type && (
                    <p className="mt-1 font-body text-xs text-[var(--text-secondary)]">
                      Issue type: {ISSUE_TYPES.find((t) => t.value === event.issue_type)?.label ?? event.issue_type}
                    </p>
                  )}

                  {event.resolution_outcome && (
                    <p className="mt-1 font-body text-xs text-[var(--text-secondary)]">
                      Outcome: {event.resolution_outcome}
                    </p>
                  )}

                  {event.superseded_at && (
                    <p className="mt-2">
                      <StatusBadge tone="neutral">Replaced by a correction</StatusBadge>
                    </p>
                  )}

                  {event.evidence.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1">
                      {event.evidence.map((file) => (
                        <li key={file.id}>
                          <button
                            type="button"
                            onClick={() => void openEvidence(file.id)}
                            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 font-body text-xs text-[var(--accent)] transition-colors duration-[120ms] hover:bg-[var(--accent-soft)]"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M7 2v7M4 6.5 7 9.5l3-3M2.5 11h9" />
                            </svg>
                            {file.original_filename}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}

          {canRecord && deal.status !== 'cancelled' && (
            <div className="mt-5">
              <Button variant="quiet" type="button" onClick={() => openDialog('note')}>
                Add a note
              </Button>
            </div>
          )}
        </section>

        {/* EVIDENCE / DETAILS — 5 columns */}
        <aside className="lg:col-span-5" aria-labelledby="details-heading">
          <section>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-default)] pt-5">
              <h2 id="details-heading" className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Evidence
              </h2>
              {canUpload && (
                <Button variant="quiet" type="button" onClick={() => openDialog('evidence')}>
                  Add evidence
                </Button>
              )}
            </div>

            {detail.evidence.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-wash)] px-4 py-6 text-center font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                No evidence attached to this deal yet.
              </p>
            ) : (
              <ul className="mt-2">
                {detail.evidence.map((file) => (
                  <li
                    key={file.id}
                    className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-3 font-body text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => void openEvidence(file.id)}
                      disabled={evidenceBusy}
                      className="min-w-0 flex-1 truncate text-left text-[var(--text-primary)] transition-colors duration-[120ms] hover:text-[var(--accent)] disabled:opacity-50"
                    >
                      {file.original_filename}
                    </button>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {formatBytes(file.byte_size)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {unlinkedEvidence.length > 0 && (
              <p className="mt-3 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                {unlinkedEvidence.length} file(s) are attached to this deal but not linked to a specific record
                yet.
              </p>
            )}
          </section>

          <section className="mt-8 border-t border-[var(--border-default)] pt-5">
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Items
            </h2>
            <ul className="mt-2">
              {detail.lines.map((line) => {
                const short =
                  line.agreed_quantity !== null &&
                  line.received_quantity !== null &&
                  Number(line.received_quantity) < Number(line.agreed_quantity);

                return (
                  <li key={line.id} className="border-b border-[var(--border-subtle)] py-3">
                    <p className="font-body text-sm font-semibold text-[var(--text-primary)]">
                      {line.product_label_snapshot}
                    </p>
                    <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-body text-xs text-[var(--text-secondary)]">
                      <dt>Agreed</dt>
                      <dd className="text-right">
                        {line.agreed_quantity !== null
                          ? formatQuantity(line.agreed_quantity, line.unit_label)
                          : formatQuantity(line.quoted_quantity, line.unit_label)}
                      </dd>
                      <dt>Price</dt>
                      <dd className="text-right">
                        {formatMoney(
                          line.agreed_unit_price ?? line.quoted_unit_price, currencyCode)}
                      </dd>
                      <dt>Received</dt>
                      <dd className={`text-right ${short ? 'font-semibold text-[var(--error)]' : ''}`}>
                        {line.received_quantity !== null
                          ? formatQuantity(line.received_quantity, line.unit_label)
                          : 'Not recorded'}
                      </dd>
                    </dl>
                    {short && (
                      <p className="mt-1 font-body text-xs font-semibold text-[var(--error)]">
                        Short of the agreed quantity
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-8 border-t border-[var(--border-default)] pt-5">
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Deal memory
            </h2>
            <p className="mt-1 font-body text-xs leading-relaxed text-[var(--text-muted)]">
              Each confirmed record on this deal is added to your shop’s deal memory so you can ask about it later.
            </p>

            {detail.memory.length === 0 ? (
              <p className="mt-3 font-body text-sm text-[var(--text-secondary)]">Nothing stored yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {detail.memory.map((row) => (
                  <li key={row.id} className="border-b border-[var(--border-subtle)] pb-3 last:border-0">
                    <MemoryStatus
                      status={row.status}
                      detail={
                        row.last_error_code
                          ? `Reason: ${row.last_error_code}. The deal record is safe; this can be retried from Settings.`
                          : row.memory_blob_id
                            ? `Stored as memory version ${row.memory_version}.`
                            : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canAsk && (
            <section className="mt-8 border-t border-[var(--border-default)] pt-5">
              <Button variant="secondary" type="button" onClick={() => router.push('/app/ask')}>
                Ask about this deal
              </Button>
            </section>
          )}
        </aside>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* DIALOGS                                                          */}
      {/* ---------------------------------------------------------------- */}

      {/* Each dialog is keyed on the open counter so its form state is fresh. */}
      <DeliveryDialog
        key={`delivery-${dialogSeq}`}
        open={dialog === 'delivery'}
        onClose={() => setDialog(null)}
        detail={detail}
        currencyCode={currencyCode}
        today={today}
        canUpload={canUpload}
        busy={busy}
        error={dialogError}
        onSubmit={postEvent}
        onAttach={openEvidence}
      />

      <IssueDialog
        key={`issue-${dialogSeq}`}
        open={dialog === 'issue'}
        onClose={() => setDialog(null)}
        busy={busy}
        error={dialogError}
        today={today}
        canUpload={canUpload}
        unlinkedEvidence={unlinkedEvidence}
        onSubmit={postEvent}
        onAttach={openEvidence}
      />

      <ResolutionDialog
        key={`resolution-${dialogSeq}`}
        open={dialog === 'resolution'}
        onClose={() => setDialog(null)}
        busy={busy}
        error={dialogError}
        today={today}
        canUpload={canUpload}
        unlinkedEvidence={unlinkedEvidence}
        onSubmit={postEvent}
        onAttach={openEvidence}
      />

      <NoteDialog
        key={`note-${dialogSeq}`}
        open={dialog === 'note'}
        onClose={() => setDialog(null)}
        busy={busy}
        error={dialogError}
        canUpload={canUpload}
        unlinkedEvidence={unlinkedEvidence}
        onSubmit={postEvent}
        onAttach={openEvidence}
      />

      <EvidenceUploadDialog
        key={`evidence-${dialogSeq}`}
        open={dialog === 'evidence'}
        onClose={() => setDialog(null)}
        shopId={shopId}
        dealId={deal.id}
        onComplete={refresh}
      />

      <DraftDialog
        key={`draft-${dialogSeq}`}
        open={dialog === 'draft'}
        onClose={() => setDialog(null)}
        detail={detail}
        currencyCode={currencyCode}
        timezone={timezone}
      />

      {/* EVIDENCE PREVIEW */}
      {previewEvidence && (
        <Dialog
          open
          onClose={() => setPreviewEvidence(null)}
          title={previewEvidence.name}
          description="This link works for five minutes and only for people in your shop."
          footer={
            <Button variant="secondary" type="button" onClick={() => setPreviewEvidence(null)}>
              Close
            </Button>
          }
        >
          {previewEvidence.contentType.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewEvidence.url}
              alt={previewEvidence.name}
              className="mx-auto max-h-[60vh] w-auto rounded-lg border border-[var(--border-subtle)]"
            />
          ) : (
            <div className="text-center">
              <p className="font-body text-sm text-[var(--text-secondary)]">
                This file type opens in a new tab.
              </p>
              <a
                href={previewEvidence.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--text-on-accent)]"
              >
                Open {previewEvidence.name}
              </a>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}

/* ==========================================================================
   DIALOG COMPONENTS
   ========================================================================== */

function EvidencePicker({
  evidence,
  selected,
  onToggle,
  onAttach,
  busy,
}: {
  evidence: DealDetail['evidence'];
  selected: string[];
  onToggle: (id: string) => void;
  onAttach: (id: string) => void;
  busy: boolean;
}) {
  if (evidence.length === 0) {
    return (
      <p className="font-body text-xs leading-relaxed text-[var(--text-muted)]">
        No files attached to this deal yet. Add evidence from the deal page first.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 font-body text-sm font-medium text-[var(--text-primary)]">Attach evidence</p>
      <ul className="flex flex-col gap-1">
        {evidence.map((file) => (
          <li key={file.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]">
              <input
                type="checkbox"
                checked={selected.includes(file.id)}
                onChange={() => onToggle(file.id)}
                className="size-4 shrink-0 rounded border-[var(--border-strong)] accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1 truncate font-body text-sm text-[var(--text-primary)]">
                {file.original_filename}
              </span>
              <button
                type="button"
                onClick={() => onAttach(file.id)}
                disabled={busy}
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--accent)] disabled:opacity-50"
              >
                Preview
              </button>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeliveryDialog({
  open,
  onClose,
  detail,
  currencyCode,
  today,
  canUpload,
  busy,
  error,
  onSubmit,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  detail: DealDetail;
  currencyCode: string;
  today: string;
  canUpload: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onAttach: (id: string) => Promise<void>;
}) {
  const [received, setReceived] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState('as_agreed');
  const [note, setNote] = useState('');
  const [dateReceived, setDateReceived] = useState(today);
  const [selected, setSelected] = useState<string[]>([]);

  const submit = () => {
    const receivedLines = detail.lines.map((line) => ({
      lineId: line.id,
      receivedQuantity: received[line.id] === '' || received[line.id] === undefined ? null : Number(received[line.id]),
    }));

    const summary =
      note.trim() ||
      `Checked what arrived on ${dateReceived}. Recorded received quantities against the agreed order.`;

    return onSubmit(
      {
        eventType: 'delivery_checked',
        occurredAt: new Date(`${dateReceived}T09:00:00`).toISOString(),
        summary,
        condition,
        receivedLines,
        evidenceIds: selected,
      },
      'Delivery recorded and added to deal memory.',
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record delivery"
      description="Record what actually arrived, even if it is less than agreed."
      disableEscape={busy}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Save delivery'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Date received" htmlFor="dateReceived" required>
          <TextInput id="dateReceived" type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
        </Field>

        <Field label="Condition" htmlFor="condition">
          <Select id="condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="mb-2 font-body text-sm font-medium text-[var(--text-primary)]">Quantity received</p>
          <ul className="flex flex-col gap-3">
            {detail.lines.map((line) => (
              <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_9rem] items-end gap-3">
                <div>
                  <p className="font-body text-sm text-[var(--text-primary)]">{line.product_label_snapshot}</p>
                  <p className="font-mono text-[10px] text-[var(--text-muted)]">
                    Agreed{' '}
                    {line.agreed_quantity !== null
                      ? formatQuantity(line.agreed_quantity, line.unit_label)
                      : formatQuantity(line.quoted_quantity, line.unit_label)}{' '}
                    at {formatMoney(line.agreed_unit_price ?? line.quoted_unit_price, currencyCode)}
                  </p>
                </div>
                <TextInput
                  id={`received-${line.id}`}
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  aria-label={`Quantity received for ${line.product_label_snapshot}`}
                  value={received[line.id] ?? ''}
                  onChange={(e) => setReceived((previous) => ({ ...previous, [line.id]: e.target.value }))}
                />
              </li>
            ))}
          </ul>
        </div>

        <Field label="Note" htmlFor="deliveryNoteInput" help="Optional. Anything worth remembering about this delivery.">
          <Textarea id="deliveryNoteInput" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </Field>

        {canUpload && (
          <EvidencePicker
            evidence={detail.evidence}
            selected={selected}
            onToggle={(id) =>
              setSelected((previous) =>
                previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id],
              )
            }
            onAttach={onAttach}
            busy={busy}
          />
        )}

        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </Dialog>
  );
}

function IssueDialog({
  open,
  onClose,
  busy,
  error,
  today,
  canUpload,
  unlinkedEvidence,
  onSubmit,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  today: string;
  canUpload: boolean;
  unlinkedEvidence: DealDetail['evidence'];
  onSubmit: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onAttach: (id: string) => Promise<void>;
}) {
  const [issueType, setIssueType] = useState('short_quantity');
  const [what, setWhat] = useState('');
  const [noticed, setNoticed] = useState(today);
  const [selected, setSelected] = useState<string[]>([]);

  const valid = what.trim().length >= 3;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Log an issue"
      description="Record the discrepancy while you still remember the detail."
      disableEscape={busy}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !valid}
            onClick={() =>
              void onSubmit(
                {
                  eventType: 'issue_opened',
                  occurredAt: new Date(`${noticed}T09:00:00`).toISOString(),
                  summary: what.trim(),
                  issueType,
                  evidenceIds: selected,
                },
                'Issue recorded and added to deal memory.',
              )
            }
          >
            {busy ? 'Saving…' : 'Save issue'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Issue type" htmlFor="issueType" required>
          <Select id="issueType" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            {ISSUE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="What happened?" htmlFor="whatHappened" required>
          <Textarea
            id="whatHappened"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            rows={4}
            placeholder="e.g. Two cartons of tomato paste were missing from the delivery."
          />
        </Field>

        <Field label="Date noticed" htmlFor="noticed" required>
          <TextInput id="noticed" type="date" value={noticed} onChange={(e) => setNoticed(e.target.value)} />
        </Field>

        {canUpload && (
          <EvidencePicker
            evidence={unlinkedEvidence}
            selected={selected}
            onToggle={(id) =>
              setSelected((previous) =>
                previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id],
              )
            }
            onAttach={onAttach}
            busy={busy}
          />
        )}

        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </Dialog>
  );
}

function ResolutionDialog({
  open,
  onClose,
  busy,
  error,
  today,
  canUpload,
  unlinkedEvidence,
  onSubmit,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  today: string;
  canUpload: boolean;
  unlinkedEvidence: DealDetail['evidence'];
  onSubmit: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onAttach: (id: string) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState('');
  const [resolvedOn, setResolvedOn] = useState(today);
  const [selected, setSelected] = useState<string[]>([]);

  const valid = outcome.trim().length >= 3;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record resolution"
      description="Record what was agreed with the supplier."
      disableEscape={busy}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !valid}
            onClick={() =>
              void onSubmit(
                {
                  eventType: 'resolution_recorded',
                  occurredAt: new Date(`${resolvedOn}T09:00:00`).toISOString(),
                  summary: outcome.trim(),
                  resolutionOutcome: outcome.trim(),
                  outcomeCode: 'agreed',
                  evidenceIds: selected,
                },
                'Resolution recorded and added to deal memory.',
              )
            }
          >
            {busy ? 'Saving…' : 'Save resolution'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Outcome agreed" htmlFor="outcome" required>
          <Textarea
            id="outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={4}
            placeholder="e.g. Supplier agreed to deliver the two missing cartons on Friday."
          />
        </Field>

        <Field label="Resolved on" htmlFor="resolvedOn" required>
          <TextInput id="resolvedOn" type="date" value={resolvedOn} onChange={(e) => setResolvedOn(e.target.value)} />
        </Field>

        {canUpload && (
          <EvidencePicker
            evidence={unlinkedEvidence}
            selected={selected}
            onToggle={(id) =>
              setSelected((previous) =>
                previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id],
              )
            }
            onAttach={onAttach}
            busy={busy}
          />
        )}

        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </Dialog>
  );
}

function NoteDialog({
  open,
  onClose,
  busy,
  error,
  canUpload,
  unlinkedEvidence,
  onSubmit,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  canUpload: boolean;
  unlinkedEvidence: DealDetail['evidence'];
  onSubmit: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onAttach: (id: string) => Promise<void>;
}) {
  const [summary, setSummary] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const valid = summary.trim().length >= 3;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a note"
      disableEscape={busy}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !valid}
            onClick={() =>
              void onSubmit({ eventType: 'note_added', summary: summary.trim(), evidenceIds: selected }, 'Note added to deal memory.')
            }
          >
            {busy ? 'Saving…' : 'Save note'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Note" htmlFor="noteSummary" required>
          <Textarea id="noteSummary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} />
        </Field>

        {canUpload && (
          <EvidencePicker
            evidence={unlinkedEvidence}
            selected={selected}
            onToggle={(id) =>
              setSelected((previous) =>
                previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id],
              )
            }
            onAttach={onAttach}
            busy={busy}
          />
        )}

        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </Dialog>
  );
}

function EvidenceUploadDialog({
  open,
  onClose,
  shopId,
  dealId,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  dealId: string;
  onComplete: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);

  const upload = async (files: FileList) => {
    setBusy(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const request = await fetch('/api/evidence/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            dealId,
            fileName: file.name,
            contentType: file.type,
            byteSize: file.size,
          }),
        });

        const requestPayload = await request.json();
        if (!request.ok) {
          setError(requestPayload?.error?.message ?? 'That file could not be prepared.');
          continue;
        }

        const put = await fetch(
          `${requestPayload.signedUrl}?token=${encodeURIComponent(requestPayload.token)}`,
          { method: 'PUT', headers: { 'Content-Type': file.type }, body: file },
        );
        if (!put.ok) {
          setError(`“${file.name}” did not finish uploading.`);
          continue;
        }

        const complete = await fetch('/api/evidence/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            objectKey: requestPayload.objectKey,
            dealId,
            fileName: file.name,
            contentType: file.type,
            byteSize: file.size,
          }),
        });

        const completePayload = await complete.json();
        if (!complete.ok) {
          setError(completePayload?.error?.message ?? `“${file.name}” could not be recorded.`);
          continue;
        }

        setDone((previous) => [...previous, completePayload.evidence.original_filename]);
      }

      await onComplete();
    } catch {
      setError('The upload could not be completed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add evidence"
      description="Photos of a message, a receipt or a delivery note. Only your shop can open these."
      disableEscape={busy}
      footer={
        <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-wash)] p-5 text-center transition-colors duration-[120ms] hover:border-[var(--accent-border)]">
          <span className="font-body text-sm font-semibold text-[var(--text-primary)]">
            {busy ? 'Uploading…' : 'Choose files'}
          </span>
          <span className="font-body text-xs text-[var(--text-muted)]">JPEG, PNG, WebP, HEIC or PDF, up to 25 MB</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              if (event.target.files?.length) void upload(event.target.files);
              event.target.value = '';
            }}
          />
        </label>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        {done.length > 0 && (
          <div>
            <SuccessMessage>Attached: {done.join(', ')}</SuccessMessage>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function DraftDialog({
  open,
  onClose,
  detail,
  currencyCode,
  timezone,
}: {
  open: boolean;
  onClose: () => void;
  detail: DealDetail;
  currencyCode: string;
  timezone: string;
}) {
  const [goal, setGoal] = useState('Confirm the current status and the next delivery date.');
  const [selected, setSelected] = useState<string[]>(detail.events.filter((e) => !e.superseded_at).map((e) => e.id));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/assistant/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: detail.deal.shop_id,
          dealId: detail.deal.id,
          selectedEventIds: selected,
          goal,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? 'The draft could not be prepared.');
        return;
      }

      setDraft(payload.draft);
      setNotice(payload.notice);
      if (payload.failureReason) setNotice(`${payload.notice} ${payload.failureReason}`);
    } catch {
      setError('We could not reach Vendra. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Copying was blocked by the browser. Select the text and copy it manually.');
    }
  };

  const usableEvents = detail.events.filter((e) => !e.superseded_at);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Draft a follow-up"
      description="Prepare a message you can send yourself. Vendra does not send anything to a supplier."
      disableEscape={busy}
      footer={
        draft ? (
          <>
            <Button variant="secondary" type="button" onClick={onClose}>
              Close
            </Button>
            <Button type="button" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy message'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void generate()} disabled={busy || selected.length === 0}>
              {busy ? 'Preparing…' : 'Prepare draft'}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What do you want the message to ask for?" htmlFor="draftGoal" required>
          <Textarea id="draftGoal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} />
        </Field>

        <div>
          <p className="mb-2 font-body text-sm font-medium text-[var(--text-primary)]">
            Records the draft will use
          </p>
          <ul className="flex flex-col gap-1">
            {usableEvents.map((event) => (
              <li key={event.id}>
                <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg px-2 transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]">
                  <input
                    type="checkbox"
                    checked={selected.includes(event.id)}
                    onChange={() =>
                      setSelected((previous) =>
                        previous.includes(event.id)
                          ? previous.filter((x) => x !== event.id)
                          : [...previous, event.id],
                      )
                    }
                    className="mt-1 size-4 shrink-0 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--accent)]">
                      {EventTypeLabel(event.event_type)}
                    </span>
                    <span className="block font-body text-xs leading-relaxed text-[var(--text-primary)]">
                      {event.summary}
                    </span>
                    <span className="block font-mono text-[10px] text-[var(--text-muted)]">
                      {formatDate(event.occurred_at, timezone)}
                      {event.agreed_total !== null
                        ? ` · ${formatMoney(event.agreed_total, currencyCode)}`
                        : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {draft && (
          <Field label="Draft message" htmlFor="draftOutput" help="Edit freely before you send it.">
            <Textarea id="draftOutput" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} />
          </Field>
        )}

        {notice && <InfoMessage>{notice}</InfoMessage>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </Dialog>
  );
}