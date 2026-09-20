/**
 * One task. The card itself is the summary row; Details opens the rest in
 * place. Everything is bound to the row through LiveField, so two people can
 * work on the same task and neither loses what they are typing.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Task, TaskStatus, WorkstreamDef } from '../../lib/types';
import {
  HORIZONS,
  HORIZON_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../../lib/types';
import { deleteRow, setPresence, updateRow, useProject, usePresence } from '../../lib/store';
import { dueWording, formatDate, initials, isOverdue, userColor } from '../../lib/format';
import { toast } from '../../lib/toasts';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { CommentThread } from '../CommentThread';
import { LiveDate, LiveSelect, LiveText, LiveTextarea } from '../LiveField';
import { SourcesList } from '../SourcesList';
import { Select, optionsFrom } from '../Select';
import { IconChevronDown, IconTrash, IconWarning } from '../Icons';
import { workstreamLabel } from './shared';

export interface TaskCardProps {
  task: Task;
  workstreams: WorkstreamDef[];
  /** Board cards are narrower and hide a couple of controls. */
  compact?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  onDelete?: (task: Task) => void;
  /** Called when a card becomes the deep-link target, so it can scroll. */
  autoScroll?: boolean;
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
}

export function TaskCard({
  task,
  workstreams,
  compact = false,
  open = false,
  onToggle,
  onDelete,
  autoScroll = false,
  draggable = false,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const { readOnly, members, profiles } = useProject();
  const peers = usePresence();
  const node = useRef<HTMLElement>(null);
  const [confirming, setConfirming] = useState(false);
  const temporary = task.id.startsWith('temp-');

  const editors = peers.filter((peer) => peer.editing === `task:${task.id}`);

  useEffect(() => {
    if (!autoScroll || !node.current) return;
    node.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [autoScroll]);

  // Let everyone else know which card is open, so their avatar lands on it.
  useEffect(() => {
    if (!open) return undefined;
    setPresence({ editing: `task:${task.id}` });
    return () => setPresence({ editing: '' });
  }, [open, task.id]);

  const overdue = isOverdue(task.due) && task.status !== 'done';
  const assigneeOptions = [
    { value: '', label: 'Nobody' },
    ...members.map((member) => ({
      value: member.user_id,
      label: profiles[member.user_id]?.full_name?.trim() || profiles[member.user_id]?.email || 'Member',
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
      onDelete?.(task);
    } else if (result.error) {
      toast.bad(result.error.message);
    }
  };

  return (
    <article
      class={`wb-task wb-pri-${task.pri}${open ? ' is-open' : ''}${compact ? ' is-compact' : ''}${
        temporary ? ' is-pending' : ''
      }`}
      id={`task-${task.id}`}
      ref={node}
      draggable={draggable && !readOnly && !temporary}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={editors.length ? { boxShadow: `0 0 0 2px ${userColor(editors[0]!.user_id)}` } : undefined}
    >
      <span class="wb-task-stripe" aria-hidden="true" />

      <div class="wb-task-main">
        <div class="wb-task-title-row">
          <h3 class="wb-task-title">{task.title}</h3>
          {editors.length ? (
            <span
              class="wb-task-editor"
              style={{ background: userColor(editors[0]!.user_id) }}
              title={`${editors.map((peer) => peer.name).join(', ')} looking at this`}
            >
              {initials(editors[0]!.name)}
            </span>
          ) : null}
        </div>

        <div class="wb-task-meta">
          {task.ws ? <Chip tone="quiet">{workstreamLabel(task.ws, workstreams)}</Chip> : null}
          {task.pri !== 'normal' ? (
            <Chip tone={task.pri === 'critical' ? 'crit' : 'warn'}>{PRIORITY_LABEL[task.pri]}</Chip>
          ) : null}
          {task.due ? (
            <span class={`wb-task-due wb-mono-soft${overdue ? ' is-overdue' : ''}`}>
              {overdue ? <IconWarning size={13} /> : null}
              {compact ? formatDate(task.due) : dueWording(task.due)}
            </span>
          ) : null}
          {task.recurring ? <Chip tone="quiet">{task.recurring}</Chip> : null}
        </div>

        <div class="wb-task-controls">
          <LiveSelect<TaskStatus>
            table="tasks"
            id={task.id}
            field="status"
            value={task.status}
            label="Status"
            hideLabel
            size="sm"
            tone={task.status}
            readOnly={readOnly || temporary}
            options={optionsFrom(TASK_STATUSES, STATUS_LABEL)}
          />

          {compact ? null : (
            <Select
              value={task.assignee ?? ''}
              options={assigneeOptions}
              size="sm"
              aria-label="Assigned to"
              disabled={readOnly || temporary}
              onValue={(value) => void setAssignee(value)}
            />
          )}

          <Button
            variant="quiet"
            size="sm"
            class="wb-task-disclosure"
            aria-expanded={open}
            onClick={() => onToggle?.(!open)}
            icon={<IconChevronDown size={15} class={open ? 'wb-flip-y' : ''} />}
          >
            {open ? 'Hide' : 'Details'}
          </Button>
        </div>
      </div>

      {open ? (
        <div class="wb-task-details">
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
        </div>
      ) : null}
    </article>
  );
}
