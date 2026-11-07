/**
 * Hours, in quarter hours: a minus button, the number, a plus button.
 *
 * The box takes what people actually type ("1.5", "1,5", "1:30", "90m") and
 * settles it to the nearest quarter on blur. Arrow up and down step by a
 * quarter, Page up and down by an hour. The value is always a valid entry,
 * 0.25 to 24, so the dialog never has to explain the database's rule.
 */
import { useEffect, useId, useState } from 'preact/hooks';
import { MAX_HOURS, MIN_HOURS, clampHours, formatHoursNumber, parseHours } from '../lib/hours';
import { IconMinus, IconPlus } from './Icons';

export interface HoursInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string | null;
  min?: number;
  max?: number;
  disabled?: boolean;
  class?: string;
}

const STEP = 0.25;

export function HoursInput({
  value,
  onChange,
  label,
  hideLabel = false,
  hint,
  error,
  min = MIN_HOURS,
  max = MAX_HOURS,
  disabled = false,
  class: className,
}: HoursInputProps) {
  const id = useId();
  const [draft, setDraft] = useState(formatHoursNumber(value));
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  useEffect(() => setDraft(formatHoursNumber(value)), [value]);

  const settle = (next: number) => {
    const clean = Math.min(max, Math.max(min, clampHours(next)));
    setDraft(formatHoursNumber(clean));
    if (clean !== value) onChange(clean);
  };

  const onBlur = () => {
    const parsed = parseHours(draft);
    if (parsed === null) setDraft(formatHoursNumber(value));
    else settle(parsed);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowUp: STEP, ArrowDown: -STEP, PageUp: 1, PageDown: -1 };
    const delta = steps[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      settle((parseHours(draft) ?? value) + delta);
    } else if (event.key === 'Enter') {
      onBlur();
    }
  };

  return (
    <div class={`wb-field wb-hours${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label class={`wb-label${hideLabel ? ' wb-sr' : ''}`} for={id}>
        {label}
      </label>
      <div class="wb-stepper">
        <button
          type="button"
          class="wb-stepper-button"
          aria-label="A quarter hour less"
          disabled={disabled || value <= min}
          onClick={() => settle(value - STEP)}
        >
          <IconMinus size={16} />
        </button>
        <input
          id={id}
          class="wb-input wb-stepper-input"
          type="text"
          inputMode="decimal"
          autocomplete="off"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${formatHoursNumber(value)} hours`}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? 'true' : undefined}
          value={draft}
          disabled={disabled}
          onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
        <span class="wb-stepper-unit" aria-hidden="true">
          h
        </span>
        <button
          type="button"
          class="wb-stepper-button"
          aria-label="A quarter hour more"
          disabled={disabled || value >= max}
          onClick={() => settle(value + STEP)}
        >
          <IconPlus size={16} />
        </button>
      </div>
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
