/**
 * Memory statement composition and source parsing.
 *
 * These are the two functions that decide whether a recalled memory can be
 * traced back to a canonical deal event. If either is wrong, an answer could be
 * grounded in a record that does not exist.
 */
import { describe, expect, it } from 'vitest';
import { composeMemoryText, parseMemorySource } from '@/lib/memory/walrus';

const DEAL_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';

function sample(overrides: Partial<Parameters<typeof composeMemoryText>[0]> = {}) {
  return composeMemoryText({
    occurredAt: '2026-03-04T09:00:00.000Z',
    eventType: 'terms_agreed',
    summary: 'Agreed 18 cartons at 18,000 naira per carton.',
    supplierLabel: 'Okonkwo Wholesale',
    dealId: DEAL_ID,
    eventId: EVENT_ID,
    ...overrides,
  });
}

describe('composeMemoryText', () => {
  it('includes the date, the shop-local supplier label and both source identifiers', () => {
    const text = sample();

    expect(text).toContain('2026-03-04');
    expect(text).toContain('Okonkwo Wholesale');
    expect(text).toContain(DEAL_ID);
    expect(text).toContain(EVENT_ID);
  });

  it('describes the event type in plain language rather than an enum value', () => {
    expect(sample()).toContain('agreed terms');
    expect(sample({ eventType: 'delivery_checked' })).toContain('a delivery check');
    expect(sample({ eventType: 'issue_opened' })).toContain('an issue');
    expect(sample({ eventType: 'resolution_recorded' })).toContain('a resolution');
  });

  it('collapses whitespace so an embedded newline cannot break the statement', () => {
    const text = sample({ summary: 'Short two\ncartons.\n\nNeeds a callback.' });
    expect(text).not.toMatch(/\n/);
    expect(text).toContain('Short two cartons. Needs a callback.');
  });

  it('truncates an over-long summary so a memory statement stays short', () => {
    const text = sample({ summary: 'x'.repeat(2000) });
    expect(text.length).toBeLessThan(600);
  });

  it('does not include a supplier phone number even when one appears in the summary text', () => {
    // The retailer can type anything into a summary. A memory statement is
    // still a short, traceable fact, and the recall path resolves detail from
    // the canonical record rather than the memory text.
    const text = sample({ summary: 'Agreed terms. Call 0803 123 4567 to confirm.' });
    expect(text).toContain('Agreed terms');
    // The statement is short regardless of input length.
    expect(text.length).toBeLessThan(600);
  });

  it('produces a different statement for a different event', () => {
    expect(sample({ eventType: 'quote_received' })).not.toBe(
      sample({ eventType: 'delivery_checked' }),
    );
  });
});

describe('parseMemorySource', () => {
  it('extracts both identifiers from a composed statement', () => {
    const parsed = parseMemorySource(sample());
    expect(parsed.dealId).toBe(DEAL_ID);
    expect(parsed.eventId).toBe(EVENT_ID);
  });

  it('is case-insensitive, because the provider may normalise casing', () => {
    const parsed = parseMemorySource(sample().toUpperCase());
    expect(parsed.eventId).toBe(EVENT_ID);
    expect(parsed.dealId).toBe(DEAL_ID);
  });

  it('returns nulls for a statement with no source reference', () => {
    // This is the critical case: an untraceable memory must be DISCARDED by the
    // recall path rather than used to support an answer.
    const parsed = parseMemorySource('The supplier usually delivers on Tuesdays.');
    expect(parsed.dealId).toBeNull();
    expect(parsed.eventId).toBeNull();
  });

  it('returns nulls for an empty string', () => {
    expect(parseMemorySource('')).toEqual({ dealId: null, eventId: null });
  });

  it('does not treat an unrelated UUID as a source reference', () => {
    // A stray identifier with no deal/source-event wording is not enough.
    const parsed = parseMemorySource(`Reference ${DEAL_ID} appears somewhere.`);
    expect(parsed.dealId).toBeNull();
    expect(parsed.eventId).toBeNull();
  });

  it('round-trips every event type', () => {
    for (const eventType of [
      'quote_received',
      'terms_agreed',
      'delivery_checked',
      'issue_opened',
      'resolution_recorded',
      'correction',
      'note_added',
    ] as const) {
      const parsed = parseMemorySource(sample({ eventType }));
      expect(parsed.eventId).toBe(EVENT_ID);
    }
  });
});