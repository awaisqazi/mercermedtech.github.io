/**
 * Inputs bound straight to a row and column through `useLiveField`.
 *
 * Text and textarea save on blur and on Enter; number, date, select and
 * checkbox save on change. While an input has focus the store will not
 * overwrite it: if somebody else changes the same field, a small line appears
 * underneath saying so, and the new value is taken on blur if nothing was
 * typed. A read-only viewer gets a disabled control, not a hidden one.
 */
import type { JSX } from 'preact';
import { useLiveField, type WritableTable } from '../lib/store';
import { toast } from '../lib/toasts';
import { Select, type Option } from './Select';

export interface LiveBase {
  table: WritableTable;
  id: string;
  field: string;
  value: unknown;
  label: string;
  /** Hides the label visually but keeps it for screen readers. */
  hideLabel?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  class?: string;
}

function Wrap({
  label,
  hideLabel,
  hint,
  saving,
  id,
  class: className,
  children,
}: {
  label: string;
  hideLabel?: boolean;
  hint: string | null;
  saving: boolean;
  id: string;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <div class={`wb-live${saving ? ' is-saving' : ''}${className ? ` ${className}` : ''}`}>
      <label class={`wb-label${hideLabel ? ' wb-sr' : ''}`} for={id}>
        {label}
      </label>
      {children}
      {hint ? (
        <p class="wb-live-hint" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const onError = (message: string) => toast.bad(message);

export function LiveText({
  table,
  id,
  field,
  value,
  label,
  hideLabel,
  readOnly,
  placeholder,
  class: className,
}: LiveBase) {
  const live = useLiveField(table, id, field, value, {
    parse: (draft) => draft.trim(),
    onError: (error) => onError(error.message),
  });
  const inputId = `live-${id}-${field}`;
  return (
    <Wrap label={label} hideLabel={hideLabel} hint={live.hint} saving={live.saving} id={inputId} class={className}>
      <input
        id={inputId}
        class="wb-input"
        type="text"
        value={live.value}
        placeholder={placeholder}
        disabled={readOnly}
        onInput={live.onInput}
        onFocus={live.onFocus}
        onBlur={live.onBlur}
        onKeyDown={live.onKeyDown}
      />
    </Wrap>
  );
}

export function LiveTextarea({
  table,
  id,
  field,
  value,
  label,
  hideLabel,
  readOnly,
  placeholder,
  rows = 3,
  class: className,
}: LiveBase & { rows?: number }) {
  const live = useLiveField(table, id, field, value, {
    onError: (error) => onError(error.message),
  });
  const inputId = `live-${id}-${field}`;
  return (
    <Wrap label={label} hideLabel={hideLabel} hint={live.hint} saving={live.saving} id={inputId} class={className}>
      <textarea
        id={inputId}
        class="wb-input wb-textarea"
        rows={rows}
        value={live.value}
        placeholder={placeholder}
        disabled={readOnly}
        onInput={live.onInput}
        onFocus={live.onFocus}
        onBlur={live.onBlur}
        onKeyDown={live.onKeyDown}
      />
    </Wrap>
  );
}

export function LiveNumber({
  table,
  id,
  field,
  value,
  label,
  hideLabel,
  readOnly,
  placeholder,
  min,
  step,
  allowNull = false,
  class: className,
}: LiveBase & { min?: number; step?: number; allowNull?: boolean }) {
  const live = useLiveField(table, id, field, value, {
    parse: (draft) => {
      const text = draft.trim();
      if (!text) return allowNull ? null : 0;
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : allowNull ? null : 0;
    },
    onError: (error) => onError(error.message),
  });
  const inputId = `live-${id}-${field}`;
  return (
    <Wrap label={label} hideLabel={hideLabel} hint={live.hint} saving={live.saving} id={inputId} class={className}>
      <input
        id={inputId}
        class="wb-input wb-mono"
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={live.value}
        placeholder={placeholder}
        disabled={readOnly}
        onInput={live.onInput}
        onFocus={live.onFocus}
        onBlur={live.onBlur}
        onKeyDown={live.onKeyDown}
      />
    </Wrap>
  );
}

export function LiveDate({
  table,
  id,
  field,
  value,
  label,
  hideLabel,
  readOnly,
  class: className,
}: LiveBase) {
  const live = useLiveField(table, id, field, value, {
    immediate: true,
    parse: (draft) => (draft.trim() ? draft.trim() : null),
    onError: (error) => onError(error.message),
  });
  const inputId = `live-${id}-${field}`;
  return (
    <Wrap label={label} hideLabel={hideLabel} hint={live.hint} saving={live.saving} id={inputId} class={className}>
      <input
        id={inputId}
        class="wb-input wb-mono"
        type="date"
        value={live.value}
        disabled={readOnly}
        onInput={live.onInput}
        onFocus={live.onFocus}
        onBlur={live.onBlur}
      />
    </Wrap>
  );
}

export function LiveSelect<T extends string>({
  table,
  id,
  field,
  value,
  label,
  hideLabel,
  readOnly,
  options,
  size = 'md',
  tone,
  class: className,
}: LiveBase & { options: ReadonlyArray<Option<T>>; size?: 'sm' | 'md'; tone?: string }) {
  const live = useLiveField(table, id, field, value, {
    immediate: true,
    onError: (error) => onError(error.message),
  });
  const inputId = `live-${id}-${field}`;
  return (
    <Wrap label={label} hideLabel={hideLabel} hint={live.hint} saving={live.saving} id={inputId} class={className}>
      <Select<T>
        id={inputId}
        value={live.value as T}
        options={options}
        size={size}
        tone={tone}
        disabled={readOnly}
        onValue={(next) => live.commit(next)}
      />
    </Wrap>
  );
}

export function LiveCheckbox({
  table,
  id,
  field,
  value,
  label,
  readOnly,
  class: className,
}: LiveBase) {
  const live = useLiveField(table, id, field, value, {
    immediate: true,
    onError: (error) => onError(error.message),
  });
  return (
    <label class={`wb-check${className ? ` ${className}` : ''}`}>
      <input
        type="checkbox"
        checked={live.value === 'true'}
        disabled={readOnly}
        onChange={(event) => live.commit((event.currentTarget as HTMLInputElement).checked)}
      />
      <span>{label}</span>
    </label>
  );
}
