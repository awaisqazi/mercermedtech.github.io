/**
 * The message strip. One aria-live region so a screen reader hears the same
 * sentence a sighted user reads, and an icon beside the colour so the tone is
 * never carried by colour alone.
 */
import { dismissToast, useToasts, type ToastTone } from '../lib/toasts';
import { IconCheck, IconClose, IconWarning } from './Icons';
import { Button } from './Button';

const TONE_WORD: Record<ToastTone, string> = {
  info: 'Note',
  good: 'Done',
  warn: 'Careful',
  bad: 'Problem',
};

export function Toasts() {
  const toasts = useToasts();

  return (
    <div class="wb-toasts" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((item) => (
        <div key={item.id} class={`wb-toast wb-toast-${item.tone}`}>
          <span class="wb-toast-icon" aria-hidden="true">
            {item.tone === 'good' ? <IconCheck size={16} /> : <IconWarning size={16} />}
          </span>
          <span class="wb-toast-body">
            <span class="wb-sr">{TONE_WORD[item.tone]}: </span>
            {item.message}
          </span>
          <Button
            variant="quiet"
            size="sm"
            iconOnly
            aria-label="Dismiss"
            onClick={() => dismissToast(item.id)}
            icon={<IconClose size={15} />}
          />
        </div>
      ))}
    </div>
  );
}
