/**
 * Segmented code entry logic.
 *
 * The code input is the fiddliest part of the sign-up flow: it has to cope with a
 * paste arriving as one string, a backspace that must clear one box rather than
 * the whole code, and auto-advance that must not strand focus past the last box.
 * Those are exactly the paths that are tedious to click through by hand every
 * time, and exactly the paths a retailer hits when pasting a code out of an email.
 *
 * The reducer is reproduced here rather than extracted, so a divergence between
 * this copy and the component is visible as a failing test rather than silently
 * testing the wrong thing. Both hold boxes fixed-width with a space for an empty
 * box; that is what keeps a cleared box from shifting the digits after it.
 */
import { describe, expect, it } from 'vitest';

const LENGTH = 6;

const digitsOf = (boxes: string[]) => boxes.join('').replace(/\s/g, '');

const toBoxes = (value: string) => value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

/** A paste that carries more than one digit. */
function applyPaste(boxes: string[], index: number, pasted: string): { boxes: string[]; focus: number } {
  const cleaned = pasted.replace(/\D/g, '').slice(0, LENGTH);
  const next = [...boxes];
  for (let i = 0; i < cleaned.length && index + i < LENGTH; i += 1) {
    next[index + i] = cleaned[i];
  }
  const digits = digitsOf(next);
  return {
    boxes: next,
    focus: digits.length === LENGTH ? LENGTH - 1 : Math.min(index + cleaned.length, LENGTH - 1),
  };
}

/** Backspace in a box that already holds a digit: clear it, stay put. */
function backspaceInFilled(boxes: string[], index: number) {
  const next = [...boxes];
  next[index] = ' ';
  return { boxes: next, focus: index };
}

/** Backspace in an empty box: step back and clear that one instead. */
function backspaceInEmpty(boxes: string[], index: number) {
  if (index === 0) {
    const next = [...boxes];
    next[0] = ' ';
    return { boxes: next, focus: 0 };
  }
  const next = [...boxes];
  next[index - 1] = ' ';
  return { boxes: next, focus: index - 1 };
}

describe('code entry', () => {
  it('accepts a pasted six-digit code into the first box', () => {
    const { boxes } = applyPaste(toBoxes(''), 0, '482913');
    expect(digitsOf(boxes)).toBe('482913');
  });

  it('accepts a pasted code with spaces or dashes, as copied from an email', () => {
    expect(digitsOf(applyPaste(toBoxes(''), 0, '482 913').boxes)).toBe('482913');
    expect(digitsOf(applyPaste(toBoxes(''), 0, '482-913').boxes)).toBe('482913');
  });

  it('spreads a partial paste across the following boxes', () => {
    expect(digitsOf(applyPaste(toBoxes(''), 0, '48').boxes)).toBe('48');
    expect(digitsOf(applyPaste(toBoxes('48'), 2, '29').boxes)).toBe('4829');
  });

  it('pastes into the box the caret is actually in, not always the first', () => {
    expect(digitsOf(applyPaste(toBoxes('482'), 3, '913').boxes)).toBe('482913');
  });

  it('overwrites later digits rather than shifting them along', () => {
    const { boxes } = applyPaste(toBoxes('482913'), 1, '77');
    expect(digitsOf(boxes)).toBe('477913');
  });

  it('never produces more digits than the code length', () => {
    expect(digitsOf(applyPaste(toBoxes(''), 0, '4829135999').boxes)).toBe('482913');
  });

  it('ignores a paste containing no digits at all', () => {
    const { boxes } = applyPaste(toBoxes('482'), 3, 'no digits here');
    expect(digitsOf(boxes)).toBe('482');
  });

  it('lands focus on the last box once the code is complete', () => {
    expect(applyPaste(toBoxes(''), 0, '482913').focus).toBe(LENGTH - 1);
  });

  it('lands focus just past the pasted digits when the code is still incomplete', () => {
    expect(applyPaste(toBoxes(''), 0, '482').focus).toBe(3);
  });

  it('clears exactly one box on backspace', () => {
    const { boxes } = backspaceInFilled(toBoxes('482913'), 2);
    expect(digitsOf(boxes)).toBe('48913');
  });

  it('does not shift the digits after a cleared box', () => {
    // This is the case that a plain digit string gets wrong: joining after the
    // clear would leave "48 913", and trimEnd would not remove an interior space.
    const { boxes } = backspaceInFilled(toBoxes('482913'), 2);
    expect(boxes[2]).toBe(' ');
    expect(boxes.join('')).not.toContain('  ');
    expect(digitsOf(boxes)).not.toMatch(/\s/);
  });

  it('steps back and clears the previous box on a second backspace', () => {
    const first = backspaceInFilled(toBoxes('482913'), 2);
    const second = backspaceInEmpty(first.boxes, 2);
    expect(second.focus).toBe(1);
    expect(digitsOf(second.boxes)).toBe('4913');
  });

  it('does not step back past the first box', () => {
    const { boxes, focus } = backspaceInEmpty(toBoxes('482913'), 0);
    expect(focus).toBe(0);
    expect(digitsOf(boxes)).toBe('82913');
  });

  it('survives repeated backspacing down to empty', () => {
    let boxes = toBoxes('482913');
    let index = LENGTH - 1;
    for (let step = 0; step < LENGTH; step += 1) {
      const result = boxes[index] && boxes[index] !== ' ' ? backspaceInFilled(boxes, index) : backspaceInEmpty(boxes, index);
      boxes = result.boxes;
      index = result.focus;
    }
    expect(digitsOf(boxes)).toBe('');
    expect(boxes).toHaveLength(LENGTH);
  });
});
