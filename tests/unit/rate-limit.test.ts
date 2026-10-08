/**
 * API error handling and rate limiting.
 *
 * These are guardrails against cost abuse and accidental hammering. They are
 * process-local, so the tests reset the store between cases.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, RATE_LIMITS, __resetRateLimits, rateLimit } from '@/lib/api';

beforeEach(() => {
  __resetRateLimits();
});

describe('rateLimit', () => {
  it('allows requests up to the limit', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(() => rateLimit('subject:a', { limit: 5, windowMs: 60_000 })).not.toThrow();
    }
  });

  it('throws once the limit is exceeded', () => {
    for (let i = 0; i < 5; i += 1) rateLimit('subject:b', { limit: 5, windowMs: 60_000 });
    expect(() => rateLimit('subject:b', { limit: 5, windowMs: 60_000 })).toThrow(ApiError);
  });

  it('keeps subjects independent', () => {
    for (let i = 0; i < 5; i += 1) rateLimit('subject:c', { limit: 5, windowMs: 60_000 });

    expect(() => rateLimit('subject:d', { limit: 5, windowMs: 60_000 })).not.toThrow();
    expect(() => rateLimit('subject:c', { limit: 5, windowMs: 60_000 })).toThrow(ApiError);
  });

  it('reports a retry-after hint in seconds', () => {
    for (let i = 0; i < 3; i += 1) rateLimit('subject:e', { limit: 3, windowMs: 60_000 });

    try {
      rateLimit('subject:e', { limit: 3, windowMs: 60_000 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(429);
      expect((error as ApiError).message).toMatch(/Try again in \d+ second/);
    }
  });

  it('starts a fresh window after the previous one expires', async () => {
    for (let i = 0; i < 2; i += 1) rateLimit('subject:f', { limit: 2, windowMs: 40 });
    expect(() => rateLimit('subject:f', { limit: 2, windowMs: 40 })).toThrow();

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(() => rateLimit('subject:f', { limit: 2, windowMs: 40 })).not.toThrow();
  });
});

describe('documented limits', () => {
  it('matches the contract in DATA_API_CONTRACTS.md', () => {
    expect(RATE_LIMITS.shopCreate).toEqual({ limit: 5, windowMs: 3_600_000 });
    expect(RATE_LIMITS.assistant).toEqual({ limit: 10, windowMs: 60_000 });
    expect(RATE_LIMITS.erasure).toEqual({ limit: 3, windowMs: 86_400_000 });
    expect(RATE_LIMITS.memoryRetry).toEqual({ limit: 5, windowMs: 60_000 });
    expect(RATE_LIMITS.uploadRequest).toEqual({ limit: 10, windowMs: 60_000 });
  });
});

describe('ApiError', () => {
  it('uses a 403 and a non-revealing message for a foreign shop id', () => {
    const error = ApiError.foreignScope();
    expect(error.status).toBe(403);
    expect(error.code).toBe('foreign_scope');
    expect(error.message).not.toContain('shop_id');
  });

  it('exposes field-level validation messages', () => {
    const error = ApiError.validation('Check the form', { supplierId: 'Choose a supplier.' });
    expect(error.toBody().error.fields).toEqual({ supplierId: 'Choose a supplier.' });
  });

  it('names the failed operation for an unavailable service', () => {
    const error = ApiError.unavailable('Deal memory', 'Try again shortly.');
    expect(error.message).toContain('Deal memory');
    expect(error.status).toBe(503);
  });
});