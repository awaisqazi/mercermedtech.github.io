/**
 * A read-only value with a Copy button. Used for invitation links and for the
 * prewritten message that goes with them.
 *
 * `navigator.clipboard` needs a secure context and can be refused, so there is
 * always a fallback: the text is selected for the user to copy by hand and the
 * button says so.
 */
import { useRef, useState } from 'preact/hooks';
import { Button } from './Button';
import { IconCheck, IconCopy } from './Icons';

export interface CopyFieldProps {
  value: string;
  label: string;
  /** Renders a textarea instead of a single line. */
  multiline?: boolean;
  rows?: number;
  /** Shown instead of the value, for a long link. */
  display?: string;
}

export function CopyField({ value, label, multiline = false, rows = 4, display }: CopyFieldProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const field = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2000);
    } catch {
      field.current?.focus();
      field.current?.select();
      setState('manual');
    }
  };

  return (
    <div class="wb-copy">
      <label class="wb-label" for={`copy-${label}`}>
        {label}
      </label>
      <div class="wb-copy-row">
        {multiline ? (
          <textarea
            id={`copy-${label}`}
            class="wb-input wb-textarea wb-mono-soft"
            readOnly
            rows={rows}
            value={value}
            ref={field as { current: HTMLTextAreaElement | null }}
            onFocus={(event) => (event.currentTarget as HTMLTextAreaElement).select()}
          />
        ) : (
          <input
            id={`copy-${label}`}
            class="wb-input wb-mono-soft"
            readOnly
            value={display ?? value}
            ref={field as { current: HTMLInputElement | null }}
            onFocus={(event) => (event.currentTarget as HTMLInputElement).select()}
          />
        )}
        <Button
          variant={state === 'copied' ? 'primary' : 'secondary'}
          onClick={copy}
          icon={state === 'copied' ? <IconCheck size={16} /> : <IconCopy size={16} />}
        >
          {state === 'copied' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {state === 'manual' ? (
        <p class="wb-hint">This browser would not let us copy for you. The text is selected, so press the copy key.</p>
      ) : null}
    </div>
  );
}
