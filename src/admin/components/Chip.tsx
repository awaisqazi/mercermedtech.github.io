import type { ComponentChildren } from 'preact';

export type ChipTone = 'neutral' | 'accent' | 'good' | 'warn' | 'crit' | 'quiet';

export interface ChipProps {
  tone?: ChipTone;
  /** A small dot or icon before the label. */
  icon?: ComponentChildren;
  title?: string;
  class?: string;
  children: ComponentChildren;
}

/** A small label. Never the only carrier of meaning: the word is always there. */
export function Chip({ tone = 'neutral', icon, title, class: className, children }: ChipProps) {
  return (
    <span class={`wb-chip wb-chip-${tone}${className ? ` ${className}` : ''}`} title={title}>
      {icon ? <span class="wb-chip-icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

/** A chip that is also a filter button. */
export function ToggleChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ComponentChildren;
  count?: number;
}) {
  return (
    <button
      type="button"
      class={`wb-chip wb-chip-toggle${active ? ' is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
      {count === undefined ? null : <span class="wb-chip-count wb-mono">{count}</span>}
    </button>
  );
}
