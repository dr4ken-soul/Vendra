import type { DealStatus, DealEventType, MemorySyncStatus } from '@/lib/types';

/**
 * Status presentation.
 *
 * FRONTEND_SPEC 4.5 requires every status to carry a TEXT label as well as a
 * colour. Colour alone is never the carrier of meaning.
 */

export function DealStatusLabel(status: DealStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'quoted':
      return 'Quote saved';
    case 'agreed':
      return 'Terms agreed';
    case 'part_delivered':
      return 'Part delivered';
    case 'delivered':
      return 'Delivered';
    case 'issue_open':
      return 'Issue open';
    case 'resolved':
      return 'Resolved';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function dealStatusTone(status: DealStatus) {
  switch (status) {
    case 'draft':
      return 'neutral' as const;
    case 'quoted':
      return 'info' as const;
    case 'agreed':
      return 'accent' as const;
    case 'part_delivered':
      return 'warning' as const;
    case 'delivered':
      return 'success' as const;
    case 'issue_open':
      return 'error' as const;
    case 'resolved':
      return 'success' as const;
    case 'cancelled':
      return 'neutral' as const;
  }
}

export function EventTypeLabel(type: DealEventType): string {
  switch (type) {
    case 'quote_received':
      return 'Quote received';
    case 'terms_agreed':
      return 'Terms agreed';
    case 'delivery_checked':
      return 'Delivery checked';
    case 'issue_opened':
      return 'Issue opened';
    case 'resolution_recorded':
      return 'Resolution recorded';
    case 'correction':
      return 'Correction';
    case 'note_added':
      return 'Note added';
  }
}

export function MemorySyncLabel(status: MemorySyncStatus | string): string {
  switch (status) {
    case 'queued':
      return 'Memory syncing';
    case 'processing':
      return 'Memory syncing';
    case 'ready':
      return 'Memory ready';
    case 'failed':
      return 'Memory needs attention';
    case 'superseded':
      return 'Memory replaced';
    case 'deletion_pending':
      return 'Memory pending deletion';
    default:
      return 'Memory pending';
  }
}

export function memoryTone(status: MemorySyncStatus | string) {
  switch (status) {
    case 'ready':
      return 'success' as const;
    case 'processing':
    case 'queued':
      return 'info' as const;
    case 'failed':
      return 'error' as const;
    case 'superseded':
      return 'neutral' as const;
    case 'deletion_pending':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}

export const DEAL_STATUS_FILTERS: Array<{ value: DealStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'quoted', label: 'Quote saved' },
  { value: 'agreed', label: 'Terms agreed' },
  { value: 'part_delivered', label: 'Part delivered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'issue_open', label: 'Issue open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const EVENT_TYPES: DealEventType[] = [
  'quote_received',
  'terms_agreed',
  'delivery_checked',
  'issue_opened',
  'resolution_recorded',
  'note_added',
];