/**
 * A small panel under a button, for choices that are more than a menu: the
 * workstream checklist on the Plan, for one. Closes on Escape and on a click
 * outside, and hands focus back to its button.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';

export function Popover({
  label,
  button,
  children,
  align = 'left',
  class: className,
}: {
  /** Accessible name of the panel. */
  label: string;
  /** What the trigger shows. */
  button: ComponentChildren;
  children: ComponentChildren;
  align?: 'left' | 'right';
  class?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.setTimeout(() => wrap.current?.querySelector<HTMLElement>('.wb-popover input, .wb-popover button')?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div class={`wb-popover-wrap${className ? ` ${className}` : ''}`} ref={wrap}>
      <button
        type="button"
        ref={trigger}
        class="wb-chip wb-chip-toggle wb-popover-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {button}
      </button>
      {open ? (
        <div class={`wb-popover wb-popover-${align}`} id={id} role="group" aria-label={label}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
