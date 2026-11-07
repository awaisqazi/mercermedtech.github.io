/**
 * The task drawer, and anything else that wants to keep the list in view
 * beside its detail: a panel on the right on a desktop, a full-screen sheet
 * under 720px.
 *
 * Shares `useOverlay` with Modal, so Escape closes the top-most overlay only,
 * focus moves in on open and goes back to whatever had it on close, Tab stays
 * inside, and the page behind does not scroll. Clicking the dimmed page
 * outside the panel closes it too.
 */
import type { ComponentChildren } from 'preact';
import { useId, useRef } from 'preact/hooks';
import { Button } from './Button';
import { IconClose } from './Icons';
import { useOverlay } from './Modal';

export interface DrawerProps {
  open: boolean;
  /** The heading. A string, or a node (an editable title) with `label` set. */
  title: ComponentChildren;
  /** Accessible name when `title` is not plain text. */
  label?: string;
  onClose: () => void;
  children: ComponentChildren;
  /** Beside the close button: a status, a menu. */
  actions?: ComponentChildren;
  /** Pinned to the bottom: a comment composer, the save buttons. */
  footer?: ComponentChildren;
  /** Forms want the first field; reading views want the panel itself. */
  initialFocus?: 'first' | 'panel';
  class?: string;
}

export function Drawer({
  open,
  title,
  label,
  onClose,
  children,
  actions,
  footer,
  initialFocus = 'panel',
  class: className,
}: DrawerProps) {
  const panel = useRef<HTMLElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useOverlay({ open, id, panel, onClose: closeRef, initialFocus, bodySelector: '.wb-drawer-body' });

  if (!open) return null;

  return (
    <div class="wb-drawer-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside
        class={`wb-drawer${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={label ? undefined : titleId}
        aria-label={label}
        ref={panel}
        tabIndex={-1}
      >
        <header class="wb-drawer-head">
          <div class="wb-drawer-heading">
            {typeof title === 'string' ? (
              <h2 class="wb-drawer-title" id={titleId}>
                {title}
              </h2>
            ) : (
              <div id={titleId}>{title}</div>
            )}
          </div>
          <div class="wb-drawer-actions">
            {actions}
            <Button variant="quiet" iconOnly aria-label="Close" onClick={onClose} icon={<IconClose />} />
          </div>
        </header>
        <div class="wb-drawer-body">{children}</div>
        {footer ? <footer class="wb-drawer-foot">{footer}</footer> : null}
      </aside>
    </div>
  );
}
