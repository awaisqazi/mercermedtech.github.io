/**
 * Inputs bound to a value inside a `project_state` blob.
 *
 * `LiveField` binds one column of one row; these bind one key inside the JSON
 * that `useProjectState` hands back, which is where the metrics and the budget
 * live. The behaviour is deliberately the same as LiveField's: numbers save on
 * blur and on Enter, dates save on change, Escape puts back what the server
 * has, and a read-only viewer gets a disabled control rather than no control.
 *
 * The write itself is the caller's: `onSave` is normally a one-liner around
 * the patch function from `useProjectState`, which is serialised per key, so
 * two quick edits cannot race each other.
 */
import type { JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { MutationResult } from '../../lib/store';
import { toast } from '../../lib/toasts';

export interface StateFieldProps {
  label: string;
  /** Hides the label visually but keeps it for screen readers. */
  hideLabel?: boolean;
  value: unknown;
  readOnly?: boolean;
  placeholder?: string;
  class?: string;
  /** Saves the parsed value. Returning the store's result surfaces errors. */
  onSave: (next: unknown) => Promise<MutationResult>;
}

const toText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

function useDraft(value: unknown) {
  const [draft, setDraft] = useState(() => toText(value));
  const [saving, setSaving] = useState(false);
  const focused = useRef(false);

  // Follow the server while the cursor is somewhere else.
  useEffect(() => {
    if (focused.current) return;
    setDraft(toText(value));
  }, [value]);

  return { draft, setDraft, saving, setSaving, focused };
}

function Wrap({
  label,
  hideLabel,
  saving,
  id,
  class: className,
  children,
}: {
  label: string;
  hideLabel?: boolean;
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
    </div>
  );
}

/** A number inside a state blob: whole by default, decimal with `integer={false}`. */
export function StateNumber({
  label,
  hideLabel,
  value,
  readOnly,
  placeholder,
  class: className,
  onSave,
  min = 0,
  step = 1,
  integer = true,
}: StateFieldProps & { min?: number; step?: number; integer?: boolean }) {
  const { draft, setDraft, saving, setSaving, focused } = useDraft(value);
  const id = useId();

  const current = Number.isFinite(Number(value)) ? Number(value) : 0;

  const commit = async (raw: string) => {
    const text = raw.trim();
    const parsed = text ? Number(text) : 0;
    let next = Number.isFinite(parsed) ? parsed : current;
    if (integer) next = Math.round(next);
    if (typeof min === 'number' && next < min) next = min;

    if (next === current) {
      setDraft(toText(next));
      return;
    }
    setSaving(true);
    const result = await onSave(next);
    setSaving(false);
    if (result.ok) {
      setDraft(toText(next));
    } else {
      setDraft(toText(value));
      if (result.error) toast.bad(result.error.message);
    }
  };

  return (
    <Wrap label={label} hideLabel={hideLabel} saving={saving} id={id} class={className}>
      <input
        id={id}
        class="wb-input wb-mono"
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        min={min}
        step={step}
        value={draft}
        placeholder={placeholder}
        disabled={readOnly}
        onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={(event) => {
          focused.current = false;
          void commit((event.currentTarget as HTMLInputElement).value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
          if (event.key === 'Escape') {
            setDraft(toText(value));
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
    </Wrap>
  );
}

/** A `YYYY-MM-DD` date inside a state blob. Saves as soon as it changes. */
export function StateDate({
  label,
  hideLabel,
  value,
  readOnly,
  class: className,
  onSave,
}: StateFieldProps) {
  const { draft, setDraft, saving, setSaving, focused } = useDraft(value);
  const id = useId();

  const commit = async (raw: string) => {
    const next = raw.trim() ? raw.trim() : null;
    if (next === (typeof value === 'string' ? value : null)) return;
    setSaving(true);
    const result = await onSave(next);
    setSaving(false);
    if (!result.ok) {
      setDraft(toText(value));
      if (result.error) toast.bad(result.error.message);
    }
  };

  return (
    <Wrap label={label} hideLabel={hideLabel} saving={saving} id={id} class={className}>
      <input
        id={id}
        class="wb-input wb-mono"
        type="date"
        value={draft}
        disabled={readOnly}
        onInput={(event) => {
          const next = (event.currentTarget as HTMLInputElement).value;
          setDraft(next);
          void commit(next);
        }}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
        }}
      />
    </Wrap>
  );
}
