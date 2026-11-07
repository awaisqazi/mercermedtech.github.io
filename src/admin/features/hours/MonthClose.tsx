/**
 * "Close month" / "Reopen month", for people with hours.close. Closing
 * freezes the month's entries (the database enforces it); reopening undoes it.
 * Both ask first, in words that say what will change.
 */
import { useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, Textarea } from '../../components/Field';
import { IconLock } from '../../components/Icons';
import { monthKey, monthLabel } from '../../lib/hours';
import { useCan } from '../../lib/perms';
import { toast } from '../../lib/toasts';
import type { HoursMonth } from '../../lib/types';
import { closeMonth, reopenMonth } from '../../lib/workspace';

export function MonthClose({ month, closedRow }: { month: string; closedRow: HoursMonth | null }) {
  const allowed = useCan('hours.close');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!allowed) return null;

  const label = monthLabel(month);
  const notOver = !closedRow && month >= monthKey(new Date());

  const confirm = async () => {
    setBusy(true);
    const result = closedRow ? await reopenMonth(month) : await closeMonth(month, note);
    setBusy(false);
    if (!result.ok) return;
    setAsking(false);
    setNote('');
    toast.good(closedRow ? `${label} is open again.` : `${label} is closed.`);
  };

  return (
    <>
      <Button icon={closedRow ? undefined : <IconLock size={16} />} onClick={() => setAsking(true)}>
        {closedRow ? 'Reopen month' : 'Close month'}
      </Button>
      <ConfirmDialog
        open={asking}
        busy={busy}
        title={closedRow ? `Reopen ${label}?` : `Close ${label}?`}
        confirmLabel={closedRow ? 'Reopen month' : 'Close month'}
        cancelLabel="Not now"
        onCancel={() => setAsking(false)}
        onConfirm={confirm}
        body={
          closedRow ? (
            <p class="wb-prose">People can add, change and delete entries dated in {label} again.</p>
          ) : (
            <div class="hours-close-body">
              <p class="wb-prose">
                Nobody can add, change or delete entries dated in {label} until you reopen it.
                {notOver ? ` ${label} is not over yet, so people may still have hours to log.` : ''}
              </p>
              <Field label="Note (optional)" hint="Shown next to the month. For example, what you checked it against.">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={2}
                    maxLength={300}
                    value={note}
                    onInput={(event) => setNote((event.currentTarget as HTMLTextAreaElement).value)}
                  />
                )}
              </Field>
            </div>
          )
        }
      />
    </>
  );
}
