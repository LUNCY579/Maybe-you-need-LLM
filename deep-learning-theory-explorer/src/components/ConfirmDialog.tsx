import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { useFocusTrap } from '../lib/useFocusTrap';

/**
 * A confirmation dialog for actions that cannot be undone.
 *
 * The progress record lives in local storage and there is no server copy, so
 * "reset progress" is genuinely irreversible. One click on a red button should
 * not throw away a term of work, so the action is confirmed first, the dialog
 * traps the focus while it is open, Escape and the backdrop both mean "no",
 * and the focus returns to the button that opened it.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-lab-950/70 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-md rounded-lg border border-lab-700 bg-lab-900 p-4 shadow-2xl"
      >
        <h2 id={titleId} className="text-[15px] font-semibold text-lab-100">
          {title}
        </h2>
        <div id={bodyId} className="mt-2 text-[13px] leading-relaxed text-lab-300">
          {body}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
