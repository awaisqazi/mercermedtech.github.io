/**
 * One task. The card itself is the summary row; Details opens the rest either
 * in place (List view) or in the board's side drawer. Everything is bound to
 * the row through LiveField, so two people can work on the same task and
 * neither loses what they are typing.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { Task, TaskStatus, WorkstreamDef } from '../../lib/types';
import { PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES } from '../../lib/types';
import { updateRow, useProject, usePresence } from '../../lib/store';
import { dueWording, formatDate, initials, isOverdue, userColor } from '../../lib/format';
import { toast } from '../../lib/toasts';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { LiveSelect } from '../LiveField';
import { Select, optionsFrom } from '../Select';
import { IconAccount, IconChevronDown, IconWarning } from '../Icons';
import { TaskDetails } from './TaskDetails';
import { workstreamLabel } from './shared';

export interface TaskCardProps {
  task: Task;
  workstreams: WorkstreamDef[];
  /** Board cards are narrower and hide a couple of controls. */
  compact?: boolean;
  open?: boolean;
  /**
   * Whether an open card shows its details underneath. The board sets this to
   * false: the card only lights up, and the details live in the drawer.
   */
  inlineDetails?: boolean;
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
  inlineDetails = true,
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
  const temporary = task.id.startsWith('temp-');

  const editors = peers.filter((peer) => peer.editing === `task:${task.id}`);

  useEffect(() => {
    if (!autoScroll || !node.current) return;
    node.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [autoScroll]);

  const overdue = isOverdue(task.due) && task.status !== 'done';
  const ownerLabel = task.owner.trim();
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

          {/* The free-text owner used to be invisible until Details was open,
              which made a card look unowned when it was not. */}
          {ownerLabel ? (
            <Chip
              tone="quiet"
              class="wb-task-owner"
              icon={<IconAccount size={12} />}
              title={`Owner label: ${ownerLabel}`}
            >
              {ownerLabel}
            </Chip>
          ) : null}

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

      {open && inlineDetails ? (
        <div class="wb-task-details">
          <TaskDetails task={task} workstreams={workstreams} onDeleted={onDelete} />
        </div>
      ) : null}
    </article>
  );
}
