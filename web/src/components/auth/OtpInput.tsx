'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

/**
 * Segmented six-digit code entry.
 *
 * The retailer types a code they read off an email, so the input has to forgive
 * the ways people actually do that:
 *
 *   - the digits arrive as one pasted string, not six keystrokes
 *   - the code is typed with a keyboard, so focus must advance on its own
 *   - a wrong digit is backspaced, so focus must retreat on its own
 *   - the field is on a phone, so a numeric keypad is what should appear
 *
 * **The value is fixed width, with a space for an empty box.**
 *
 * That is the whole design decision, and it is not cosmetic. A plain string of
 * digits cannot represent "box 3 is empty but box 4 has a value", so clearing a
 * box in the middle has to either shift every later digit left or leave a hole
 * that later index arithmetic trips over. A first pass derived the boxes from the
 * digit string and joined the array back on change; backspacing box 3 of 482913
 * then produced "48 913", and `trimEnd()` does nothing because the space is in
 * the middle, so the form submitted a code with a literal space in it.
 *
 * Callers therefore pass and receive the fixed-width form. Use `codeDigits()` to
 * get the digits only, which is what gets validated and submitted.
 *
 * Accessibility notes, because a segmented input is easy to get wrong:
 *
 *   - each box is a real labelled input, so a screen reader announces it
 *   - `inputMode="numeric"` gives the numeric keypad without hiding the digits
 *     from assistive technology
 *   - the group carries `role="group"` and a label; each box reports validity
 *   - errors are announced through a live region rather than by colour alone
 *   - auto-advance is clamped so it can never strand focus past the last box
 */

export const CODE_LENGTH = 6;

/** Strip the placeholder spaces to get the digits a server would accept. */
export function codeDigits(fixedWidth: string): string {
  return fixedWidth.replace(/\s/g, '');
}

export interface OtpInputProps {
  /** Fixed width, spaces included. Pass `codeDigits()` output only to a server. */
  value: string;
  onChange: (fixedWidth: string) => void;
  /** Called once every box is filled, with the digits only. */
  onComplete?: (digits: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * The message to announce when `invalid` is set.
   *
   * The server's own wording is passed in rather than hardcoded, so a retailer
   * sees exactly one reason for the failure. An earlier version showed a generic
   * "that code is not right" from here *and* the server's explanation below it,
   * which meant one wrong code produced two contradictory sentences.
   */
  errorText?: string | null;
  autoFocus?: boolean;
  label?: string;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = CODE_LENGTH,
  disabled = false,
  invalid = false,
  errorText,
  autoFocus = true,
  label = 'Verification code',
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState(0);

  // Derived, never stored. Holding a second copy in state is what created the
  // two-sources-of-truth bug described above, and what React's lint rule warns
  // about when the copy is synced from a prop inside an effect.
  const boxes = value.padEnd(length, ' ').slice(0, length).split('');

  // Move the caret to the end of the field being edited, so a mid-code edit does
  // not push the digit out of view.
  useEffect(() => {
    const input = inputs.current[focused];
    if (input && document.activeElement === input && input.value) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [focused, value]);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  const focusAt = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    inputs.current[clamped]?.focus();
    inputs.current[clamped]?.select();
  };

  const commit = (next: string[]) => {
    const fixed = next.join('').slice(0, length);
    onChange(fixed);
    return fixed;
  };

  const setDigit = (index: number, digit: string) => {
    const next = [...boxes];
    next[index] = digit;
    commit(next);
    if (digit && index < length - 1) focusAt(index + 1);
    if (!digit && index > 0) focusAt(index - 1);
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');

    // A paste arrives entirely in one box, so spread it across the rest.
    if (cleaned.length > 1) {
      const next = [...boxes];
      for (let i = 0; i < cleaned.length && index + i < length; i += 1) {
        next[index + i] = cleaned[i];
      }
      const digits = codeDigits(commit(next));
      if (digits.length === length) {
        focusAt(length - 1);
        onComplete?.(digits);
      } else {
        focusAt(Math.min(index + cleaned.length, length - 1));
      }
      return;
    }

    setDigit(index, cleaned);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();

      if (boxes[index] && boxes[index] !== ' ') {
        // Clear this box and stay on it.
        setDigit(index, '');
        return;
      }

      // Already empty: step back and clear the previous box, which is what
      // someone pressing backspace twice quickly expects to happen.
      if (index > 0) {
        const next = [...boxes];
        next[index - 1] = ' ';
        commit(next);
        focusAt(index - 1);
      } else {
        setDigit(index, '');
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const next = [...boxes];
    for (let i = 0; i < pasted.length && index + i < length; i += 1) {
      next[index + i] = pasted[i];
    }

    const digits = codeDigits(commit(next));
    if (digits.length === length) {
      focusAt(length - 1);
      onComplete?.(digits);
    } else {
      focusAt(Math.min(index + pasted.length, length - 1));
    }
  };

  return (
    <div>
      <div role="group" aria-label={label} className="flex items-center justify-between gap-2 sm:gap-2.5">
        {boxes.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputs.current[index] = node;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={length}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? 'otp-error' : undefined}
            value={digit === ' ' ? '' : digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={() => setFocused(index)}
            className={[
              'h-14 w-full min-w-0 rounded-xl border bg-[var(--bg-surface)] text-center',
              'font-display text-2xl font-semibold tabular-nums text-[var(--text-primary)]',
              'transition-all duration-150 ease-[var(--ease-precision)] sm:h-16 sm:text-[28px]',
              'outline-none placeholder:text-[var(--text-muted)]',
              'focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]',
              invalid
                ? 'border-[var(--danger)] ring-2 ring-[var(--danger-soft)]'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
              disabled ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Announced to assistive technology, and it carries the server's own reason
          so there is never a second, different explanation on the page. The
          border colour is decorative; this text is the signal. */}
      {invalid && (
        <motion.p
          id="otp-error"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm font-medium text-[var(--danger)]"
        >
          {errorText ?? 'That code is not right. Check the digits and try again.'}
        </motion.p>
      )}
    </div>
  );
}

export default OtpInput;
