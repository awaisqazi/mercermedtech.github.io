/**
 * The centred overlay: every form (through `Dialog`), the confirm, the phone
 * More sheet. The task drawer is `Drawer`, which shares the keyboard and focus
 * handling below through `useOverlay`.
 *
 *  - centred panel by default; a full-screen sheet on a phone;
 *  - Escape closes the top-most one only, focus moves in on open and back to
 *    whatever had it on close, Tab stays inside, and the page behind does not
 *    scroll.
 *
 * Rendered in place (no portal) because the shell has no stacking surprises.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { Button } from './Button';
import { IconClose } from './Icons';

export interface ModalProps {
  open: boolean;
  /** The heading. A string, or a node (an editable title) with `label` set. */
  title: ComponentChildren;
  /** Accessible name when `title` is not plain text. */
  label?: string;
  description?: ComponentChildren;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  /** Things beside the close button: avatars, a menu, a toggle. */
  actions?: ComponentChildren;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hideClose?: boolean;
  /** Forms want the first field; reading views want the panel itself. */
  initialFocus?: 'first' | 'panel';
  class?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Open overlays, bottom first. Only the last one listens to the keyboard. */
const stack: string[] = [];

/**
 * Keyboard and focus for anything that sits over the page: focus moves in on
 * open and back to whatever had it on close, Tab stays inside, Escape closes
 * the top-most overlay only, and the page behind does not scroll.
 */
export function useOverlay({
  open,
  id,
  panel,
  onClose,
  initialFocus = 'first',
  bodySelector,
}: {
  open: boolean;
  id: string;
  panel: { current: HTMLElement | null };
  onClose: { current: () => void };
  initialFocus?: 'first' | 'panel';
  /** Where "first" looks for a field, so the close button is skipped. */
  bodySelector: string;
}): void {
  useEffect(() => {
    if (!open) return undefined;
    stack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;

    if (initialFocus === 'first') {
      const first = [...(node?.querySelectorAll<HTMLElement>(`${bodySelector} ${FOCUSABLE}`) ?? [])][0];
      (first ?? node)?.focus();
    } else {
      node?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === 'Escape') {
        // A menu or an inline confirm inside the panel gets Escape first.
        if (event.defaultPrevented) return;
        // In a live field (one that saves as you go), Escape puts the value
        // back and leaves the field (see LiveField); a second Escape closes
        // the panel. In a form, Escape simply closes it.
        const target = event.target as HTMLElement | null;
        if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName) && target.closest('.wb-live')) {
          const type = (target as HTMLInputElement).type;
          if (type !== 'checkbox' && type !== 'radio') {
            target.blur();
            return;
          }
        }
        event.stopPropagation();
        onClose.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (item) => item.offsetParent !== null
      );
      if (!items.length) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === node)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('wb-no-scroll');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const at = stack.lastIndexOf(id);
      if (at !== -1) stack.splice(at, 1);
      if (!stack.length) document.body.classList.remove('wb-no-scroll');
      if (previous && document.contains(previous)) previous.focus?.();
    };
    // `onClose` is read through a ref so a parent re-render does not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);
}

export function Modal({
  open,
  title,
  label,
  description,
  onClose,
  children,
  footer,
  actions,
  size = 'md',
  hideClose = false,
  initialFocus = 'first',
  class: className,
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-desc`;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useOverlay({ open, id, panel, onClose: closeRef, initialFocus, bodySelector: '.wb-modal-body' });

  if (!open) return null;

  return (
    <div
      class="wb-modal-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        class={`wb-modal wb-modal-${size}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={label ? undefined : titleId}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        ref={panel}
        tabIndex={-1}
      >
        <header class="wb-modal-head">
          <div class="wb-modal-heading">
            {typeof title === 'string' ? (
              <h2 class="wb-modal-title" id={titleId}>
                {title}
              </h2>
            ) : (
              <div id={titleId}>{title}</div>
            )}
            {description ? (
              <div class="wb-modal-description" id={descriptionId}>
                {description}
              </div>
            ) : null}
          </div>
          <div class="wb-modal-actions">
            {actions}
            {hideClose ? null : (
              <Button variant="quiet" iconOnly aria-label="Close" onClick={onClose} icon={<IconClose />} />
            )}
          </div>
        </header>
        <div class="wb-modal-body">{children}</div>
        {footer ? <footer class="wb-modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** True while any overlay is open, for global shortcuts that should wait. */
export function anyModalOpen(): boolean {
  return stack.length > 0;
}
