/**
 * Everything about one task, in one panel: a drawer on the right on a wide
 * screen, a centred panel on a laptop, a full-screen sheet on a phone.
 *
 * Every field is bound to the row through LiveField, so two people can have
 * the same task open and neither loses what they are typing: a field under
 * your cursor is never overwritten, and a change somebody else makes while
 * you have the task open is announced with a toast (see `headsUp` in
 * store.ts). Opening it tells everyone else, through presence, that you are
 * looking at it; their avatar shows up here when they are too.
 */
import { useEffect, useState } from 'preact/hooks';
import type { Task, WorkstreamDef } from '../../lib/types';
import {
  HORIZONS,
  HORIZON_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../../lib/types';
import { deleteRow, setPresence, updateRow, useProject, usePresence } from '../../lib/store';
import { getAuth } from '../../lib/auth';
import { fullTime, relativeTime } from '../../lib/format';
import { toast } from '../../lib/toasts';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { CommentThread } from '../CommentThread';
import { History } from '../History';
import { LiveDate, LiveSelect, LiveText, LiveTextarea } from '../LiveField';
import { Menu } from '../Menu';
import { Modal } from '../Modal';
import { Select, optionsFrom } from '../Select';
import { SourcesList } from '../SourcesList';
import { IconDots, IconTrash } from '../Icons';

export interface TaskModalProps {
  task: Task | null;
  workstreams: WorkstreamDef[];
  onClose: () => void;
}

export function TaskModal({ task, workstreams, onClose }: TaskModalProps) {
  const { readOnly, members, profiles } = useProject();
  const peers = usePresence();
  const [confirming, setConfirming] = useState(false);
  const me = getAuth().userId;
  const id = task?.id ?? '';

  // Let everyone else know which task we have open, so their avatar lands on it.
  useEffect(() => {
    if (!id) return;
    setPresence({ editing: `task:${id}` });
    setConfirming(false);
    return () => setPresence({ editing: '' });
  }, [id]);

  if (!task) return null;

  const temporary = task.id.startsWith('temp-');
  const locked = readOnly || temporary;
  const here = peers.filter((peer) => peer.editing === `task:${task.id}`);
  const editor = task.updated_by ? profiles[task.updated_by] : null;

  const assigneeOptions = [
    { value: '', label: 'Nobody yet' },
    ...members.map((member) => ({
      value: member.user_id,
      label:
        (profiles[member.user_id]?.full_name?.trim() || profiles[member.user_id]?.email || 'Member') +
        (member.user_id === me ? ' (you)' : ''),
    })),
  ];

  const setAssignee = async (value: string) => {
    const result = await updateRow('tasks', task.id, { assignee: value || null });
    if (!result.ok && result.error) toast.bad(result.error.message);
  };

  const remove = async () => {
    const result = await deleteRow('tasks', task.id);
    setConfirming(false);
    if (result.ok) {
      toast.good('Deleted.');
      onClose();
    } else if (result.error) {
      toast.bad(result.error.message);
    }
  };

  return (
    <Modal
      open
      side
      size="lg"
      label={`Task: ${task.title}`}
      onClose={onClose}
      initialFocus="panel"
      class="wb-task-modal"
      title={
        <LiveText
          table="tasks"
          id={task.id}
          field="title"
          value={task.title}
          label="Title"
          hideLabel
          readOnly={locked}
          class="wb-title-field"
        />
      }
      description={
        <span class="wb-task-modal-meta wb-mono-soft" title={fullTime(task.updated_at)}>
          Last changed {relativeTime(task.updated_at)}
          {editor ? ` by ${task.updated_by === me ? 'you' : editor.full_name?.trim() || editor.email}` : ''}
        </span>
      }
      actions={
        <>
          {here.length ? (
            <span class="wb-row-viewers" title={`${here.map((peer) => peer.name).join(', ')} also has this open`}>
              {here.map((peer) => (
                <Avatar key={peer.user_id} id={peer.user_id} name={peer.name} size={26} active />
              ))}
            </span>
          ) : null}
          {locked ? null : (
            <Menu
              align="right"
              items={[
                {
                  key: 'delete',
                  label: 'Delete this task',
                  icon: <IconTrash size={16} />,
                  tone: 'danger',
                  onSelect: () => setConfirming(true),
                },
              ]}
              trigger={(props) => (
                <button type="button" class="wb-icon-button" aria-label="More for this task" {...props}>
                  <IconDots />
                </button>
              )}
            />
          )}
        </>
      }
    >
      {confirming ? (
        <div class="wb-notice wb-notice-bad" role="alert">
          <div>
            <p class="wb-notice-title">Delete this task for everyone?</p>
            <p class="wb-notice-body">Its comments go with it. This cannot be undone from here.</p>
            <div class="wb-notice-action">
              <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
              <Button variant="danger" size="sm" onClick={remove}>
                Delete the task
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div class="wb-props">
        <LiveSelect
          table="tasks"
          id={task.id}
          field="status"
          value={task.status}
          label="Status"
          tone={task.status}
          readOnly={locked}
          options={optionsFrom(TASK_STATUSES, STATUS_LABEL)}
        />
        <LiveSelect
          table="tasks"
          id={task.id}
          field="pri"
          value={task.pri}
          label="Priority"
          readOnly={locked}
          options={optionsFrom(TASK_PRIORITIES, PRIORITY_LABEL)}
        />
        <LiveDate table="tasks" id={task.id} field="due" value={task.due} label="Due" readOnly={locked} />
        <LiveSelect
          table="tasks"
          id={task.id}
          field="horizon"
          value={task.horizon}
          label="Planned for"
          readOnly={locked}
          options={optionsFrom(HORIZONS, HORIZON_LABEL)}
        />
        <div class="wb-live">
          <span class="wb-label" id={`assignee-${task.id}`}>
            Assigned to
          </span>
          <div class="wb-assign-row">
            <Select
              value={task.assignee ?? ''}
              options={assigneeOptions}
              aria-labelledby={`assignee-${task.id}`}
              disabled={locked}
              onValue={(value) => void setAssignee(value)}
            />
            {!locked && me && task.assignee !== me ? (
              <Button variant="quiet" size="sm" onClick={() => void setAssignee(me)}>
                Assign to me
              </Button>
            ) : null}
          </div>
        </div>
        {workstreams.length ? (
          <LiveSelect
            table="tasks"
            id={task.id}
            field="ws"
            value={task.ws}
            label="Workstream"
            readOnly={locked}
            options={[
              { value: '', label: 'None' },
              ...workstreams.map((entry) => ({ value: entry.key, label: entry.label })),
            ]}
          />
        ) : (
          <LiveText table="tasks" id={task.id} field="ws" value={task.ws} label="Workstream" readOnly={locked} />
        )}
        <LiveText
          table="tasks"
          id={task.id}
          field="owner"
          value={task.owner}
          label="Owner label"
          placeholder="A name or a team"
          readOnly={locked}
        />
        <LiveText
          table="tasks"
          id={task.id}
          field="recurring"
          value={task.recurring}
          label="Repeats"
          placeholder="Monthly, weekly"
          readOnly={locked}
        />
      </div>

      <div class="wb-longform">
        <LiveTextarea
          table="tasks"
          id={task.id}
          field="why"
          value={task.why}
          label="Why it matters"
          readOnly={locked}
        />
        <LiveTextarea
          table="tasks"
          id={task.id}
          field="done_when"
          value={task.done_when}
          label="Done when"
          readOnly={locked}
        />
        <LiveTextarea
          table="tasks"
          id={task.id}
          field="notes"
          value={task.notes}
          label="Notes"
          rows={4}
          readOnly={locked}
        />
      </div>

      <SourcesList
        sources={task.sources ?? []}
        title="Sources"
        readOnly={locked}
        onChange={async (next) => {
          const result = await updateRow('tasks', task.id, { sources: next });
          if (!result.ok && result.error) toast.bad(result.error.message);
        }}
      />

      {temporary ? null : <CommentThread entity="task" id={task.id} />}
      {temporary ? null : <History entityId={task.id} />}
    </Modal>
  );
}
