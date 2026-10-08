'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorMessage,
  InfoMessage,
  StatusBadge,
  Textarea,
} from './ui';
import { EventTypeLabel } from './dealStatus';
import { formatDate } from '@/lib/format';

interface Source {
  eventId: string;
  dealId: string;
  supplierName: string;
  eventType: string;
  occurredAt: string;
  summary: string;
  headline: string | null;
  dealDate: string;
  currencyCode: string;
  lines: Array<{
    productLabel: string;
    quotedQuantity: number | null;
    agreedQuantity: number | null;
    receivedQuantity: number | null;
    unitLabel: string | null;
    quotedUnitPrice: number | null;
    agreedUnitPrice: number | null;
  }>;
  evidence: Array<{ id: string; originalFilename: string }>;
}

interface Turn {
  id: string;
  question: string;
  answer: string;
  sources: Source[];
  memoryStatus: string;
  unavailableReason: string | null;
  grounded: boolean;
  failureReason: string | null;
}

const STARTERS = [
  'What did I agree to pay last time?',
  'Was the last delivery complete?',
  'How was the last issue resolved?',
];

const MEMORY_LABEL: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' }> = {
  ready: { label: 'Answered from deal memory', tone: 'success' },
  record_search: { label: 'Answered by searching saved records', tone: 'info' },
  unavailable: { label: 'Deal memory unavailable', tone: 'warning' },
  no_match: { label: 'No matching record found', tone: 'neutral' },
};

/**
 * /app/ask (FRONTEND_SPEC 4.7)
 *
 * An answer is never shown as factual until it resolves to current canonical
 * deal events. Sources are always rendered alongside the answer.
 *
 * Cmd/Ctrl+Enter sends; plain Enter inserts a newline.
 */
export function AskConversation({
  shopId,
  canAsk,
}: {
  shopId: string;
  canAsk: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Plain state, not a ref: the starters panel is a render decision.
  const [hasAsked, setHasAsked] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  /**
   * The key hint must work on both platforms. A platform-specific label can
   * only be known after mount, which would cause a hydration mismatch, so the
   * hint names both modifiers.
   */
  const sendHint = 'Ctrl + Enter on Windows, ⌘ + Enter on Mac';

  useEffect(() => {
    if (asking || turns.length > 0) {
      endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }, [asking, turns]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3 || asking) return;

    setAsking(true);
    setError(null);
    setHasAsked(true);

    try {
      const response = await fetch('/api/assistant/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, sessionId, shopId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        // The question and prior answers are preserved so nothing is lost.
        setError(payload?.error?.message ?? 'That question could not be answered just now. Try again.');
        return;
      }

      setTurns((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          question: trimmed,
          answer: payload.answer,
          sources: payload.sources ?? [],
          memoryStatus: payload.memoryStatus,
          unavailableReason: payload.unavailableReason,
          grounded: payload.grounded,
          failureReason: payload.failureReason,
        },
      ]);

      if (payload.sessionId) setSessionId(payload.sessionId);
      setQuestion('');
      textareaRef.current?.focus();
    } catch {
      setError('We could not reach Vendra. Your question is still here — try again.');
    } finally {
      setAsking(false);
    }
  };

  if (!canAsk) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          You do not have permission to use Ask Vendra
        </h2>
        <p className="mt-2 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Ask the shop owner or a manager to grant you access.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <section className="lg:col-span-7" aria-label="Conversation">
        {turns.length === 0 && !hasAsked ? (
          <div>
            <p className="font-body text-sm leading-relaxed text-[var(--text-secondary)]">
              Ask about a supplier, an item or a date. Vendra looks through your shop’s own saved records and shows
              you which record each answer came from.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void ask(starter)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] px-4 py-3 text-left font-body text-sm text-[var(--text-primary)] transition-colors duration-[120ms] hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface)]"
                >
                  {starter}
                  <span aria-hidden="true" className="text-[var(--accent)]">
                    &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ol className="flex flex-col gap-4">
              {turns.map((turn) => (
                <li key={turn.id} className="flex flex-col gap-3">
                  <p className="ml-auto max-w-[min(90%,520px)] rounded-2xl rounded-br-md bg-[var(--bg-secondary)] px-4 py-3 font-body text-sm leading-relaxed text-[var(--text-primary)]">
                    {turn.question}
                  </p>

                  <div className="max-w-[68ch] rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5">
                    {turn.unavailableReason && (
                      <div className="mb-3">
                        <InfoMessage>{turn.unavailableReason}</InfoMessage>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap font-body text-sm leading-relaxed text-[var(--text-primary)]">
                      {turn.answer}
                    </div>

                    {turn.failureReason && (
                      <p className="mt-3 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                        {turn.failureReason}
                      </p>
                    )}

                    <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                      <StatusBadge tone={MEMORY_LABEL[turn.memoryStatus]?.tone ?? 'neutral'}>
                        {MEMORY_LABEL[turn.memoryStatus]?.label ?? 'Answered from your records'}
                      </StatusBadge>

                      {turn.sources.length > 0 && (
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                          {turn.sources.length} source record{turn.sources.length === 1 ? '' : 's'} · open any of
                          them to check the answer
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {asking && (
              <div role="status" aria-live="polite" className="mt-4">
                <span className="sr-only">Looking through your saved records</span>
                <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] px-4 py-3 font-body text-sm text-[var(--text-secondary)]">
                  Looking through your shop’s saved records…
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4">
                <ErrorMessage>{error}</ErrorMessage>
              </div>
            )}
            <div ref={endRef} />
          </>
        )}

        {/* COMPOSER */}
        <form
          className="sticky bottom-20 z-10 mt-6 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-3 shadow-[var(--shadow-sm)]"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <label htmlFor="askInput" className="sr-only">
            Ask about a past quote, delivery, issue or resolution
          </label>
          <Textarea
            id="askInput"
            ref={textareaRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              // Cmd/Ctrl+Enter sends. Plain Enter inserts a newline.
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void ask(question);
              }
            }}
            placeholder="Ask about a supplier, item or date…"
            rows={3}
            className="min-h-[88px] max-h-[220px]"
            disabled={asking}
            aria-describedby="askHelp"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p id="askHelp" className="font-body text-[11px] leading-relaxed text-[var(--text-muted)]">
              {sendHint} to send. Enter starts a new line.
            </p>
            <Button type="submit" disabled={asking || question.trim().length < 3}>
              {asking ? 'Asking…' : 'Ask'}
            </Button>
          </div>
        </form>
      </section>

      {/* SOURCES — 5 columns, below the answer on mobile */}
      <aside className="lg:col-span-5" aria-labelledby="sources-heading">
        <div className="lg:sticky lg:top-24">
          <h2 id="sources-heading" className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Sources
          </h2>

          {turns.length === 0 ? (
            <EmptyState
              title="No sources yet"
              body="Ask a question. Every fact Vendra gives you links to the deal record it came from."
            />
          ) : (
            <div className="mt-4">
              {turns[turns.length - 1].sources.length === 0 ? (
                <EmptyState
                  title="No saved record matched"
                  body="Try another supplier, item or date. Vendra will not guess a price or outcome."
                  action={
                    <Link href="/app/deals" className="font-body text-sm font-semibold text-[var(--accent)] underline underline-offset-2">
                      Browse deals
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--border-subtle)] border-t">
                  {turns[turns.length - 1].sources.map((source) => (
                    <li key={source.eventId}>
                      <a
                        href={`/app/deals/${source.dealId}`}
                        className="flex min-h-14 flex-col justify-center gap-1 py-3 font-body text-sm font-medium text-[var(--text-primary)] transition-colors duration-[120ms] hover:text-[var(--accent)]"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate">{source.supplierName}</span>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                            {EventTypeLabel(source.eventType as never)}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {formatDate(source.occurredAt)}
                          {source.evidence.length > 0 && ` · ${source.evidence.length} file(s)`}
                        </span>
                        <span className="line-clamp-2 text-xs font-normal leading-relaxed text-[var(--text-secondary)]">
                          {source.summary}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5">
                <Link href="/app/deals" className="font-body text-sm font-medium text-[var(--accent)] hover:underline">
                  Browse all deals
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

