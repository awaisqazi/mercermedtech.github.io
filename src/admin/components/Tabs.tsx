/**
 * The tab strip. Tabs are links (each one is a real address, `#/p/<slug>/<tab>`)
 * so they can be bookmarked, opened in a new tab and shared. Arrow keys move
 * between them, as the tab pattern expects.
 */
import { useRef } from 'preact/hooks';

export interface TabDef {
  key: string;
  label: string;
  href: string;
  /** A small number beside the label, e.g. open items. */
  count?: number;
}

export interface TabsProps {
  tabs: TabDef[];
  active: string;
  label?: string;
  class?: string;
}

export function Tabs({ tabs, active, label = 'Sections', class: className }: TabsProps) {
  const list = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const items = [...(list.current?.querySelectorAll<HTMLAnchorElement>('.wb-tab') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (index === -1) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = items[(index + step + items.length) % items.length];
    next?.focus();
  };

  return (
    <div
      class={`wb-tabs${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={label}
      ref={list}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <a
            key={tab.key}
            class={`wb-tab${selected ? ' is-active' : ''}`}
            href={tab.href}
            role="tab"
            aria-selected={selected ? 'true' : 'false'}
            tabIndex={selected ? 0 : -1}
          >
            {tab.label}
            {tab.count ? <span class="wb-tab-count wb-mono">{tab.count}</span> : null}
          </a>
        );
      })}
    </div>
  );
}

export interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onValue: (value: T) => void;
  label: string;
  class?: string;
}

/** A small segmented control, for view switches and horizon filters. */
export function Segmented<T extends string>({
  options,
  value,
  onValue,
  label,
  class: className,
}: SegmentedProps<T>) {
  return (
    <div class={`wb-segmented${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          class={`wb-segment${option.value === value ? ' is-active' : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onValue(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
