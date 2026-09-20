/**
 * The inline "add" form. Title is the only thing it insists on; everything
 * else can be filled in afterwards on the card.
 */
import { useState } from 'preact/hooks';
import type { Horizon, Task, TaskPriority, WorkstreamDef } from '../../lib/types';
import { HORIZONS, HORIZON_LABEL, PRIORITY_LABEL, TASK_PRIORITIES } from '../../lib/types';
import { insertRow } from '../../lib/store';
import { toast } from '../../lib/toasts';
import { Button } from '../Button';
import { Field, Input } from '../Field';
import { Select, optionsFrom } from '../Select';
import { IconPlus } from '../Icons';
import { nextSort } from './shared';

export interface AddTaskProps {
  tasks: Task[];
  workstreams: WorkstreamDef[];
  /** Pre-selects a horizon, for a board column or a filtered view. */
  defaultHorizon?: Horizon;
  defaultWs?: string;
  label?: string;
  onAdded?: (task: Task) => void;
}

export function AddTask({
  tasks,
  workstreams,
  defaultHorizon = 'now',
  defaultWs = '',
  label = 'Add a task',
  onAdded,
}: AddTaskProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [horizon, setHorizon] = useState<Horizon>(defaultHorizon);
  const [pri, setPri] = useState<TaskPriority>('normal');
  const [ws, setWs] = useState(defaultWs);
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setPri('normal');
    setDue('');
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setSaving(true);
    const result = await insertRow<Task>('tasks', {
      title: clean,
      horizon,
      pri,
      ws,
      due: due || null,
      sort: nextSort(tasks),
    });
    setSaving(false);
    if (result.ok) {
      reset();
      if (result.row) onAdded?.(result.row);
    } else if (result.error) {
      toast.bad(result.error.message);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" icon={<IconPlus size={16} />} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form class="wb-add-task" onSubmit={submit}>
      <Field label="What needs doing" hideLabel required class="wb-add-task-title">
        {(props) => (
          <Input
            {...props}
            value={title}
            placeholder="What needs doing"
            autoFocus
            onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
          />
        )}
      </Field>

      <div class="wb-add-task-row">
        <Select<Horizon>
          value={horizon}
          options={optionsFrom(HORIZONS, HORIZON_LABEL)}
          size="sm"
          aria-label="Horizon"
          onValue={setHorizon}
        />
        <Select<TaskPriority>
          value={pri}
          options={optionsFrom(TASK_PRIORITIES, PRIORITY_LABEL)}
          size="sm"
          aria-label="Priority"
          onValue={setPri}
        />
        {workstreams.length ? (
          <Select
            value={ws}
            placeholder="No workstream"
            options={workstreams.map((entry) => ({ value: entry.key, label: entry.label }))}
            size="sm"
            aria-label="Workstream"
            onValue={setWs}
          />
        ) : null}
        <input
          class="wb-input wb-input-sm wb-mono"
          type="date"
          value={due}
          aria-label="Due date"
          onInput={(event) => setDue((event.currentTarget as HTMLInputElement).value)}
        />
      </div>

      <div class="wb-add-task-actions">
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" busy={saving} disabled={!title.trim()}>
          Add
        </Button>
      </div>
    </form>
  );
}
