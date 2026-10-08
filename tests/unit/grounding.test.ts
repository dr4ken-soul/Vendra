/**
 * Grounding: what the model is allowed to see, and what happens when there is
 * nothing to ground an answer in.
 *
 * A hallucinated supplier fact is the highest-severity failure mode in Vendra,
 * so these tests pin the refusal behaviour and the "no record" path.
 */
import { describe, expect, it } from 'vitest';
import {
  NO_RECORD_ANSWER,
  deterministicSummary,
  renderSourceContext,
} from '@/lib/ai/grounding';
import type { RecallSource } from '@/lib/types';

const SOURCE: RecallSource = {
  eventId: '22222222-2222-4222-8222-222222222222',
  dealId: '11111111-1111-4111-8111-111111111111',
  supplierName: 'Okonkwo Wholesale',
  eventType: 'terms_agreed',
  occurredAt: '2026-03-07T09:00:00.000Z',
  summary: 'Agreed 18 cartons at 18,000 naira per carton.',
  headline: '18 cartons of tomato paste',
  dealDate: '2026-03-04',
  currencyCode: 'NGN',
  lines: [
    {
      productLabel: 'Tomato paste',
      quotedQuantity: 20,
      agreedQuantity: 18,
      receivedQuantity: null,
      unitLabel: 'carton',
      quotedUnitPrice: 18400,
      agreedUnitPrice: 18000,
    },
  ],
  evidence: [{ id: 'e1', originalFilename: 'quote.jpg', contentType: 'image/jpeg', uploadedAt: '2026-03-04T09:00:00.000Z' }],
};

describe('renderSourceContext', () => {
  it('emits only confirmed values and labels missing ones explicitly', () => {
    const context = renderSourceContext([SOURCE]);

    expect(context).toContain('18000');
    expect(context).toContain('NGN');
    // A missing received quantity must be stated, never inferred.
    expect(context).toContain('received not recorded');
  });

  it('does not invent a received quantity when none was recorded', () => {
    const context = renderSourceContext([SOURCE]);
    expect(context).not.toMatch(/received\s+\d/);
  });

  it('includes the identifiers needed to resolve a citation back to a record', () => {
    const context = renderSourceContext([SOURCE]);
    expect(context).toContain(SOURCE.eventId);
    expect(context).toContain(SOURCE.dealId);
  });

  it('labels a deal with no evidence rather than omitting the section', () => {
    const context = renderSourceContext([{ ...SOURCE, evidence: [] }]);
    expect(context).toContain('evidence_files: none attached');
  });

  it('records a received quantity when one exists', () => {
    const received: RecallSource = {
      ...SOURCE,
      lines: [{ ...SOURCE.lines[0], receivedQuantity: 16 }],
    };
    expect(renderSourceContext([received])).toContain('received 16');
  });

  it('labels an absent headline rather than leaving a blank', () => {
    expect(renderSourceContext([{ ...SOURCE, headline: null }])).toContain('headline: not recorded');
  });
});

describe('deterministicSummary', () => {
  it('refuses to answer when there are no sources', () => {
    expect(deterministicSummary([])).toBe(NO_RECORD_ANSWER);
  });

  it('states the supplier and date from the record', () => {
    const summary = deterministicSummary([SOURCE]);
    expect(summary).toContain('Okonkwo Wholesale');
    expect(summary).toContain('2026-03-07');
  });

  it('reports that no evidence is attached rather than implying proof', () => {
    expect(deterministicSummary([{ ...SOURCE, evidence: [] }])).toContain(
      'No evidence is attached',
    );
  });

  it('uses the most recent source when several match', () => {
    const older: RecallSource = {
      ...SOURCE,
      eventId: '33333333-3333-4333-8333-333333333333',
      occurredAt: '2026-01-05T09:00:00.000Z',
      supplierName: 'Older Supplier Ltd',
    };
    const summary = deterministicSummary([older, SOURCE]);
    expect(summary).toContain('Okonkwo Wholesale');
    expect(summary).not.toContain('Older Supplier Ltd');
  });

  it('never asserts a received quantity that was not recorded', () => {
    const summary = deterministicSummary([SOURCE]);
    expect(summary).not.toMatch(/received 1[0-9]/);
  });
});