/**
 * The Supabase error to retailer-facing message mapping.
 *
 * Every case below is a response captured from the live project by
 * `web/scripts/probe-otp-error.mjs`, not a shape invented for the test. That is
 * the point: the previous version of this mapping tested the message text for
 * `/is invalid/i`, which matches Supabase's real OTP failure message
 * "Token has expired or is invalid", so every wrong or expired code was
 * reported as an unconfigured email service.
 */
import { describe, expect, it } from 'vitest';
import { describeAuthError } from '../../web/src/lib/auth-errors';

/** Captured from the live project. */
const LIVE = {
  otpExpired: {
    code: 'otp_expired',
    message: 'Token has expired or is invalid',
  },
  duplicateSignUp: {
    code: 'over_email_send_rate_limit',
    message: 'For security purposes, you can only request this after 58 seconds.',
  },
  builtInSender: {
    code: 'email_address_invalid',
    message: 'Email address invalid',
  },
} as const;

describe('describeAuthError', () => {
  it('reports a wrong code as a wrong code, not as a mail configuration problem', () => {
    // This is the regression. The message must not mention SMTP, the built-in
    // sender, or connecting an email service.
    const { error } = describeAuthError(LIVE.otpExpired, 'verify');
    expect(error).toMatch(/code is not right|expired/i);
    expect(error).not.toMatch(/built-in email sender/i);
    expect(error).not.toMatch(/email service/i);
    expect(error).not.toMatch(/Supabase/i);
  });

  it('does not confuse an expired code with a refused address', () => {
    const otp = describeAuthError(LIVE.otpExpired, 'verify').error;
    const address = describeAuthError(LIVE.builtInSender, 'signup').error;
    expect(otp).not.toBe(address);
  });

  it('reports a per-address cooldown as "wait", not as an hourly cap', () => {
    const { error } = describeAuthError(LIVE.duplicateSignUp, 'resend');
    expect(error).toMatch(/wait/i);
    expect(error).not.toMatch(/two messages an hour/i);
    expect(error).not.toMatch(/built-in/i);
  });

  it('does not tell the reader to connect an email service', () => {
    // Every message this module can produce must stay true after SMTP is
    // configured, because these strings outlive any particular provider setup.
    const cases = [
      LIVE.otpExpired,
      LIVE.duplicateSignUp,
      LIVE.builtInSender,
      { code: 'user_already_exists', message: 'User already registered' },
      { code: 'invalid_credentials', message: 'Invalid login credentials' },
      { code: 'email_not_confirmed', message: 'Email not confirmed' },
      { code: '', message: 'Token has expired or is invalid' },
    ] as const;

    for (const c of cases) {
      for (const context of ['signin', 'signup', 'verify', 'resend'] as const) {
        const { error } = describeAuthError(c, context);
        expect(error).not.toMatch(/built-in email sender/i);
        expect(error).not.toMatch(/an email service needs to be connected/i);
      }
    }
  });

  it('prefers the code over the prose when both are present', () => {
    // A code is a stable enum; prose is not. When they disagree the code wins,
    // because that is the field Supabase actually contracts on.
    const { error } = describeAuthError(
      { code: 'otp_expired', message: 'Email address invalid' },
      'verify',
    );
    expect(error).toMatch(/code is not right|expired/i);
  });

  it('falls back to prose only when there is no code', () => {
    const { error } = describeAuthError({ code: '', message: 'Token has expired or is invalid' }, 'verify');
    expect(error).toMatch(/code is not right|expired/i);
  });

  it('does not guess when neither code nor prose identifies the failure', () => {
    const { error } = describeAuthError({ code: 'some_new_code', message: 'something new' }, 'verify');
    expect(error).toMatch(/could not do that/i);
  });

  it('puts an unconfirmed account back on the code step', () => {
    expect(describeAuthError({ code: 'email_not_confirmed', message: '' }, 'signin').stage).toBe('code');
  });

  it('maps a known code to its own message', () => {
    expect(describeAuthError({ code: 'user_already_exists', message: '' }, 'signup').error).toMatch(
      /already uses that email/i,
    );
    expect(describeAuthError({ code: 'invalid_credentials', message: '' }, 'signin').error).toMatch(
      /did not match/i,
    );
  });
});