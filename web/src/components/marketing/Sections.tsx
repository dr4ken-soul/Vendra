'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Enter, Reveal, RevealX } from './Reveal';

const EASE = [0.16, 1, 0.3, 1] as const;

/* ===========================================================================
   SECTION 1 — HERO (editorial-asymmetric-hero, adapted)
   =========================================================================== */

export function Hero() {
  return (
    <section className="relative z-10 grid min-h-[100dvh] grid-cols-1 items-end gap-8 overflow-hidden px-5 pb-10 pt-28 md:px-8 md:pb-12 lg:grid-cols-12 lg:px-12 lg:pb-16">
      <div className="relative z-10 lg:col-span-7 lg:self-start lg:pt-[13vh]">
        <Enter delay={0.12} blur={8} y={8}>
          <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] md:text-[11px]">
            SUPPLIER DEAL MEMORY FOR INDEPENDENT RETAILERS
          </p>
        </Enter>

        <Enter delay={0.2}>
          <h1 className="max-w-[11ch] text-balance font-display text-5xl font-semibold leading-[0.92] tracking-[-0.045em] text-[var(--text-primary)] sm:text-6xl md:text-7xl lg:text-[5rem]">
            Know what you agreed.
          </h1>
        </Enter>

        <Enter delay={0.3} blur={8} y={12}>
          <p className="mt-6 max-w-[46ch] text-pretty font-body text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
            Vendra keeps the quote, agreed terms, delivery and outcome together, so your shop can check the
            history before buying again.
          </p>
        </Enter>

        <Enter delay={0.4} blur={8} y={12}>
          <div className="mt-8 flex flex-wrap items-center gap-3 md:mt-10 md:gap-4">
            <Link
              href="/app"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-body text-sm font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-sm)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Try Vendra
            </Link>
            <a
              href="#deal-timeline"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-wash)] px-6 py-3 font-body text-sm font-semibold text-[var(--text-primary)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface)]"
            >
              See how it works
            </a>
          </div>
        </Enter>
      </div>

      <Enter delay={0.32} y={16} scale={0.985} className="relative z-20 lg:col-span-5 lg:justify-self-end lg:self-end">
        <div className="w-full max-w-[390px] justify-self-end rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-lg)] md:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                ILLUSTRATIVE FLOW
              </p>
              <p className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                How one deal becomes memory
              </p>
            </div>
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            {[
              { title: 'Quote saved', detail: 'What the supplier offered, and where it came from.' },
              { title: 'Terms confirmed', detail: 'The accepted price, quantity and delivery terms.' },
              { title: 'Delivery checked', detail: 'What arrived compared with what was agreed.' },
              { title: 'Recall in a later session', detail: 'Ask again weeks later and get the source record.' },
            ].map((step) => (
              <li key={step.title} className="grid grid-cols-[1.25rem_1fr] gap-3">
                <span className="mt-1 size-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent-soft)]" />
                <div>
                  <p className="font-body text-sm font-semibold text-[var(--text-primary)]">{step.title}</p>
                  <p className="mt-0.5 font-body text-xs leading-relaxed text-[var(--text-secondary)]">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Enter>
    </section>
  );
}

/* ===========================================================================
   SECTION 2 — PROBLEM (full-width-statement)
   =========================================================================== */

export function ProblemStatement() {
  return (
    <section className="relative z-10 flex items-center py-24 md:py-32 lg:py-40">
      <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 lg:px-12">
        <Reveal delay={0.08}>
          <p className="text-balance font-display text-[clamp(2.5rem,7.2vw,6rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--text-primary)]">
            A deal is more than a price.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-6 max-w-[64ch] text-pretty font-mono text-xs leading-relaxed tracking-[0.04em] text-[var(--text-secondary)] md:text-sm">
            Quotes, accepted terms, deliveries and resolutions can live in different places.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ===========================================================================
   SECTION 3 — DEAL TIMELINE (architecture-layers, adapted)
   =========================================================================== */

const TIMELINE_STEPS = [
  { index: '01', title: 'Quote', body: 'Save what the supplier offered and where it came from.' },
  { index: '02', title: 'Agreed terms', body: 'Keep the accepted price, quantity and delivery terms together.' },
  { index: '03', title: 'Delivery', body: 'Record what arrived against what was agreed.' },
  { index: '04', title: 'Issue and resolution', body: 'Keep the discrepancy and agreed outcome attached to the same deal.' },
];

export function DealTimeline() {
  return (
    <section id="deal-timeline" className="relative z-10 bg-[var(--surface-wash)] py-20 md:py-28 lg:py-32">
      <div className="mx-auto max-w-[1280px] px-5 md:px-8 lg:px-12">
        <Reveal delay={0.08}>
          <div className="flex max-w-[64ch] flex-col items-start gap-4">
            <h2 className="max-w-[22ch] text-balance font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] md:text-4xl lg:text-5xl">
              One deal. A record that stays connected.
            </h2>
            <p className="max-w-[58ch] text-pretty font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
              The same record holds the quote you received, the terms you accepted, what actually arrived, and
              how anything was resolved.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {TIMELINE_STEPS.map((step, index) => (
            <Reveal key={step.title} delay={0.08 + index * 0.08}>
              <div className="min-h-[220px] rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-5 shadow-[var(--shadow-sm)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                  {step.index}
                </p>
                <h3 className="mt-8 font-display text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[30ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===========================================================================
   SECTION 4 — RECALL DEMO WITH EVIDENCE (split-image-text, evidence panel)
   =========================================================================== */

type DemoSource = { label: string; type: string; detail: string };

const DEMO_SOURCES: DemoSource[] = [
  {
    label: 'Quote record',
    type: 'Deal event',
    detail:
      '“On 4 March the supplier quoted 20 cartons of tomato paste at ₦18,400 per carton.” Saved from the message you forwarded, with the message attached.',
  },
  {
    label: 'Agreed terms',
    type: 'Deal event',
    detail:
      '“Terms agreed: 18 cartons at ₦18,000 per carton, delivery expected 7 March.” Confirmed by you before it became part of the record.',
  },
  {
    label: 'Delivery check',
    type: 'Evidence link',
    detail:
      '“Received 16 cartons on 8 March. Two cartons short of the agreed quantity.” A photo of the loaded van is attached to this record.',
  },
];

export function RecallDemo() {
  const [openSource, setOpenSource] = useState<DemoSource | null>(null);

  return (
    <section id="recall-demo" className="relative z-10 py-20 md:py-28 lg:py-32">
      <div className="mx-auto max-w-[1280px] px-5 md:px-8 lg:px-12">
        <Reveal delay={0.08}>
          <div className="max-w-[62ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
              A MEMORY YOU CAN CHECK
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] md:text-4xl lg:text-5xl">
              Ask about the last deal. Open the evidence behind the answer.
            </h2>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <Reveal delay={0.16} className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-md)] md:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Illustrative example
              </p>

              <div className="mt-5 ml-auto max-w-[34ch] rounded-2xl rounded-br-md bg-[var(--bg-secondary)] px-4 py-3 font-body text-sm leading-relaxed text-[var(--text-primary)]">
                What happened with my last order from this supplier?
              </div>

              <div className="mt-4 max-w-[58ch] rounded-2xl rounded-bl-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-4 font-body text-sm leading-relaxed text-[var(--text-primary)]">
                I found the saved deal history. Open the agreed terms, delivery check and any recorded resolution
                below.
              </div>

              <p className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Illustrative example · sources link to deal events
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.24} className="lg:col-span-5">
            <div className="h-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-5 shadow-[var(--shadow-sm)] md:p-7">
              <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Evidence used
              </h3>
              <div className="mt-4 flex flex-col gap-2">
                {DEMO_SOURCES.map((source) => (
                  <button
                    key={source.label}
                    type="button"
                    onClick={() => setOpenSource(source)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 text-left transition-colors duration-[120ms] hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  >
                    <span className="font-body text-sm font-medium text-[var(--text-primary)]">
                      {source.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        {source.type}
                      </span>
                      <ChevronIcon />
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-4 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                These are example records shown to explain how Vendra works. Your own answers only ever link to
                deals saved by your shop.
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Source preview modal — z-[60], focus returns to the trigger row */}
      <AnimatePresence>
        {openSource && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={() => setOpenSource(null)}
              className="fixed inset-0 z-[59] bg-[rgba(36,42,39,0.5)]"
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="demo-source-title"
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed left-1/2 top-1/2 z-[60] max-h-[calc(100dvh-2rem)] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-lg)] md:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {openSource.type}
                  </p>
                  <h4
                    id="demo-source-title"
                    className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
                  >
                    {openSource.label}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenSource(null)}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors duration-[120ms] hover:bg-[var(--bg-secondary)]"
                >
                  <span className="sr-only">Close dialog</span>
                  <CloseIcon />
                </button>
              </div>
              <p className="mt-4 font-body text-sm leading-relaxed text-[var(--text-primary)]">
                {openSource.detail}
              </p>
              <p className="mt-4 rounded-lg bg-[var(--surface-wash)] px-3 py-2 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                Example content for illustration. In a real account this opens the retailer’s own saved record.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ===========================================================================
   SECTION 5 — OUTCOMES LEDGER (asymmetric-bento-grid, truthful)
   =========================================================================== */

export function OutcomesLedger() {
  return (
    <section className="relative z-10 bg-[var(--surface-wash)] py-20 md:py-28 lg:py-32">
      <div className="mx-auto max-w-[1280px] px-5 md:px-8 lg:px-12">
        <Reveal delay={0.08}>
          <div className="max-w-[58ch]">
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] md:text-4xl lg:text-5xl">
              Keep the outcome beside the agreement.
            </h2>
            <p className="mt-4 font-body text-base leading-relaxed text-[var(--text-secondary)]">
              A deal is easier to act on when the quote, what arrived and how an issue ended stay connected.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
          <Reveal delay={0.08} className="md:col-span-2 lg:col-span-7">
            <Card minHeight="min-h-[280px]" surface="panel" label="A deal timeline" title="Move from quote to outcome without losing the relationship between the events." />
          </Reveal>
          <Reveal delay={0.16} className="lg:col-span-5">
            <Card minHeight="min-h-[280px]" surface="muted" label="Terms history" title="Compare only the terms your shop has actually recorded." />
          </Reveal>
          <Reveal delay={0.24} className="md:col-span-1 lg:col-span-6">
            <Card minHeight="min-h-[220px]" surface="muted" label="Delivery evidence" title="Keep receipt, quantity and delivery notes beside the agreement." />
          </Reveal>
          <Reveal delay={0.32} className="md:col-span-1 lg:col-span-6">
            <Card minHeight="min-h-[220px]" surface="accent" label="Resolution trail" title="Remember what was raised and what was agreed next." />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Card({
  label,
  title,
  minHeight,
  surface,
}: {
  label: string;
  title: string;
  minHeight: string;
  surface: 'panel' | 'muted' | 'accent';
}) {
  const surfaceClass =
    surface === 'panel'
      ? 'bg-[var(--surface-panel)]'
      : surface === 'accent'
        ? 'bg-[var(--accent-soft)]'
        : 'bg-[var(--surface-muted)]';

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-[var(--border-default)] p-6 md:p-8 ${minHeight} ${surfaceClass}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <h3 className="mt-8 font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--text-primary)]">
        {title}
      </h3>
    </div>
  );
}

/* ===========================================================================
   SECTION 6 — MEMORY AND ACCESS (split-image-text, permission diagram)
   =========================================================================== */

export function MemoryAndAccess() {
  return (
    <section className="relative z-10 grid grid-cols-1 items-center gap-8 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-32">
      <RevealX delay={0.08} direction="left" className="lg:col-span-6">
        <div>
          <h2 className="max-w-[12ch] text-balance font-display text-3xl font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--text-primary)] md:text-4xl lg:text-5xl">
            Private by default. Shared only on your terms.
          </h2>
          <p className="mt-5 max-w-[48ch] font-body text-base leading-relaxed text-[var(--text-secondary)]">
            Vendra keeps each shop’s deal history separate. The owner can invite staff. A supplier sees nothing
            unless the retailer chooses to share a specific record.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {[
              'Each shop has its own separate deal memory.',
              'The owner decides which staff can access records.',
              'Suppliers see only records the retailer chooses to share.',
            ].map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 font-body text-sm leading-relaxed text-[var(--text-secondary)]">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--accent)]" />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </RevealX>

      <RevealX delay={0.16} direction="right" className="lg:col-span-6">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-md)] md:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            ACCESS MODEL
          </p>
          <AccessRow
            label="Shop owner"
            status="CONTROLS SHOP ACCESS"
            className="mt-5 border-[var(--accent-border)] bg-[var(--accent-soft)]"
          />
          <AccessRow
            label="Invited team"
            status="PERMISSIONED"
            className="mt-3 border-[var(--border-subtle)] bg-[var(--surface-muted)]"
          />
          <AccessRow
            label="Supplier"
            status="NO ACCESS BY DEFAULT"
            className="mt-3 border-dashed border-[var(--border-default)] bg-transparent"
          />
        </div>
      </RevealX>
    </section>
  );
}

function AccessRow({
  label,
  status,
  className,
}: {
  label: string;
  status: string;
  className: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-4 ${className}`}>
      <span className="font-body text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        {status}
      </span>
    </div>
  );
}

/* ===========================================================================
   SECTION 7 — FAQ (split editorial, bespoke accessible accordion)
   =========================================================================== */

const FAQ = [
  {
    question: 'What does Vendra remember?',
    answer:
      'The supplier deal details your shop saves: the quote, accepted terms, delivery, issues and recorded resolutions. Answers link back to those records.',
  },
  {
    question: 'Do I need to stop using WhatsApp?',
    answer:
      'No. Vendra is designed to sit alongside the way you already speak with suppliers. Save the relevant message, note or evidence with the deal.',
  },
  {
    question: 'Can a supplier see my notes?',
    answer: 'Not by default. A supplier has no access to your shop’s memory. You choose if and what to share.',
  },
  {
    question: 'Will Vendra order stock or message a supplier for me?',
    answer:
      'No. Vendra can prepare a sourced follow-up draft. You review it and decide what to send or buy.',
  },
  {
    question: 'What if Vendra cannot find a previous deal?',
    answer: 'It should say that no saved record was found. It must not guess a price, term or outcome.',
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));

  const toggle = (index: number) => {
    // Multiple answers may stay open. Opening one never closes another.
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <section id="faq" className="relative z-10 py-20 md:py-28 lg:py-32">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-5 md:px-8 lg:grid-cols-12 lg:gap-12 lg:px-12">
        <Reveal delay={0.08} className="lg:col-span-4">
          <div>
            <h2 className="max-w-[9ch] font-display text-3xl font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--text-primary)] md:text-4xl lg:text-5xl">
              Questions before the next order?
            </h2>
            <p className="mt-4 max-w-[30ch] font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
              Answers describe how Vendra behaves, including where it will refuse to answer.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.16} className="lg:col-span-8">
          <div className="border-t border-[var(--border-default)]">
            {FAQ.map((item, index) => {
              const expanded = open.has(index);
              const panelId = `faq-panel-${index}`;
              const buttonId = `faq-button-${index}`;

              return (
                <div key={item.question} className="border-b border-[var(--border-default)]">
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => toggle(index)}
                      className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left font-body text-base font-semibold text-[var(--text-primary)] transition-colors duration-[120ms] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] md:text-lg"
                    >
                      {item.question}
                      <ChevronIcon expanded={expanded} />
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        key="panel"
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[68ch] pb-5 pr-8 font-body text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ===========================================================================
   SECTION 8 — FINAL CTA (footer-video recipe, same persistent video)
   =========================================================================== */

export function FinalCta() {
  return (
    <section id="final-cta" className="relative z-10 overflow-hidden bg-[var(--surface-subtle)] py-24 md:py-32 lg:py-40">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-end gap-8 px-5 md:px-8 lg:grid-cols-12 lg:px-12">
        <div className="lg:col-span-8">
          <Reveal delay={0.08}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
              START WITH ONE DEAL
            </p>
            <h2 className="mt-3 max-w-[13ch] font-display text-4xl font-semibold leading-[0.94] tracking-[-0.04em] text-[var(--text-primary)] sm:text-5xl md:text-6xl">
              Bring the last supplier conversation into the next one.
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-4 max-w-[44ch] font-body text-base leading-relaxed text-[var(--text-secondary)]">
              Record one real deal this week. Then ask Vendra about it in a few days and see whether the answer
              comes back with the source record attached.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.24} className="lg:col-span-4 lg:justify-self-end">
          <Link
            href="/app"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-body text-sm font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-sm)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Try Vendra
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ===========================================================================
   SECTION 9 — FOOTER
   =========================================================================== */

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--border-default)] bg-[var(--surface-glass)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 py-8 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
        <div>
          <p className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Vendra
          </p>
          <p className="mt-2 max-w-[38ch] font-body text-xs leading-relaxed text-[var(--text-muted)]">
            A private memory for the supplier deals your shop wants to remember.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
          <a href="#deal-timeline" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] transition-colors duration-[120ms] hover:text-[var(--accent)]">
            How it works
          </a>
          <a href="#faq" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] transition-colors duration-[120ms] hover:text-[var(--accent)]">
            FAQ
          </a>
          <Link href="/privacy" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] transition-colors duration-[120ms] hover:text-[var(--accent)]">
            Privacy
          </Link>
        </nav>
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 pb-8 md:px-8 lg:px-12">
        <p className="border-t border-[var(--border-subtle)] pt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          © 2026 Vendra
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Starting in Delta State
        </p>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------------------
   Icons — inline SVG only, decorative.
   --------------------------------------------------------------------------- */

function ChevronIcon({ expanded = false }: { expanded?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-[var(--accent)] transition-transform duration-[220ms] ${expanded ? 'rotate-180' : 'rotate-0'}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}