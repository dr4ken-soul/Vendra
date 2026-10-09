/**
 * Small helpers shared by the confirmation route and the sign-in form.
 *
 * They live here rather than inline because both are security-relevant and both
 * were previously untestable: `safeDestination` decides where a link in an email
 * is allowed to send someone, and the shape check decides whose address a code
 * screen will claim to be for.
 */

/**
 * A destination that came from a link, reduced to a same-origin relative path.
 *
 * Anything absolute, protocol-relative (`//evil.example`), or otherwise capable of
 * leaving the origin collapses to `/app`. A confirmation link is attacker-visible
 * in the sense that its `next` parameter is user-supplied, so it is treated as
 * untrusted input rather than as a route.
 *
 * Backslashes are rejected outright. `/\evil.example` passes a naive `//` check,
 * because it starts with a single slash — but browsers normalise `\` to `/` when
 * parsing a URL, so it resolves to a protocol-relative host and leaves the origin.
 * That is a real hole, not a theoretical one, and it was found by a test rather
 * than by reading the code.
 */
export function safeDestination(next: string | null | undefined): string {
  if (!next) return '/app';
  if (next.includes('\\')) return '/app';
  if (!next.startsWith('/')) return '/app';
  if (next.startsWith('//')) return '/app';
  return next;
}

/**
 * Whether a string is shaped like an email address.
 *
 * This says nothing about whether the address exists, has an account, or is
 * reachable. It exists so a code screen opened from a link does not render
 * arbitrary text as the address it is about to verify a code for.
 *
 * Deliberately permissive and deliberately not a validator: the server's schema
 * is the real gate, and a stricter rule here would reject valid addresses for no
 * security benefit.
 */
export function isEmailShaped(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^[^@\s]+@[^@\s]+$/.test(value);
}