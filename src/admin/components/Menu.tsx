/**
 * A small pop-up menu. Closes on Escape, on a click outside, and after a pick;
 * arrow keys walk the items.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';

export interface MenuItem {
  key: string;
  label: string;
  icon?: ComponentChildren;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Draws a thin line above this item, to start a new group. */
  divider?: boolean;
  /** A small note under the label, e.g. why an item is switched off. */
  hint?: string;
}

export interface MenuProps {
  /** The button that opens the menu. It gets the aria wiring. */
  trigger: (props: {
    onClick: () => void;
    'aria-expanded': 'true' | 'false';
    'aria-haspopup': 'menu';
    id: string;
  }) => ComponentChildren;
  items: MenuItem[];
  align?: 'left' | 'right';
  /** Opens upwards, for a menu that lives at the bottom of the screen. */
  placement?: 'down' | 'up';
  label?: string;
}

export function Menu({ trigger, items, align = 'right', placement = 'down', label = 'Menu' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const triggerId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDocumentDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Ours, not the panel's underneath: a modal checks defaultPrevented.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        wrap.current?.querySelector<HTMLElement>('button,[role="button"]')?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const entries = [...(wrap.current?.querySelectorAll<HTMLElement>('.wb-menu-item') ?? [])];
      if (!entries.length) return;
      event.preventDefault();
      const index = entries.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = entries[(index + step + entries.length) % entries.length];
      next?.focus();
    };
    document.addEventListener('mousedown', onDocumentDown);
    document.addEventListener('keydown', onKeyDown, true);
    // Land on the first item so the keyboard works straight away.
    window.setTimeout(() => wrap.current?.querySelector<HTMLElement>('.wb-menu-item')?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDocumentDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div class="wb-menu-wrap" ref={wrap}>
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open ? 'true' : 'false',
        'aria-haspopup': 'menu',
        id: triggerId,
      })}
      {open ? (
        <div
          class={`wb-menu wb-menu-${align}${placement === 'up' ? ' wb-menu-up' : ''}`}
          role="menu"
          aria-labelledby={triggerId}
        >
          {items.map((item) => [
            item.divider ? <hr class="wb-menu-divider" key={`${item.key}-divider`} aria-hidden="true" /> : null,
            <button
              key={item.key}
              type="button"
              role="menuitem"
              class={`wb-menu-item${item.tone === 'danger' ? ' is-danger' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon ? <span class="wb-menu-icon" aria-hidden="true">{item.icon}</span> : null}
              <span class="wb-menu-text">
                <span>{item.label}</span>
                {item.hint ? <span class="wb-menu-hint">{item.hint}</span> : null}
              </span>
            </button>,
          ])}
          {items.length === 0 ? <p class="wb-menu-empty">{label} is empty</p> : null}
        </div>
      ) : null}
    </div>
  );
}
