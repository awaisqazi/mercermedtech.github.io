/**
 * Choosing a person: a button that shows who is chosen (avatar and name, or
 * "Unassigned"), opening a short list with a search box on top.
 *
 * It follows the combobox pattern: typing filters, the arrow keys move the
 * highlight, Enter picks, Escape closes and hands focus back to the button.
 * Only active people are offered unless the caller passes its own list.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { useProfiles } from '../lib/workspace';
import type { Profile } from '../lib/types';
import { Avatar } from './Avatar';
import { IconChevronDown, IconSearch } from './Icons';

export interface PersonPickerProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  /** The visible label. */
  label: string;
  hideLabel?: boolean;
  /** Who may be picked. Defaults to every active person. */
  people?: readonly Profile[];
  /** Offers "Unassigned" first. On by default. */
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  /** Shown under the name in the list, e.g. the role. */
  describe?: (person: Profile) => string;
  class?: string;
}

const NONE = '__none__';

export function PersonPicker({
  value,
  onChange,
  label,
  hideLabel = false,
  people,
  allowNone = true,
  noneLabel = 'Unassigned',
  disabled = false,
  describe,
  class: className,
}: PersonPickerProps) {
  const everyone = useProfiles();
  const pool = useMemo(() => people ?? everyone.filter((person) => person.active), [people, everyone]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-list`;

  const chosen = value ? (everyone.find((person) => person.id === value) ?? null) : null;

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = pool.filter((person) => {
      if (!needle) return true;
      return `${person.full_name ?? ''} ${person.email ?? ''} ${person.title ?? ''}`.toLowerCase().includes(needle);
    });
    const rows: Array<{ key: string; person: Profile | null }> = matched.map((person) => ({ key: person.id, person }));
    if (allowNone && (!needle || noneLabel.toLowerCase().includes(needle))) rows.unshift({ key: NONE, person: null });
    return rows;
  }, [pool, query, allowNone, noneLabel]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    const selected = options.findIndex((option) => (option.person?.id ?? null) === value);
    setHighlight(selected === -1 ? 0 : selected);
    window.setTimeout(() => search.current?.focus(), 0);
    const onDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // Only on opening: the highlight follows the keyboard after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setHighlight(0), [query]);

  const pick = (person: Profile | null) => {
    setOpen(false);
    button.current?.focus();
    if ((person?.id ?? null) !== value) onChange(person?.id ?? null);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Ours, not the drawer's underneath (it checks defaultPrevented).
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight((current) => (current + step + options.length) % Math.max(1, options.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[highlight];
      if (option) pick(option.person);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const activeId = options[highlight] ? `${id}-${options[highlight]!.key}` : undefined;

  return (
    <div class={`wb-picker${className ? ` ${className}` : ''}`} ref={wrap}>
      <span class={`wb-label${hideLabel ? ' wb-sr' : ''}`} id={`${id}-label`}>
        {label}
      </span>
      <button
        type="button"
        ref={button}
        class="wb-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {chosen ? (
          <Avatar id={chosen.id} name={chosen.full_name} email={chosen.email} size={22} />
        ) : (
          <span class="wb-picker-none-mark" aria-hidden="true" />
        )}
        <span class="wb-picker-value" id={`${id}-value`}>
          {chosen ? chosen.full_name || chosen.email : noneLabel}
        </span>
        <IconChevronDown size={14} class="wb-picker-caret" />
      </button>
      {open ? (
        <div class="wb-picker-pop">
          <div class="wb-picker-search">
            <IconSearch size={15} />
            <input
              ref={search}
              class="wb-picker-input"
              type="text"
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}`}
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              placeholder="Search by name"
              value={query}
              onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
              onKeyDown={onKeyDown}
            />
          </div>
          <ul class="wb-picker-list" role="listbox" id={listId} aria-label={label}>
            {options.map((option, index) => {
              const selected = (option.person?.id ?? null) === value;
              return (
                <li
                  key={option.key}
                  id={`${id}-${option.key}`}
                  role="option"
                  aria-selected={selected}
                  class={`wb-picker-option${index === highlight ? ' is-highlighted' : ''}${selected ? ' is-selected' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option.person)}
                >
                  {option.person ? (
                    <Avatar id={option.person.id} name={option.person.full_name} email={option.person.email} size={24} />
                  ) : (
                    <span class="wb-picker-none-mark" aria-hidden="true" />
                  )}
                  <span class="wb-picker-option-text">
                    <span>{option.person ? option.person.full_name || option.person.email : noneLabel}</span>
                    {option.person && describe ? <span class="wb-picker-option-sub">{describe(option.person)}</span> : null}
                  </span>
                </li>
              );
            })}
            {options.length === 0 ? <li class="wb-picker-empty">Nobody matches that name.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
