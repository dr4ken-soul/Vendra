/**
 * Where a confirmation link is allowed to send someone.
 *
 * Both functions were inline in the route and the sign-in form, which meant the
 * open-redirect guard had no test at all. That is the wrong way round for the one
 * value in this flow that arrives from a link and is therefore attacker-supplied.
 */
import { describe, expect, it } from 'vitest';
import { safeDestination, isEmailShaped } from '../../web/src/lib/auth-redirect';

describe('safeDestination', () => {
  it('keeps an ordinary same-origin path', () => {
    expect(safeDestination('/app')).toBe('/app');
  });

  it('keeps a nested path with a query', () => {
    expect(safeDestination('/app?shop=abc')).toBe('/app?shop=abc');
  });

  it('refuses a protocol-relative host', () => {
    // "//evil.example" is the shape a crafted link uses to leave the origin while
    // still looking like a path. It is the case that matters.
    expect(safeDestination('//evil.example')).toBe('/app');
    expect(safeDestination('//evil.example/app')).toBe('/app');
  });

  it('refuses an absolute URL', () => {
    expect(safeDestination('https://evil.example/app')).toBe('/app');
    expect(safeDestination('http://evil.example')).toBe('/app');
  });

  it('refuses a scheme that is not http', () => {
    expect(safeDestination('javascript:alert(1)')).toBe('/app');
    expect(safeDestination('data:text/html,<script>')).toBe('/app');
  });

  it('falls back when there is nothing to go on', () => {
    expect(safeDestination(null)).toBe('/app');
    expect(safeDestination(undefined)).toBe('/app');
    expect(safeDestination('')).toBe('/app');
  });

  it('refuses a backslash form, which some parsers normalise to a host', () => {
    expect(safeDestination('/\\evil.example')).toBe('/app');
  });
});

describe('isEmailShaped', () => {
  it('accepts ordinary addresses', () => {
    expect(isEmailShaped('retailer@example.com')).toBe(true);
    expect(isEmailShaped('vendraagent@gmail.com')).toBe(true);
  });

  it('rejects values that are not addresses', () => {
    expect(isEmailShaped('not-an-address')).toBe(false);
    expect(isEmailShaped('two@@example.com')).toBe(false);
    expect(isEmailShaped('has space@example.com')).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(isEmailShaped(null)).toBe(false);
    expect(isEmailShaped(undefined)).toBe(false);
    expect(isEmailShaped('')).toBe(false);
  });

  it('is a shape check, not an existence check', () => {
    // This is the property that keeps the code screen from becoming an account
    // oracle: an address that cannot exist is accepted exactly like one that can,
    // so nothing is revealed by the page rendering.
    expect(isEmailShaped('nobody@nowhere.invalid')).toBe(true);
  });
});