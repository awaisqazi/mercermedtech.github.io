/**
 * Everything about one task that does not fit on its card.
 *
 * Written once and shown in two frames: inline under the card in List view,
 * and in a side drawer in Board view, where a 200px column has no room for it.
 * Because it is the same component, a field edited in one place behaves
 * exactly as it does in the other, and presence ("who is looking at this") is
 * announced from here — it is open details that make somebody an editor, not
 * the shape of the container around them.
 */
import { useEffect, useState } from 'preact/hooks';
import type { Task, WorkstreamDef } from '../../lib/types';
import {
  HORIZONS,
  HORIZON_LABEL,
  PRIORITY_LABEL,
  TASK_PRIORITIES,
} from '../../lib/types';
import { deleteRow, setPresence, updateRow, useProject } from '../../lib/store';
import { toast } from '../../lib/toasts';
import { Button } from '../Button';
import { CommentThread } from '../CommentThread';
import { LiveDate, LiveSelect, LiveText, LiveTextarea } from '../LiveField';
import { SourcesList } from '../SourcesList';
import { optionsFrom } from '../Select';
import { IconTrash } from '../Icons';

export interface TaskDetailsProps {
  task: Task;
  workstreams: WorkstreamDef[];
  /** Called after the row is gone, so the frame can close itself. */
  onDeleted?: (task: Task) => void;
}

export function TaskDetails({ task, workstreams, onDeleted }: TaskDetailsProps) {
  const { readOnly } = useProject();
  const [confirming, setConfirming] = useState(false);

  // Let everyone else know which task we have open, so their avatar lands on it.
  useEffect(() => {
    setPresence({ editing: `task:${task.id}` });
    return () => setPresence({ editing: '' });
  }, [task.id]);

  const remove = async () => {
    const result = await deleteRow('tasks', task.id);
    setConfirming(false);
    if (result.ok) {
      toast.good('Deleted.');
      onDeleted?.(task);
    } else if (result.error) {
      toast.bad(result.error.message);
    }
  };

  return (
    <>
      <div class="wb-grid-2">
        <LiveText
          table="tasks"
          id={task.id}
          field="title"
          value={task.title}
          label="Title"
          readOnly={readOnly}
        />
        <LiveText
          table="tasks"
          id={task.id}
          field="owner"
          value={task.owner}
          label="Owner label"
          placeholder="A name or a team"
          readOnly={readOnly}
        />
        <LiveSelect
          table="tasks"
          id={task.id}
          field="horizon"
          value={task.horizon}
          label="Horizon"
          readOnly={readOnly}
          options={optionsFrom(HORIZONS, HORIZON_LABEL)}
        />
        <LiveSelect
          table="tasks"
          id={task.id}
          field="pri"
          value={task.pri}
          label="Priority"
          readOnly={readOnly}
          options={optionsFrom(TASK_PRIORITIES, PRIORITY_LABEL)}
        />
        <LiveDate
          table="tasks"
          id={task.id}
          field="due"
          value={task.due}
          label="Due"
          readOnly={readOnly}
        />
        {workstreams.length ? (
          <LiveSelect
            table="tasks"
            id={task.id}
            field="ws"
            value={task.ws}
            label="Workstream"
            readOnly={readOnly}
            options={[
              { value: '', label: 'None' },
              ...workstreams.map((entry) => ({ value: entry.key, label: entry.label })),
            ]}
          />
        ) : (
          <LiveText
            table="tasks"
            id={task.id}
            field="ws"
            value={task.ws}
            label="Workstream"
            readOnly={readOnly}
          />
        )}
      </div>

      <LiveTextarea
        table="tasks"
        id={task.id}
        field="why"
        value={task.why}
        label="Why it matters"
        readOnly={readOnly}
      />
      <LiveTextarea
        table="tasks"
        id={task.id}
        field="done_when"
        value={task.done_when}
        label="Done when"
        readOnly={readOnly}
      />
      <LiveTextarea
        table="tasks"
        id={task.id}
        field="notes"
        value={task.notes}
        label="Notes"
        rows={4}
        readOnly={readOnly}
      />

      <SourcesList
        sources={task.sources ?? []}
        title="Sources"
        readOnly={readOnly}
        onChange={async (next) => {
          const result = await updateRow('tasks', task.id, { sources: next });
          if (!result.ok && result.error) toast.bad(result.error.message);
        }}
      />

      <CommentThread entity="task" id={task.id} />

      {readOnly ? null : (
        <div class="wb-task-danger">
          {confirming ? (
            <>
              <span class="wb-task-danger-text">Delete this task for everyone?</span>
              <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
              <Button variant="danger" size="sm" onClick={remove}>
                Delete
              </Button>
            </>
          ) : (
            <Button
              variant="quiet"
              size="sm"
              icon={<IconTrash size={15} />}
              onClick={() => setConfirming(true)}
            >
              Delete task
            </Button>
          )}
        </div>
      )}
    </>
  );
}
