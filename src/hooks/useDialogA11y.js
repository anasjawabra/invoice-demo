import { useEffect, useRef } from 'react';

let scrollLockDepth = 0;
let previousBodyOverflow = '';

function getFocusable(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

/** Shared modal-dialog behaviour: initial focus, focus trap, Escape, scroll
 * lock, and focus restoration. Presentation-only state stays outside business
 * workflows and is reused by every drawer. */
export default function useDialogA11y({ open, onClose, enabled = true, initialFocusRef }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !enabled) return undefined;

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;

    scrollLockDepth += 1;
    if (scrollLockDepth === 1) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const focusTimer = window.setTimeout(() => {
      const target = initialFocusRef?.current || getFocusable(dialog)[0] || dialog;
      target?.focus({ preventScroll: true });
    }, 0);

    function handleKeyDown(event) {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'));
      if (dialogs.at(-1) !== dialog) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusable(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      scrollLockDepth = Math.max(0, scrollLockDepth - 1);
      if (scrollLockDepth === 0) document.body.style.overflow = previousBodyOverflow;
      const returnTarget = returnFocusRef.current;
      window.setTimeout(() => returnTarget?.focus?.({ preventScroll: true }), 0);
    };
  }, [enabled, initialFocusRef, open]);

  return dialogRef;
}
