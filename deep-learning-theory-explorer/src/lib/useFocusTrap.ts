import { useEffect, useRef } from 'react';

/**
 * A focus trap.
 *
 * A modal dialog that lets the keyboard wander behind it is a modal that is not
 * really modal. This keeps the focus inside the dialog while it is open, and
 * returns it to where it came from when it closes.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    restore.current = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () => {
      const items = Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      // `offsetParent` is the only cheap way to ask whether an element is
      // really on the page, but it is null for a fixed-position ancestor and
      // null for everything when there is no layout engine at all. So the
      // filter is only applied when the document is actually laid out.
      const laidOut = document.body.getClientRects().length > 0;
      if (!laidOut) return items;
      return items.filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    const first = focusable()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && index <= 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && index === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      restore.current?.focus?.();
    };
  }, [active]);

  return ref;
}
