/**
 * Formatting helpers. British English throughout.
 *
 * Every date shown to a retailer is formatted with an explicit time zone so a
 * deal date never shifts because the browser is set to another region.
 */

const DEFAULT_TIMEZONE = 'Africa/Lagos';

export function formatDate(value: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return 'Not recorded';
  // A bare YYYY-MM-DD is a shop-local calendar date. Parse it as UTC midnight
  // and read it back in the shop's zone so it cannot slip a day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(date);
}

export function formatDateTime(value: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

/**
 * Relative phrasing for "last event" style labels. Falls back to an absolute
 * date once the gap stops being useful, so the value is never ambiguous.
 */
export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';

  const diffMs = now - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  const hours = Math.round(diffMs / 3_600_000);
  const days = Math.round(diffMs / 86_400_000);

  if (Math.abs(minutes) < 1) return 'Just now';
  if (Math.abs(minutes) < 60) return `${minutes < 0 ? 'in ' : ''}${Math.abs(minutes)} min${Math.abs(minutes) === 1 ? '' : 's'}${minutes > 0 ? ' ago' : ''}`;
  if (Math.abs(hours) < 24) return `${hours < 0 ? 'in ' : ''}${Math.abs(hours)} hour${Math.abs(hours) === 1 ? '' : 's'}${hours > 0 ? ' ago' : ''}`;
  if (Math.abs(days) <= 30) return `${days < 0 ? 'in ' : ''}${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}${days > 0 ? ' ago' : ''}`;

  return formatDate(value);
}

/**
 * Money. Never silently converts currency; the code always accompanies the
 * amount so a mixed-currency register cannot mislead.
 */
/**
 * Money.
 *
 * The third parameter is accepted so every call site can pass the shop's time
 * zone uniformly, but currency formatting is not date-bound and no time zone is
 * applied. The currency code always accompanies the amount so a mixed-currency
 * register cannot mislead.
 */
export function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return 'Not recorded';

  try {
    // Currency formatting is not date-bound, so no time zone is passed.
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown code must not blank the value.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatQuantity(
  quantity: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (quantity === null || quantity === undefined) return 'Not recorded';
  const trimmed = Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(3)));
  return unit ? `${trimmed} ${unit}` : trimmed;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Today's calendar date in the shop's zone, as YYYY-MM-DD. */
export function todayInputValue(timeZone = DEFAULT_TIMEZONE): string {
  const now = new Date();
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(now);
}