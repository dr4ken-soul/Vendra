/**
 * Turning a Supabase Auth error into something a retailer can act on.
 *
 * This is a separate module, not a helper inside `auth-actions.ts`, because that
 * file is `'use server'` and can only export async functions. Keeping the mapping
 * here means it can be tested directly, and it needed to be: it was quietly
 * telling retailers the wrong thing about every wrong code they entered.
 *
 * **The rule: match on `error.code`, never on prose.**
 *
 * Supabase's own message for a wrong or expired code is:
 *
 *   code    otp_expired
 *   message Token has expired or is invalid
 *
 * An earlier version tested `/is invalid/i` against the message to catch
 * `email_address_invalid`, and that pattern matches "…or is invalid" in the OTP
 * message. Because the address branch was checked first, every mistyped or
 * expired code was reported as:
 *
 *   Vendra cannot send verification email to that address right now.
 *   Supabase's built-in email sender only delivers to the operator's own email
 *   address, so an email service has to be connected before new retailers can
 *   sign up.
 *
 * which is not the cause, is no longer true of this deployment at all, and
 * advises the reader to go and do something already done. Codes are a stable
 * enum. Prose is not, and this file treats it as a last resort for responses that
 * carry no code.
 */

export interface AuthFormState {
  error: string | null;
  message: string | null;
  /**
   * Which step the form should be on.
   *
   * `code` means sign-up succeeded and a verification code was sent. The form
   * moves itself rather than sniffing `message` for a phrase, because that would
   * make a copy change break the flow.
   *
   * `verified` means a session now exists and the router should refresh.
   */
  stage?: 'details' | 'code' | 'verified';
  /** The address a code was sent to, so the form never has to guess it. */
  email?: string;
}

type Context = 'signin' | 'signup' | 'verify' | 'resend';

const CODE_MESSAGES = {
  codeWrong:
    'That code is not right, or it has expired. Check the newest email and enter that code.',
  addressRefused:
    'That email address was refused, so no code was sent. Check it for a typo, or use a different address.',
  rateLimited:
    'Too many requests. Wait about a minute, then ask for another code.',
  alreadyExists: 'An account already uses that email address. Sign in instead.',
  badCredentials: 'That email and password did not match. Check them and try again.',
  notConfirmed:
    'That account still needs its email confirmed. Enter the six-digit code we sent, or send it again.',
  generic: 'We could not do that just now. Try again.',
} as const;

/**
 * Prose fallbacks, used only when Supabase sends no code at all.
 *
 * Each is anchored to a phrase that belongs to exactly one condition. There is
 * deliberately no bare `is invalid`, which is the pattern that caused the
 * misdiagnosis above.
 */
const PROSE: ReadonlyArray<readonly [RegExp, keyof typeof CODE_MESSAGES]> = [
  [/token has expired|expired or is invalid|invalid token|otp.*expired/i, 'codeWrong'],
  [/email rate limit|only request this after|too many emails/i, 'rateLimited'],
  [/already (been )?registered|already exists|user already registered/i, 'alreadyExists'],
  [/invalid login credentials/i, 'badCredentials'],
  [/email not confirmed/i, 'notConfirmed'],
];

export function describeAuthError(
  error: { code?: string; message: string },
  context: Context,
): AuthFormState {
  const code = error.code ?? '';

  switch (code) {
    case 'otp_expired':
    case 'access_denied':
      return { error: CODE_MESSAGES.codeWrong, message: null };

    case 'over_email_send_rate_limit':
      // The code covers two different throttles: Supabase's per-address minimum
      // interval, which is what a retailer hits by asking twice, and the project's
      // hourly cap. Both are answered by waiting, and neither is fixed by the
      // reader doing anything else.
      return {
        error: context === 'verify' ? CODE_MESSAGES.rateLimited : CODE_MESSAGES.rateLimited,
        message: null,
      };

    case 'email_address_invalid':
    case 'email_address_not_allowed':
      return { error: CODE_MESSAGES.addressRefused, message: null };

    case 'user_already_exists':
      return { error: CODE_MESSAGES.alreadyExists, message: null };

    case 'invalid_credentials':
      return { error: CODE_MESSAGES.badCredentials, message: null };

    case 'email_not_confirmed':
      return { error: CODE_MESSAGES.notConfirmed, message: null, stage: 'code' };

    default:
      break;
  }

  // No usable code. Fall back to prose, narrowly.
  if (!code) {
    for (const [pattern, message] of PROSE) {
      if (pattern.test(error.message)) {
        return {
          error: CODE_MESSAGES[message],
          message: null,
          ...(message === 'notConfirmed' ? { stage: 'code' as const } : {}),
        };
      }
    }
  }

  return { error: CODE_MESSAGES.generic, message: null };
}