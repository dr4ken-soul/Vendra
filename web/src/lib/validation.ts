/**
 * Request validation.
 *
 * Every route parses its input through a Zod schema so an untrusted body can
 * never reach the domain layer, and so field-level errors can be returned
 * without leaking internals.
 */

import { z } from 'zod';

const uuid = z.string().uuid('That identifier is not valid.');

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} character${min === 1 ? '' : 's'}.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === undefined || v === null ? null : v));

/** Decimal quantity. Rejects negatives and NaN, which Postgres would refuse. */
const quantity = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : Number.parseFloat(v)))
  .refine((n) => Number.isFinite(n) && n >= 0, 'Enter a valid quantity.')
  .refine((n) => n > 0, 'Quantity must be more than zero.')
  .nullable()
  .optional();

const receivedQuantity = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : Number.parseFloat(v)))
  .refine((n) => Number.isFinite(n) && n >= 0, 'Enter a valid received quantity.')
  .nullable()
  .optional();

/** Monetary amount. Two decimal places, never negative. */
const money = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : Number.parseFloat(v)))
  .refine((n) => Number.isFinite(n) && n >= 0, 'Enter a valid amount.')
  .refine((n) => Math.round(n * 100) === n * 100, 'Use at most two decimal places.')
  .nullable()
  .optional();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker so the format is valid.')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'That date is not valid.');

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'That date and time is not valid.');

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

export const createShopSchema = z.object({
  name: trimmed(2, 120, 'Shop name'),
  marketArea: optionalTrimmed(120, 'Market or area'),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Currency must be a three-letter code such as NGN.')
    .default('NGN'),
  timezone: trimmed(1, 64, 'Timezone').default('Africa/Lagos'),
});

export const updateShopSchema = z.object({
  name: trimmed(2, 120, 'Shop name').optional(),
  marketArea: optionalTrimmed(120, 'Market or area'),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Currency must be a three-letter code such as NGN.')
    .optional(),
  timezone: trimmed(1, 64, 'Timezone').optional(),
});

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export const createSupplierSchema = z.object({
  displayName: trimmed(1, 160, 'Supplier name'),
  phone: optionalTrimmed(40, 'Phone number'),
  notes: optionalTrimmed(4000, 'Note'),
});

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export const dealLineSchema = z.object({
  productLabel: trimmed(1, 160, 'Product or item'),
  quotedQuantity: quantity,
  quotedUnitPrice: money,
  agreedQuantity: quantity,
  agreedUnitPrice: money,
  unitLabel: optionalTrimmed(40, 'Unit'),
});

export const dealLinesSchema = z.array(dealLineSchema).min(1, 'Add at least one item.').max(60, 'A deal can hold up to 60 items.');

export const createDealSchema = z.object({
  supplierId: uuid,
  dealDate: isoDate,
  headline: optionalTrimmed(200, 'Deal summary'),
  externalReference: optionalTrimmed(120, 'Your reference'),
  expectedDeliveryAt: isoDateTime.nullable().optional(),
  deliveryNote: optionalTrimmed(2000, 'Delivery note'),
  /** When false the deal is saved as a quote without implying agreement. */
  termsAgreed: z.boolean().default(false),
  lines: dealLinesSchema,
  /** Draft saves skip event creation entirely. */
  saveAsDraft: z.boolean().default(false),
});

export const updateDealSchema = z.object({
  headline: optionalTrimmed(200, 'Deal summary'),
  externalReference: optionalTrimmed(120, 'Your reference'),
  expectedDeliveryAt: isoDateTime.nullable().optional(),
  deliveryNote: optionalTrimmed(2000, 'Delivery note'),
  dealDate: isoDate.optional(),
  lines: dealLinesSchema.optional(),
});

// ---------------------------------------------------------------------------
// Deal events
// ---------------------------------------------------------------------------

export const dealEventTypeSchema = z.enum([
  'quote_received',
  'terms_agreed',
  'delivery_checked',
  'issue_opened',
  'resolution_recorded',
  'correction',
  'note_added',
]);

export const createEventSchema = z
  .object({
    eventType: dealEventTypeSchema,
    occurredAt: isoDateTime.optional(),
    summary: trimmed(3, 2000, 'What happened'),
    quotedTotal: money,
    agreedTotal: money,
    receivedTotal: money,
    issueType: optionalTrimmed(80, 'Issue type'),
    condition: optionalTrimmed(80, 'Condition'),
    resolutionOutcome: optionalTrimmed(1000, 'Outcome agreed'),
    outcomeCode: optionalTrimmed(80, 'Outcome'),
    evidenceIds: z.array(uuid).max(20, 'Attach up to 20 files to one event.').optional(),
    /** Present only on a correction. */
    supersedesEventId: uuid.nullable().optional(),
    /** Per-line received quantities for a delivery check. */
    receivedLines: z
      .array(
        z.object({
          lineId: uuid,
          receivedQuantity,
        }),
      )
      .max(60)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.eventType === 'delivery_checked' && value.receivedTotal === undefined && !value.receivedLines?.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['receivedTotal'],
        message: 'Record what arrived, even if it is zero.',
      });
    }
    if (value.eventType === 'issue_opened' && !value.issueType) {
      ctx.addIssue({
        code: 'custom',
        path: ['issueType'],
        message: 'Choose what kind of issue this was.',
      });
    }
    if (value.eventType === 'resolution_recorded' && !value.resolutionOutcome) {
      ctx.addIssue({
        code: 'custom',
        path: ['resolutionOutcome'],
        message: 'Record the outcome that was agreed.',
      });
    }
    if (value.eventType === 'correction' && !value.supersedesEventId) {
      ctx.addIssue({
        code: 'custom',
        path: ['supersedesEventId'],
        message: 'A correction must reference the record it replaces.',
      });
    }
  });

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export const ALLOWED_EVIDENCE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

export const requestUploadSchema = z.object({
  dealId: uuid,
  eventId: uuid.nullable().optional(),
  fileName: trimmed(1, 255, 'File name'),
  contentType: z.enum(ALLOWED_EVIDENCE_TYPES, {
    message: 'Attach a JPEG, PNG, WebP, HEIC or PDF file.',
  }),
  byteSize: z
    .number()
    .int('File size must be a whole number of bytes.')
    .positive('The file appears to be empty.')
    .max(MAX_EVIDENCE_BYTES, 'Files must be 25 MB or smaller.'),
});

export const completeUploadSchema = z.object({
  objectKey: trimmed(1, 400, 'Object key'),
  dealId: uuid,
  eventId: uuid.nullable().optional(),
  fileName: trimmed(1, 255, 'File name'),
  contentType: z.enum(ALLOWED_EVIDENCE_TYPES),
  byteSize: z.number().int().positive().max(MAX_EVIDENCE_BYTES),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'The file checksum could not be verified.')
    .optional(),
});

// ---------------------------------------------------------------------------
// Assistant
// ---------------------------------------------------------------------------

export const recallRequestSchema = z.object({
  question: trimmed(3, 1000, 'Question'),
  sessionId: uuid.nullable().optional(),
  shopId: uuid
    .nullable()
    .optional()
    .describe('A hint only. The server derives the authorised shop from the session.'),
});

export const draftRequestSchema = z.object({
  dealId: uuid,
  selectedEventIds: z.array(uuid).min(1, 'Select at least one saved record.').max(40),
  goal: trimmed(3, 500, 'What you want the message to ask for'),
});

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.'),
  role: z.enum(['manager', 'staff'], {
    message: 'Choose Manager or Staff.',
  }),
});

export const updateMemberSchema = z.object({
  role: z.enum(['manager', 'staff']).optional(),
  permissions: z
    .array(
      z.enum([
        'deal.view',
        'deal.create',
        'deal.edit',
        'deal.event',
        'evidence.view',
        'evidence.upload',
        'supplier.manage',
        'assistant.ask',
        'memory.retry',
        'team.view',
        'team.manage',
        'settings.manage',
        'privacy.export',
        'privacy.erase',
      ]),
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

export const erasureRequestSchema = z.object({
  confirmShopName: trimmed(2, 120, 'Shop name'),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum([
    'draft',
    'quoted',
    'agreed',
    'part_delivered',
    'delivered',
    'issue_open',
    'resolved',
    'cancelled',
  ]).optional(),
  supplierId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});