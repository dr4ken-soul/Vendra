/**
 * Dialog focus must survive typing inside the dialog.
 *
 * @vitest-environment jsdom
 *
 * This is a regression test for a defect that made twelve dialogs in this app
 * unusable. The Dialog's open/close effect listed `onClose` as a dependency, and
 * every call site passes an inline arrow function, so the identity of `onClose`
 * changed on every render of the parent. Typing in a field re-renders the parent,
 * which re-ran the effect, which re-ran its autofocus and moved focus off the
 * input. A retailer could type one character of a supplier's name and then not
 * another.
 *
 * The mechanism is React's, not this app's, so it is tested against a real React
 * root in jsdom with a parent that behaves the way these call sites behave. An
 * assertion about the source would not catch it: the source can look correct and
 * still re-run, because the dependency is a function identity and identities are
 * not visible in the code.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../web/src/components/app/ui';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * Mirrors the real call sites: state that changes on every keystroke, and an
 * inline arrow for `onClose`, which is what produced the new identity each time.
 */
function Harness({ onReady }: { onReady?: (input: HTMLInputElement) => void }) {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) onReady?.(inputRef.current as HTMLInputElement);
  }, [open, onReady]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Add a supplier"
      description="Save only what you need to recognise this supplier."
    >
      <input
        ref={inputRef}
        aria-label="Supplier name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
    </Dialog>
  );
}

describe('Dialog focus', () => {
  it('keeps focus in the field while the retailer types', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    let input: HTMLInputElement | undefined;

    await act(async () => {
      root.render(<Harness onReady={(el) => { input = el; }} />);
    });

    // Focus the field the way a retailer would: click it, then type.
    await act(async () => {
      input!.focus();
    });
    expect(document.activeElement).toBe(input);

    // Every keystroke re-renders the parent, which re-creates the inline
    // onClose arrow. Before the fix this moved focus to the dialog heading here.
    for (const char of 'Segun H') {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )!.set!;
        setter.call(input, input!.value + char);
        input!.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(document.activeElement).toBe(input);
    }

    expect(input!.value).toBe('Segun H');

    await act(async () => {
      root.unmount();
    });
  });

  it('puts initial focus in the body, not on the heading', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    let input: HTMLInputElement | undefined;

    await act(async () => {
      root.render(<Harness onReady={(el) => { input = el; }} />);
    });

    // The heading used to carry data-autofocus, so opening a form dialog focused
    // a tabindex="-1" heading and the user had to Tab to reach the field.
    expect(document.activeElement).toBe(input);
    expect(document.activeElement?.tagName).toBe('INPUT');

    await act(async () => {
      root.unmount();
    });
  });
});