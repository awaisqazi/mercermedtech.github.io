/**
 * A modal panel. Escape closes it, focus moves in on open and back to whatever
 * had it on close, Tab is trapped inside, and the page behind does not scroll.
 * Rendered in place (no portal) because the shell has no stacking surprises.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { Button } from './Button';
import { IconClose } from './Icons';

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

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  hideClose = false,
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;

    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (item) => item.offsetParent !== null
      );
      if (!items.length) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.body.classList.add('wb-no-scroll');
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.classList.remove('wb-no-scroll');
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div class="wb-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        class={`wb-dialog wb-dialog-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={panel}
        tabIndex={-1}
      >
        <header class="wb-dialog-head">
          <div>
            <h2 class="wb-dialog-title" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p class="wb-dialog-description" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          {hideClose ? null : (
            <Button variant="quiet" iconOnly aria-label="Close" onClick={onClose} icon={<IconClose />} />
          )}
        </header>
        <div class="wb-dialog-body">{children}</div>
        {footer ? <footer class="wb-dialog-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
