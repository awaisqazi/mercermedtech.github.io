/**
 * A form or a question in a centred panel. It is `Modal` with the settings a
 * form wants (focus on the first field, a footer for the buttons), kept as its
 * own name because every dialog in the portal already uses it.
 */
import type { ComponentChildren } from 'preact';
import { Modal } from './Modal';

export interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ComponentChildren;
  /** Buttons for the bottom bar. */
  footer?: ComponentChildren;
  size?: 'sm' | 'md' | 'lg';
  /** Hides the X, for a dialog that must be answered. */
  hideClose?: boolean;
}

export function Dialog({ open, title, description, onClose, children, footer, size = 'md', hideClose = false }: DialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={footer}
      size={size}
      hideClose={hideClose}
      initialFocus="first"
      class="wb-dialog"
    >
      {children}
    </Modal>
  );
}
