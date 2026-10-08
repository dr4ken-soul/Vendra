/**
 * Input validation.
 *
 * An untrusted body must never reach the domain layer. These tests pin the
 * rules that matter for correctness: positive quantities, valid currencies,
 * bounded line counts, and a correction that must name the record it replaces.
 */
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_EVIDENCE_TYPES,
  MAX_EVIDENCE_BYTES,
  createDealSchema,
  createEventSchema,
  createShopSchema,
  listQuerySchema,
  requestUploadSchema,
} from '@/lib/validation';

const UUID = '11111111-1111-4111-8111-111111111111';

const validLine = {
  productLabel: 'Tomato paste',
  quotedQuantity: '20',
  unitLabel: 'carton',
  quotedUnitPrice: '18400',
};

const validDeal = {
  supplierId: UUID,
  dealDate: '2026-03-04',
  lines: [validLine],
};

describe('createShopSchema', () => {
  it('accepts a realistic shop', () => {
    const result = createShopSchema.safeParse({
      name: 'Amina Provisions',
      marketArea: 'Warri market',
      currencyCode: 'NGN',
      timezone: 'Africa/Lagos',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a name shorter than two characters', () => {
    expect(createShopSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('defaults currency and timezone rather than requiring them', () => {
    const result = createShopSchema.parse({ name: 'Amina Provisions' });
    expect(result.currencyCode).toBe('NGN');
    expect(result.timezone).toBe('Africa/Lagos');
  });

  it('rejects a lowercase currency code', () => {
    expect(createShopSchema.safeParse({ name: 'Shop', currencyCode: 'ngn' }).success).toBe(false);
  });
});

describe('createDealSchema', () => {
  it('accepts a valid deal', () => {
    expect(createDealSchema.safeParse(validDeal).success).toBe(true);
  });

  it('rejects a deal with no items', () => {
    expect(createDealSchema.safeParse({ ...validDeal, lines: [] }).success).toBe(false);
  });

  it('rejects a zero or negative quantity', () => {
    expect(
      createDealSchema.safeParse({ ...validDeal, lines: [{ ...validLine, quotedQuantity: '0' }] }).success,
    ).toBe(false);
    expect(
      createDealSchema.safeParse({ ...validDeal, lines: [{ ...validLine, quotedQuantity: '-5' }] }).success,
    ).toBe(false);
  });

  it('rejects a negative price', () => {
    expect(
      createDealSchema.safeParse({ ...validDeal, lines: [{ ...validLine, quotedUnitPrice: '-1' }] }).success,
    ).toBe(false);
  });

  it('rejects a price with more than two decimal places', () => {
    expect(
      createDealSchema.safeParse({ ...validDeal, lines: [{ ...validLine, quotedUnitPrice: '1.234' }] }).success,
    ).toBe(false);
  });

  it('rejects a non-numeric quantity rather than coercing it to zero', () => {
    expect(
      createDealSchema.safeParse({ ...validDeal, lines: [{ ...validLine, quotedQuantity: 'many' }] }).success,
    ).toBe(false);
  });

  it('rejects a malformed deal date', () => {
    expect(createDealSchema.safeParse({ ...validDeal, dealDate: '04/03/2026' }).success).toBe(false);
  });

  it('rejects an invalid supplier id', () => {
    expect(createDealSchema.safeParse({ ...validDeal, supplierId: 'not-a-uuid' }).success).toBe(false);
  });

  it('coerces numeric strings to numbers', () => {
    const result = createDealSchema.parse(validDeal);
    expect(result.lines[0].quotedQuantity).toBe(20);
    expect(result.lines[0].quotedUnitPrice).toBe(18400);
  });

  it('defaults saveAsDraft and termsAgreed to false', () => {
    const result = createDealSchema.parse(validDeal);
    expect(result.saveAsDraft).toBe(false);
    expect(result.termsAgreed).toBe(false);
  });
});

describe('createEventSchema', () => {
  it('accepts a delivery check with received lines', () => {
    const result = createEventSchema.safeParse({
      eventType: 'delivery_checked',
      summary: 'Checked delivery.',
      receivedLines: [{ lineId: UUID, receivedQuantity: 16 }],
    });
    expect(result.success).toBe(true);
  });

  it('requires a received quantity or received lines on a delivery check', () => {
    const result = createEventSchema.safeParse({
      eventType: 'delivery_checked',
      summary: 'Checked delivery.',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a delivery check reporting zero received', () => {
    // Nothing arrived. That is a real, recordable fact.
    const result = createEventSchema.safeParse({
      eventType: 'delivery_checked',
      summary: 'Nothing arrived.',
      receivedTotal: 0,
    });
    expect(result.success).toBe(true);
  });

  it('requires an issue type when opening an issue', () => {
    const result = createEventSchema.safeParse({
      eventType: 'issue_opened',
      summary: 'Two cartons short.',
    });
    expect(result.success).toBe(false);
  });

  it('requires an outcome when recording a resolution', () => {
    const result = createEventSchema.safeParse({
      eventType: 'resolution_recorded',
      summary: 'Supplier agreed to deliver.',
    });
    expect(result.success).toBe(false);
  });

  it('requires a correction to name the record it replaces', () => {
    const result = createEventSchema.safeParse({
      eventType: 'correction',
      summary: 'Corrected the agreed quantity.',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a correction that names its source', () => {
    const result = createEventSchema.safeParse({
      eventType: 'correction',
      summary: 'Corrected the agreed quantity.',
      supersedesEventId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown event type', () => {
    expect(
      createEventSchema.safeParse({ eventType: 'something_else', summary: 'x'.repeat(5) }).success,
    ).toBe(false);
  });

  it('rejects a summary that is too short to be meaningful', () => {
    expect(createEventSchema.safeParse({ eventType: 'note_added', summary: 'ab' }).success).toBe(false);
  });
});

describe('requestUploadSchema', () => {
  const valid = {
    dealId: UUID,
    fileName: 'quote.jpg',
    contentType: 'image/jpeg',
    byteSize: 1024,
  };

  it('accepts an allowed type', () => {
    expect(requestUploadSchema.safeParse(valid).success).toBe(true);
  });

  it.each(ALLOWED_EVIDENCE_TYPES)('accepts %s', (contentType) => {
    expect(requestUploadSchema.safeParse({ ...valid, contentType }).success).toBe(true);
  });

  it('rejects a disallowed type', () => {
    expect(requestUploadSchema.safeParse({ ...valid, contentType: 'application/x-msdownload' }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ ...valid, contentType: 'text/html' }).success).toBe(false);
  });

  it('rejects a zero-byte file', () => {
    expect(requestUploadSchema.safeParse({ ...valid, byteSize: 0 }).success).toBe(false);
  });

  it('rejects a file over the size limit', () => {
    expect(requestUploadSchema.safeParse({ ...valid, byteSize: MAX_EVIDENCE_BYTES + 1 }).success).toBe(false);
  });
});

describe('listQuerySchema', () => {
  it('defaults page and pageSize', () => {
    const result = listQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('caps pageSize so a client cannot request the whole table', () => {
    expect(listQuerySchema.safeParse({ pageSize: '5000' }).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(listQuerySchema.safeParse({ status: 'teleported' }).success).toBe(false);
  });
});