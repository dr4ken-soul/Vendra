/**
 * API error handling and rate limiting.
 *
 * Every failure path must state which operation failed and what the user can do
 * next, per FRONTEND_SPEC.md section 4.9. Internal detail is never returned to
 * the browser.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { MissingEnvError } from '@/lib/env';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Field-level messages keyed by form field name. */
    fields?: Record<string, string>;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    code: string,
    message: string,
    status: number,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }

  static unauthorized(message = 'Sign in to continue.'): ApiError {
    return new ApiError('unauthorized', message, 401);
  }

  static forbidden(message = 'You do not have permission to do that.'): ApiError {
    return new ApiError('forbidden', message, 403);
  }

  static notFound(message = 'That record was not found.'): ApiError {
    return new ApiError('not_found', message, 404);
  }

  /** Used when a client supplies another shop's identifier. */
  static foreignScope(): ApiError {
    return new ApiError(
      'foreign_scope',
      'That record belongs to a different shop and could not be loaded.',
      403,
    );
  }

  static validation(message: string, fields?: Record<string, string>): ApiError {
    return new ApiError('validation_failed', message, 422, fields);
  }

  static conflict(message: string): ApiError {
    return new ApiError('conflict', message, 409);
  }

  static rateLimited(retryAfterSeconds: number): ApiError {
    return new ApiError(
      'rate_limited',
      `Too many requests. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`,
      429,
    );
  }

  static unavailable(operation: string, detail: string): ApiError {
    return new ApiError(
      'service_unavailable',
      `${operation} is temporarily unavailable. ${detail}`,
      503,
    );
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

function fieldsFromZod(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Convert any thrown value into a safe JSON response. */
export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return NextResponse.json(error.toBody(), {
      status: error.status,
      headers: error.code === 'rate_limited' ? { 'Retry-After': '30' } : undefined,
    });
  }

  if (error instanceof ZodError) {
    const fields = fieldsFromZod(error);
    return NextResponse.json(
      {
        error: {
          code: 'validation_failed',
          message: 'Some details need fixing before this can be saved.',
          fields,
        },
      } satisfies ApiErrorBody,
      { status: 422 },
    );
  }

  if (error instanceof MissingEnvError) {
    // The server is misconfigured. Report it as an operator problem, not a
    // user problem, and do not leak the variable names to the browser.
    console.error('[vendra] missing environment configuration', error.names);
    return NextResponse.json(
      {
        error: {
          code: 'service_unavailable',
          message:
            'This part of Vendra is not configured in this environment yet. Your saved deals are unaffected.',
        },
      } satisfies ApiErrorBody,
      { status: 503 },
    );
  }

  // The Supabase client throws before any of our own validation when the
  // project URL or anon key is missing. That is a deployment problem, so it is
  // reported as one rather than as an internal error.
  if (
    error instanceof Error &&
    /URL and Key are required|supabaseUrl is required/i.test(error.message)
  ) {
    console.error('[vendra] Supabase client could not be created: env vars are missing');
    return NextResponse.json(
      {
        error: {
          code: 'service_unavailable',
          message:
            'Vendra is not connected to a database in this environment yet. Records cannot be saved until it is configured.',
        },
      } satisfies ApiErrorBody,
      { status: 503 },
    );
  }

  console.error('[vendra] unhandled error', error);
  return NextResponse.json(
    {
      error: {
        code: 'internal_error',
        message: 'Something went wrong on our side. Your work has not been lost — try again.',
      },
    } satisfies ApiErrorBody,
    { status: 500 },
  );
}

/** Wrap a route handler so a thrown error always becomes a safe response. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

// ---------------------------------------------------------------------------
// Rate limiting.
//
// A process-local fixed-window limiter. It is a guardrail against casual
// abuse on a single host, not a distributed quota. The documented limits match
// DATA_API_CONTRACTS.md section 5 and must be tuned from pilot traffic.
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>();

// Bound memory so an unbounded key space cannot leak.
const MAX_BUCKETS = 10_000;

function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimit {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  shopCreate: { limit: 5, windowMs: 60 * 60 * 1000 },
  list: { limit: 60, windowMs: 60 * 1000 },
  supplierWrite: { limit: 30, windowMs: 60 * 1000 },
  dealWrite: { limit: 30, windowMs: 60 * 1000 },
  uploadRequest: { limit: 10, windowMs: 60 * 1000 },
  uploadComplete: { limit: 20, windowMs: 60 * 1000 },
  assistant: { limit: 10, windowMs: 60 * 1000 },
  memoryRetry: { limit: 5, windowMs: 60 * 1000 },
  erasure: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimit>;

/**
 * Consume one unit of quota for a subject.
 * Throws ApiError.rateLimited when the window is exhausted.
 */
export function rateLimit(subject: string, limit: RateLimit): void {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(subject);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(subject, { count: 1, resetAt: now + limit.windowMs });
    return;
  }

  if (bucket.count >= limit.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw ApiError.rateLimited(retryAfter);
  }

  bucket.count += 1;
}

/** Test seam. */
export function __resetRateLimits() {
  buckets.clear();
}