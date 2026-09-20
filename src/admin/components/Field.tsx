/**
 * A labelled form control. The label is always a real `<label>` tied to the
 * control by id, hints and errors are tied by `aria-describedby`, and an error
 * sets `aria-invalid` — so the state is never carried by colour alone.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useId } from 'preact/hooks';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  /** Renders the label for screen readers only. */
  hideLabel?: boolean;
  required?: boolean;
  class?: string;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': 'true' | undefined;
  }) => ComponentChildren;
}

export function Field({
  label,
  hint,
  error,
  hideLabel = false,
  required = false,
  class: className,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div class={`wb-field${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label class={`wb-label${hideLabel ? ' wb-sr' : ''}`} for={id}>
        {label}
        {required ? <span class="wb-required" aria-hidden="true"> *</span> : null}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : undefined,
      })}
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

/** The plain input, so every text box in the portal looks the same. */
export function Input(props: JSX.IntrinsicElements['input']) {
  const { class: className, ...rest } = props;
  return <input {...rest} class={`wb-input${className ? ` ${className}` : ''}`} />;
}

export function Textarea(props: JSX.IntrinsicElements['textarea']) {
  const { class: className, ...rest } = props;
  return <textarea {...rest} class={`wb-input wb-textarea${className ? ` ${className}` : ''}`} />;
}

/** A checkbox with its own label, used in tables and toolbars. */
export function Checkbox({
  label,
  class: className,
  ...rest
}: JSX.IntrinsicElements['input'] & { label: ComponentChildren }) {
  return (
    <label class={`wb-check${className ? ` ${className}` : ''}`}>
      <input {...rest} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
