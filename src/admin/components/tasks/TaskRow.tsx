/**
 * One line of the Plan: status, title, workstream, who has it, when it is
 * due. Everything else about the task lives in its panel, which opens when
 * the row is clicked.
 *
 * The status and the assignee can be changed from the row itself, because
 * those are the two changes people make many times a day; both are small
 * menus that a keyboard reaches with Tab and works with the arrow keys.
 */
import type { Task, TaskStatus, WorkstreamDef } from '../../lib/types';
import { PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES } from '../../lib/types';
import { updateRow, useProject, usePresence } from '../../lib/store';
import { getAuth } from '../../lib/auth';
import { dueWording, formatDate, daysUntil } from '../../lib/format';
import { toast } from '../../lib/toasts';
import { Avatar } from '../Avatar';
import { Menu, type MenuItem } from '../Menu';
import { IconAccount, IconCheck } from '../Icons';
import { workstreamLabel } from './shared';

export function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span class={`wb-status-dot is-${status}`} aria-hidden="true">
      {status === 'done' ? <IconCheck size={11} /> : null}
    </span>
  );
}

async function save(task: Task, patch: Partial<Task>): Promise<void> {
  const result = await updateRow('tasks', task.id, patch as Record<string, unknown>);
  if (!result.ok && result.error) toast.bad(result.error.message);
}

export function StatusControl({ task, disabled }: { task: Task; disabled?: boolean }) {
  const items: MenuItem[] = TASK_STATUSES.map((status) => ({
    key: status,
    label: STATUS_LABEL[status],
    icon: <StatusDot status={status} />,
    hint: status === task.status ? 'Now' : undefined,
    onSelect: () => {
      if (status !== task.status) void save(task, { status });
    },
  }));
  if (disabled) {
    return (
      <span class="wb-status-button is-static" title={STATUS_LABEL[task.status]}>
        <StatusDot status={task.status} />
        <span class="wb-sr">{STATUS_LABEL[task.status]}</span>
      </span>
    );
  }
  return (
    <Menu
      align="left"
      label="Status"
      items={items}
      trigger={(props) => (
        <button
          type="button"
          class="wb-status-button"
          title={`${STATUS_LABEL[task.status]}. Change the status`}
          {...props}
        >
          <StatusDot status={task.status} />
          <span class="wb-sr">Status: {STATUS_LABEL[task.status]}. Change it</span>
        </button>
      )}
    />
  );
}

export function AssigneeControl({ task, disabled, size = 26 }: { task: Task; disabled?: boolean; size?: number }) {
  const { members, profiles } = useProject();
  const me = getAuth().userId;
  const person = task.assignee ? profiles[task.assignee] : null;
  const name = person?.full_name?.trim() || person?.email || '';

  const items: MenuItem[] = [
    ...(me && task.assignee !== me
      ? [{ key: 'me', label: 'Assign to me', icon: <IconAccount size={16} />, onSelect: () => void save(task, { assignee: me }) }]
      : []),
    ...members
      .filter((member) => member.user_id !== me)
      .map((member, index) => {
        const profile = profiles[member.user_id];
        return {
          key: member.user_id,
          label: profile?.full_name?.trim() || profile?.email || 'Member',
          icon: <Avatar id={member.user_id} name={profile?.full_name} email={profile?.email} size={18} />,
          divider: index === 0 && Boolean(me && task.assignee !== me),
          hint: member.user_id === task.assignee ? 'Has it now' : undefined,
          onSelect: () => void save(task, { assignee: member.user_id }),
        };
      }),
    ...(task.assignee
      ? [{ key: 'nobody', label: 'Nobody', divider: true, onSelect: () => void save(task, { assignee: null }) }]
      : []),
  ];

  const face = task.assignee ? (
    <Avatar id={task.assignee} name={person?.full_name} email={person?.email} size={size} />
  ) : (
    <span class="wb-avatar wb-avatar-empty" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
      <IconAccount size={Math.round(size * 0.55)} />
    </span>
  );

  if (disabled) {
    return <span class="wb-assignee" title={name ? `Assigned to ${name}` : 'Nobody yet'}>{face}</span>;
  }

  return (
    <Menu
      align="right"
      label="Assign"
      items={items}
      trigger={(props) => (
        <button
          type="button"
          class="wb-assignee"
          title={name ? `Assigned to ${name}. Change it` : 'Nobody yet. Assign it'}
          aria-label={name ? `Assigned to ${name}. Change it` : 'Nobody yet. Assign it'}
          {...props}
        >
          {face}
        </button>
      )}
    />
  );
}

export function DueChip({ task, short = false }: { task: Task; short?: boolean }) {
  if (!task.due) return null;
  const days = daysUntil(task.due);
  const late = task.status !== 'done' && days !== null && days < 0;
  const soon = task.status !== 'done' && days !== null && days >= 0 && days <= 2;
  return (
    <span class={`wb-due${late ? ' is-late' : soon ? ' is-soon' : ''}`} title={formatDate(task.due)}>
      {task.status === 'done' || short ? formatDate(task.due) : dueWording(task.due)}
    </span>
  );
}

export interface TaskRowProps {
  task: Task;
  workstreams: WorkstreamDef[];
  open: boolean;
  changed: boolean;
  onOpen: (id: string) => void;
}

export function TaskRow({ task, workstreams, open, changed, onOpen }: TaskRowProps) {
  const { readOnly } = useProject();
  const peers = usePresence();
  const temporary = task.id.startsWith('temp-');
  const viewers = peers.filter((peer) => peer.editing === `task:${task.id}`);

  return (
    <li
      class={`wb-row wb-pri-${task.pri}${open ? ' is-open' : ''}${task.status === 'done' ? ' is-done' : ''}${
        temporary ? ' is-pending' : ''
      }`}
      data-task={task.id}
    >
      <span class="wb-row-stripe" aria-hidden="true" title={PRIORITY_LABEL[task.pri]} />
      <StatusControl task={task} disabled={readOnly || temporary} />
      <button
        type="button"
        class="wb-row-main"
        onClick={() => onOpen(task.id)}
        aria-label={`${task.title}. Open the details`}
      >
        <span class="wb-row-title">
          {changed ? <span class="wb-new-dot" title="Changed since you were last here" /> : null}
          {task.title}
        </span>
        <span class="wb-row-meta">
          {task.pri !== 'normal' ? (
            <span class={`wb-pri-word is-${task.pri}`}>{PRIORITY_LABEL[task.pri]}</span>
          ) : null}
          {task.status === 'blocked' ? <span class="wb-pri-word is-blocked">Blocked</span> : null}
          {task.ws ? <span class="wb-ws">{workstreamLabel(task.ws, workstreams)}</span> : null}
        </span>
      </button>
      <span class="wb-row-side">
        {viewers.length ? (
          <span class="wb-row-viewers" title={`${viewers.map((peer) => peer.name).join(', ')} looking at this`}>
            {viewers.slice(0, 2).map((peer) => (
              <Avatar key={peer.user_id} id={peer.user_id} name={peer.name} size={18} active />
            ))}
          </span>
        ) : null}
        <DueChip task={task} />
        <AssigneeControl task={task} disabled={readOnly || temporary} />
      </span>
    </li>
  );
}
