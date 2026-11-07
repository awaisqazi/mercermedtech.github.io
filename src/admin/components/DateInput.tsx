/**
 * A calendar date, as `YYYY-MM-DD` or null. The native date input on purpose:
 * it is the one date picker that works on every phone, with a keyboard and
 * with a screen reader. Shortcuts ("Today", "Yesterday") sit under it for the
 * two dates people pick nine times out of ten.
 */
import { useId } from 'preact/hooks';
import { addDays, todayKey } from '../lib/hours';

export type DateShortcut = 'yesterday' | 'today' | 'tomorrow' | 'next-week';

const SHORTCUT_LABEL: Record<DateShortcut, string> = {
  yesterday: 'Yesterday',
  today: 'Today',
  tomorrow: 'Tomorrow',
  'next-week': 'In a week',
};

function shortcutDate(shortcut: DateShortcut): string {
  const today = todayKey();
  if (shortcut === 'yesterday') return addDays(today, -1);
  if (shortcut === 'tomorrow') return addDays(today, 1);
  if (shortcut === 'next-week') return addDays(today, 7);
  return today;
}

export interface DateInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string | null;
  shortcuts?: DateShortcut[];
  /** Offers "No date". */
  clearable?: boolean;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  class?: string;
}

export function DateInput({
  value,
  onChange,
  label,
  hideLabel = false,
  hint,
  error,
  shortcuts = [],
  clearable = false,
  min,
  max,
  required = false,
  disabled = false,
  class: className,
}: DateInputProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div class={`wb-field wb-date${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label class={`wb-label${hideLabel ? ' wb-sr' : ''}`} for={id}>
        {label}
      </label>
      <input
        id={id}
        class="wb-input wb-date-input"
        type="date"
        value={value ?? ''}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? 'true' : undefined}
        onChange={(event) => onChange((event.currentTarget as HTMLInputElement).value || null)}
      />
      {shortcuts.length || clearable ? (
        <div class="wb-date-shortcuts" role="group" aria-label={`${label} shortcuts`}>
          {shortcuts.map((shortcut) => {
            const date = shortcutDate(shortcut);
            return (
              <button
                key={shortcut}
                type="button"
                class={`wb-date-shortcut${value === date ? ' is-active' : ''}`}
                aria-pressed={value === date}
                disabled={disabled}
                onClick={() => onChange(date)}
              >
                {SHORTCUT_LABEL[shortcut]}
              </button>
            );
          })}
          {clearable && value ? (
            <button type="button" class="wb-date-shortcut" disabled={disabled} onClick={() => onChange(null)}>
              No date
            </button>
          ) : null}
        </div>
      ) : null}
      {hint ? (
        <p class="wb-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p class="wb-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
