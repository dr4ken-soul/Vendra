'use client';

import { AnimatePresence, motion } from 'motion/react';
import { forwardRef, useEffect, useId, useRef } from 'react';

/**
 * Shared application UI primitives.
 * Every class here comes from FRONTEND_SPEC.md section 4.3. Route-specific
 * components compose these; they must not restyle them.
 */

/* ===========================================================================
   Page header
   =========================================================================== */

export function PageHeader({
  title,
  description,
  actions,
  headingId,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  headingId?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1
          id={headingId}
          tabIndex={-1}
          className="font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] focus:outline-none md:text-4xl"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[64ch] font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

/* ===========================================================================
   Buttons
   =========================================================================== */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
};

const BUTTON_VARIANTS = {
  primary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 font-body text-sm font-semibold text-[var(--text-on-accent)] transition-colors duration-[120ms] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40',
  secondary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-panel)] px-5 py-2.5 font-body text-sm font-semibold text-[var(--text-primary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40',
  quiet:
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 font-body text-sm font-medium text-[var(--text-secondary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40',
  danger:
    'inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--error)] bg-[var(--error-soft)] px-4 py-2 font-body text-sm font-semibold text-[var(--error)] transition-colors duration-[120ms] hover:bg-[var(--error-soft)] disabled:cursor-not-allowed disabled:opacity-40',
} as const;

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${BUTTON_VARIANTS[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  href,
  variant = 'primary',
  className = '',
  children,
}: {
  href: string;
  variant?: keyof typeof BUTTON_VARIANTS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={`${BUTTON_VARIANTS[variant]} ${className}`}>
      {children}
    </a>
  );
}

/* ===========================================================================
   Form fields
   =========================================================================== */

const FIELD_BASE =
  'min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2.5 font-body text-sm text-[var(--text-primary)] transition-colors duration-[120ms] placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] disabled:opacity-50';

const FIELD_ERROR = 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error-soft)]';

export function Field({
  label,
  htmlFor,
  error,
  help,
  children,
  required,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block font-body text-sm font-medium text-[var(--text-primary)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--error)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {help && !error && (
        <p id={`${htmlFor}-help`} className="mt-1.5 font-body text-xs leading-relaxed text-[var(--text-muted)]">
          {help}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 font-body text-xs leading-relaxed text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { id: string; error?: string }
>(function TextInput({ id, error, className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`${FIELD_BASE} ${error ? FIELD_ERROR : ''} ${className}`}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; error?: string }
>(function Textarea({ id, error, className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`min-h-28 w-full resize-y rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-3 font-body text-sm leading-relaxed text-[var(--text-primary)] transition-colors duration-[120ms] placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] ${
        error ? FIELD_ERROR : ''
      } ${className}`}
      {...props}
    />
  );
});

export function Select({
  id,
  error,
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { id: string; error?: string }) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${FIELD_BASE} appearance-none pr-10 ${error ? FIELD_ERROR : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      >
        <path d="m4 6 3 3 3-3" />
      </svg>
    </div>
  );
}

export function Checkbox({
  id,
  label,
  help,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; help?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-[var(--border-strong)] accent-[var(--accent)]"
        {...props}
      />
      <label htmlFor={id} className="font-body text-sm text-[var(--text-primary)]">
        {label}
        {help && <span className="mt-0.5 block font-body text-xs leading-relaxed text-[var(--text-muted)]">{help}</span>}
      </label>
    </div>
  );
}

/* ===========================================================================
   Status badge — colour is ALWAYS paired with a text label
   =========================================================================== */

const STATUS_STYLES = {
  neutral: 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
  accent: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]',
  info: 'border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]',
  warning: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]',
  error: 'border-[var(--error)] bg-[var(--error-soft)] text-[var(--error)]',
  success: 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]',
} as const;

export type StatusTone = keyof typeof STATUS_STYLES;

export function StatusBadge({ tone = 'neutral', children }: { tone?: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${STATUS_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

/* ===========================================================================
   Empty state
   =========================================================================== */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-wash)] px-5 py-8 text-center md:px-8 md:py-10">
      <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-[48ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ===========================================================================
   Skeletons — never a spinner-only loading state
   =========================================================================== */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--bg-secondary)] ${className}`} aria-hidden="true" />;
}

export function ListSkeleton({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="border-t border-[var(--border-default)]">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="border-b border-[var(--border-subtle)] py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mb-7">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-52" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
    </div>
  );
}

/* ===========================================================================
   Dialog
   =========================================================================== */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  /** Escape is disabled while a destructive operation is processing. */
  disableEscape,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  disableEscape?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  /**
   * `onClose` and `disableEscape` are held in refs so the lifecycle effect below
   * can depend on `open` alone.
   *
   * Every call site in this app passes an inline arrow, so depending on `onClose`
   * meant a new function identity on every render. The effect therefore tore down
   * and re-ran on every parent re-render — and every parent re-render included
   * every keystroke in a field inside the dialog. Typing one character re-ran the
   * effect, which re-ran the autofocus and moved focus off the input. You could
   * type one character and then nothing, in all twelve dialogs in the app.
   *
   * The refs are synced in an effect rather than assigned during render, because
   * writing a ref during render is not safe when React discards a render.
   */
  const onCloseRef = useRef(onClose);
  const disableEscapeRef = useRef(disableEscape);

  useEffect(() => {
    onCloseRef.current = onClose;
    disableEscapeRef.current = disableEscape;
  }, [onClose, disableEscape]);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    /**
     * Where focus goes when the dialog opens.
     *
     * In order: whatever the caller marked with `data-autofocus`, then the first
     * real control in the dialog's body, then the heading.
     *
     * The heading used to be marked, so opening any form dialog put focus on a
     * `tabindex="-1"` heading rather than the first field, and the user had to Tab
     * to reach what they came to type into. The close button is deliberately not
     * preferred: it sits in the header, before the body in the DOM, so querying
     * the panel for the first focusable control would always return it.
     */
    const autofocusTarget = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    if (autofocusTarget) {
      autofocusTarget.focus();
    } else {
      const firstControl = bodyRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (firstControl ?? closeRef.current)?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !disableEscapeRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previousFocus.current?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={disableEscape ? undefined : onClose}
            className="fixed inset-0 z-[59] bg-[rgba(36,42,39,0.5)]"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed left-1/2 top-1/2 z-[60] max-h-[calc(100dvh-2rem)] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-lg)] md:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  tabIndex={-1}
                  className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] focus:outline-none"
                >
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 font-body text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
                )}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                disabled={disableEscape}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)] disabled:opacity-40"
              >
                <span className="sr-only">Close dialog</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <div ref={bodyRef} className="mt-5">{children}</div>

            {footer && (
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:justify-end">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ===========================================================================
   Inline messages
   =========================================================================== */

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-[var(--error)] bg-[var(--error-soft)] px-3 py-2 font-body text-sm leading-relaxed text-[var(--error)]">
      {children}
    </p>
  );
}

export function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-lg border border-[var(--success)] bg-[var(--success-soft)] px-3 py-2 font-body text-sm leading-relaxed text-[var(--success)]">
      {children}
    </p>
  );
}

export function InfoMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-lg border border-[var(--info)] bg-[var(--info-soft)] px-3 py-2 font-body text-sm leading-relaxed text-[var(--info)]">
      {children}
    </p>
  );
}

/* ===========================================================================
   Labelled progress indicator (three-step wizard)
   =========================================================================== */

export function StepProgress({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div>
      <ol className="grid grid-cols-3 gap-2" aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
        {steps.map((step, index) => {
          const state = index === current ? 'current' : index < current ? 'done' : 'todo';
          return (
            <li
              key={step}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`border-t-2 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] ${
                state === 'current'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : state === 'done'
                    ? 'border-[var(--success)] text-[var(--success)]'
                    : 'border-[var(--border-default)] text-[var(--text-muted)]'
              }`}
            >
              <span className="md:hidden">{index + 1}. {step}</span>
              <span className="hidden md:inline">
                {index + 1}. {step}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Step {current + 1} of {steps.length}
      </p>
    </div>
  );
}

/* ===========================================================================
   Memory status — distinct from the deal-save status, always labelled
   =========================================================================== */

export function MemoryStatus({ status, detail }: { status: string; detail?: string | null }) {
  const map: Record<string, { tone: StatusTone; label: string }> = {
    ready: { tone: 'success', label: 'Memory ready' },
    processing: { tone: 'info', label: 'Memory syncing' },
    queued: { tone: 'info', label: 'Memory syncing' },
    failed: { tone: 'error', label: 'Memory needs attention' },
    superseded: { tone: 'neutral', label: 'Memory replaced' },
    deletion_pending: { tone: 'warning', label: 'Memory pending deletion' },
    skipped: { tone: 'warning', label: 'Memory not written' },
  };

  const entry = map[status] ?? { tone: 'neutral' as StatusTone, label: 'Memory pending' };

  return (
    <div>
      <StatusBadge tone={entry.tone}>{entry.label}</StatusBadge>
      {detail && <p className="mt-1.5 font-body text-xs leading-relaxed text-[var(--text-muted)]">{detail}</p>}
    </div>
  );
}