'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  ErrorMessage,
  Field,
  InfoMessage,
  StatusBadge,
  SuccessMessage,
  TextInput,
  type StatusTone,
} from './ui';

interface RequestRow {
  id: string;
  type: string;
  scope: string;
  status: string;
  detail: string | null;
  blockedReason: string | null;
  memoryReferenceCount: number;
  requestedAt: string;
  completedAt: string | null;
}

const STATUS_PRESENTATION: Record<string, { label: string; tone: StatusTone }> = {
  received: { label: 'Request received', tone: 'info' },
  awaiting_owner_authorisation: { label: 'Awaiting owner authorisation', tone: 'warning' },
  in_progress: { label: 'Deletion in progress', tone: 'info' },
  verifying: { label: 'Verifying deletion', tone: 'info' },
  complete: { label: 'Complete', tone: 'success' },
  blocked: { label: 'Blocked', tone: 'error' },
  ready: { label: 'Complete', tone: 'success' },
  failed: { label: 'Blocked', tone: 'error' },
};

const SCOPE_LABEL: Record<string, string> = {
  relational: 'Records and messages',
  evidence_objects: 'Attached files',
  walrus_memory: 'Deal memories',
  derived_text: 'Extracted text',
};

/**
 * /app/settings/privacy (FRONTEND_SPEC 4.8)
 *
 * Requests are tracked per data class. A layer we cannot verify is reported as
 * Blocked, never as Complete.
 */
export function PrivacyView({
  shopId,
  shopName,
  canExport,
  canErase,
}: {
  shopId: string;
  shopName: string;
  canExport: boolean;
  canErase: boolean;
}) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loadedShopId, setLoadedShopId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const [eraseOpen, setEraseOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [eraseBusy, setEraseBusy] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);
  const [eraseResults, setEraseResults] = useState<
    Array<{ scope: string; status: string; detail: string }> | null
  >(null);

  const load = async () => {
    setError(null);
    try {
      const response = await fetch('/api/privacy/erase', {
        headers: { 'x-vendra-shop': shopId },
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? 'Your data requests could not be loaded.');
        return;
      }
      setRequests(payload.requests ?? []);
      // Marks the first load as complete, which is what clears the loading row.
      setLoadedShopId(shopId);
    } catch {
      setError('We could not reach Vendra. Check your connection and try again.');
      setLoadedShopId(shopId);
    }
  };

  const loading = loadedShopId !== shopId;

  // Load inside an effect callback rather than synchronously in the effect
  // body, so the state update happens after the effect returns.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const requestExport = async () => {
    setExportBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/privacy/export', {
        method: 'POST',
        headers: { 'x-vendra-shop': shopId },
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'The export could not be created.');
        return;
      }

      setExportUrl(payload.downloadUrl);
      setMessage(payload.message);
    } catch {
      setError('We could not reach Vendra. Check your connection and try again.');
    } finally {
      setExportBusy(false);
    }
  };

  const requestErasure = async () => {
    setEraseBusy(true);
    setEraseError(null);

    try {
      const response = await fetch('/api/privacy/erase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vendra-shop': shopId,
        },
        body: JSON.stringify({ confirmShopName: confirmName }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setEraseError(payload?.error?.message ?? 'That deletion request could not be submitted.');
        return;
      }

      setEraseResults(payload.results);
      setMessage(payload.message);
      setEraseOpen(false);
      setConfirmName('');
      await load();
    } catch {
      setEraseError('We could not reach Vendra. Check your connection and try again.');
    } finally {
      setEraseBusy(false);
    }
  };

  const openRequests = requests.filter((r) => r.type === 'erasure');
  const exportRequests = requests.filter((r) => r.type === 'export');

  return (
    <div className="max-w-[900px]">
      <h1
        id="page-heading"
        tabIndex={-1}
        className="font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] focus:outline-none md:text-4xl"
      >
        Privacy and data
      </h1>
      <p className="mt-2 max-w-[64ch] font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
        Export your shop’s records, or ask for them to be deleted.
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

      {eraseResults && (
        <section className="mt-6 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Deletion result</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {eraseResults.map((result) => {
              const presentation = STATUS_PRESENTATION[result.status] ?? {
                label: result.status,
                tone: 'neutral' as StatusTone,
              };
              return (
                <li key={result.scope} className="border-b border-[var(--border-subtle)] pb-3 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-body text-sm font-medium text-[var(--text-primary)]">
                      {SCOPE_LABEL[result.scope] ?? result.scope}
                    </span>
                    <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>
                  </div>
                  <p className="mt-1 font-body text-xs leading-relaxed text-[var(--text-secondary)]">
                    {result.detail}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 font-body text-xs leading-relaxed text-[var(--text-muted)]">
            A layer is only marked Complete when Vendra has checked it. Anything it cannot confirm stays marked
            Blocked.
          </p>
        </section>
      )}

      {/* EXPORT */}
      <section className="mt-8 border-t border-[var(--border-default)] py-5">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Export shop data</h2>
        <p className="mt-1 max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Creates a file listing your shop, suppliers, deals, records, evidence metadata and memory history.
          Evidence files are not embedded; download them from their deals while you still have access.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void requestExport()}
            disabled={!canExport || exportBusy}
          >
            {exportBusy ? 'Preparing export…' : 'Request export'}
          </Button>

          {exportUrl && (
            <a
              href={exportUrl}
              download
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-panel)] px-5 py-2.5 font-body text-sm font-semibold text-[var(--text-primary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]"
            >
              Download export
            </a>
          )}
        </div>

        {!canExport && (
          <p className="mt-3 font-body text-xs leading-relaxed text-[var(--text-muted)]">
            You do not have permission to export this shop’s data. Ask the owner or a manager.
          </p>
        )}
      </section>

      {/* DELETE */}
      <section className="border-t border-[var(--border-default)] py-5">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Delete shop data</h2>
        <p className="mt-1 max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Removes this shop’s records, attached files and messages, and switches off its deal memory. You will
          have to type the shop name to confirm.
        </p>

        <div className="mt-4">
          {canErase ? (
            <Button variant="danger" type="button" onClick={() => setEraseOpen(true)}>
              Request deletion
            </Button>
          ) : (
            <p className="font-body text-xs leading-relaxed text-[var(--text-muted)]">
              Only the shop owner can request deletion of this shop’s data.
            </p>
          )}
        </div>

        <div className="mt-4">
          <InfoMessage>
            Deal memories cannot yet be confirmed as permanently erased. Vendra’s memory service exposes no
            deletion method, and the signed deletion flow has not been verified in this deployment. A deletion
            request will record that layer as Blocked rather than claiming it was removed.
          </InfoMessage>
        </div>
      </section>

      {/* REQUEST HISTORY */}
      <section className="border-t border-[var(--border-default)] py-5">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Your data requests</h2>

        {loading ? (
          <p role="status" className="mt-3 font-body text-sm text-[var(--text-secondary)]">
            Loading your requests…
          </p>
        ) : requests.length === 0 ? (
          <p className="mt-3 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
            No data requests yet. An export gives you a copy of everything this shop has recorded. A deletion
            request removes it, layer by layer, and reports which layers could not be confirmed.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-[var(--border-subtle)] border-t border-[var(--border-default)]">
            {[...openRequests, ...exportRequests].map((request) => {
              const presentation = STATUS_PRESENTATION[request.status] ?? {
                label: request.status,
                tone: 'neutral' as StatusTone,
              };
              return (
                <li key={request.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-body text-sm font-medium text-[var(--text-primary)]">
                      {request.type === 'erasure' ? 'Deletion' : 'Export'} ·{' '}
                      {SCOPE_LABEL[request.scope] ?? request.scope}
                    </span>
                    <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>
                  </div>
                  {request.detail && (
                    <p className="mt-1 font-body text-xs leading-relaxed text-[var(--text-secondary)]">
                      {request.detail}
                    </p>
                  )}
                  {request.blockedReason && (
                    <p className="mt-1 font-body text-xs leading-relaxed text-[var(--error)]">
                      Blocked: {request.blockedReason}
                    </p>
                  )}
                  {request.memoryReferenceCount > 0 && (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {request.memoryReferenceCount} memory reference(s) recorded
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ERASURE CONFIRMATION */}
      <Dialog
        open={eraseOpen}
        onClose={() => setEraseOpen(false)}
        title="Delete this shop’s data?"
        description="This removes the shop’s records, attached files and messages, and switches off its deal memory."
        disableEscape={eraseBusy}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setEraseOpen(false)} disabled={eraseBusy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={() => void requestErasure()}
              disabled={eraseBusy || confirmName.trim().toLowerCase() !== shopName.trim().toLowerCase()}
            >
              {eraseBusy ? 'Deleting…' : 'Delete shop data'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm leading-relaxed text-[var(--text-secondary)]">
            Type <span className="font-semibold text-[var(--text-primary)]">{shopName}</span> to confirm.
          </p>

          <Field label="Shop name" htmlFor="confirmShopName" required>
            <TextInput
              id="confirmShopName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
            />
          </Field>

          <InfoMessage>
            Your deal memories cannot yet be confirmed as erased. That layer will be recorded as Blocked.
          </InfoMessage>

          {eraseError && <ErrorMessage>{eraseError}</ErrorMessage>}
        </div>
      </Dialog>
    </div>
  );
}