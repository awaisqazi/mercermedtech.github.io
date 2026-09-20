/**
 * "Are you sure?" as a component and as a promise.
 *
 * `<ConfirmDialog>` is the plain component. `useConfirm()` gives a function
 * that resolves true or false, so a delete handler can read as one line:
 *
 *   if (!(await confirm({ title: 'Delete this task?', confirmLabel: 'Delete' }))) return;
 */
import type { ComponentChildren } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { Dialog } from './Dialog';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  body?: ComponentChildren;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Yes, do it',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      size="sm"
      onClose={onCancel}
      footer={
        <>
          <Button variant="quiet" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {typeof body === 'string' ? <p class="wb-prose">{body}</p> : body}
    </Dialog>
  );
}

/** Mount `element` once in a screen and call `confirm(...)` wherever you need it. */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  element: ComponentChildren;
} {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (answer: boolean) => {
    setOptions(null);
    resolver.current?.(answer);
    resolver.current = null;
  };

  const element = options ? (
    <ConfirmDialog
      {...options}
      open
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, element };
}
