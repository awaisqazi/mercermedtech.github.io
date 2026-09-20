import type { JSX } from 'preact';

export interface Option<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
  /**
   * Puts this option under a heading. Consecutive options carrying the same
   * group share one `<optgroup>`, so the caller controls the order by the
   * order of the array and nothing has to be sorted here.
   */
  group?: string;
}

export interface SelectProps<T extends string = string>
  extends Omit<JSX.IntrinsicElements['select'], 'onChange' | 'value' | 'size'> {
  value: T | '';
  options: ReadonlyArray<Option<T>>;
  onValue: (value: T) => void;
  /** Adds an empty first option with this label. */
  placeholder?: string;
  size?: 'sm' | 'md';
  /** Colours the control by its value, for status pickers. */
  tone?: string;
}

/**
 * A native select. Native on purpose: it is the one picker that works on every
 * phone, with a keyboard, and with a screen reader, with no code from us.
 */
export function Select<T extends string = string>({
  value,
  options,
  onValue,
  placeholder,
  size = 'md',
  tone,
  class: className,
  ...rest
}: SelectProps<T>) {
  const classes = ['wb-select', `wb-select-${size}`, tone ? `wb-tone-${tone}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span class="wb-select-wrap">
      <select
        {...rest}
        class={classes}
        value={value}
        onChange={(event) => onValue((event.currentTarget as HTMLSelectElement).value as T)}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {groupOptions(options).map((run) =>
          run.group ? (
            <optgroup key={`g:${run.group}`} label={run.group}>
              {run.items.map(renderOption)}
            </optgroup>
          ) : (
            run.items.map(renderOption)
          )
        )}
      </select>
      <svg class="wb-select-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="m6 9.5 6 6 6-6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  );
}

function renderOption<T extends string>(option: Option<T>) {
  return (
    <option key={option.value} value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  );
}

/** Splits an option list into consecutive runs that share a group heading. */
function groupOptions<T extends string>(
  options: ReadonlyArray<Option<T>>
): Array<{ group: string | undefined; items: Array<Option<T>> }> {
  const runs: Array<{ group: string | undefined; items: Array<Option<T>> }> = [];
  for (const option of options) {
    const last = runs[runs.length - 1];
    if (last && last.group === option.group) last.items.push(option);
    else runs.push({ group: option.group, items: [option] });
  }
  return runs;
}

/** Turns a label map into options, keeping the order of the keys array. */
export function optionsFrom<T extends string>(
  keys: readonly T[],
  labels: Record<T, string>
): Array<Option<T>> {
  return keys.map((key) => ({ value: key, label: labels[key] }));
}
