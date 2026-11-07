/**
 * The small pieces the list rows, the board cards and the drawer share: the
 * due words, the meta line, the assignee mark, the status menu, and opening
 * and closing the drawer through the address.
 */
import { Avatar } from '../../components/Avatar';
import { Menu } from '../../components/Menu';
import { Progress } from '../../components/Progress';
import { ProjectMark } from '../../components/ProjectMark';
import { PriorityWord, StatusDot } from '../../components/StatusDot';
import { IconCheck, IconChevronDown } from '../../components/Icons';
import { getRoute, href, patchQuery } from '../../lib/router';
import { STATUS_LABEL, TASK_STATUSES, type Task, type TaskStatus } from '../../lib/types';
import { setTaskStatus, useProfile, useProject, useTaskProgress } from '../../lib/workspace';
import { dueInfo } from './filters';

/* ------------------------------------------------------------ drawer --- */

/** True when the drawer was opened by a click here, so closing can go Back. */
let openedHere = false;

export function taskHref(id: string): string {
  const route = getRoute();
  return href('/tasks', { ...route.query, task: id, new: null });
}

/** Opens the drawer, keeping the filters. Pushed, so Back closes it. */
export function openTask(id: string, event?: MouseEvent): void {
  if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
  event?.preventDefault();
  openedHere = true;
  patchQuery({ task: id, new: null });
}

export function closeTask(): void {
  if (openedHere && typeof window !== 'undefined' && window.history.length > 1) {
    openedHere = false;
    window.history.back();
    return;
  }
  openedHere = false;
  patchQuery({ task: null }, { replace: true });
}

/* -------------------------------------------------------------- words --- */

export function DueWords({ task }: { task: Pick<Task, 'due' | 'status' | 'done_at'> }) {
  const info = dueInfo(task);
  if (!info) return null;
  const tone = info.tone === 'overdue' ? ' is-overdue' : info.tone === 'soon' ? ' is-soon' : '';
  return <span class={`wb-task-due${tone}`}>{info.text}</span>;
}

/** Project, due words, progress, priority: everything a row says under its title. */
export function TaskMeta({ task }: { task: Task }) {
  const project = useProject(task.project_id);
  const progress = useTaskProgress(task.id);
  const showProgress = progress.fromChecklist || (progress.percent > 0 && task.status !== 'done');
  return (
    <span class="wb-task-meta">
      {project ? <ProjectMark project={project} /> : null}
      <DueWords task={task} />
      {showProgress ? (
        <Progress
          compact
          done={progress.fromChecklist ? progress.done : undefined}
          total={progress.fromChecklist ? progress.total : undefined}
          percent={progress.percent}
        />
      ) : null}
      <PriorityWord priority={task.priority} />
    </span>
  );
}

export function AssigneeMark({ userId, size = 26 }: { userId: string | null; size?: number }) {
  const person = useProfile(userId);
  if (!person) {
    return (
      <span class="wb-task-nobody" title="Unassigned">
        <span class="wb-sr">Unassigned</span>
      </span>
    );
  }
  const name = person.full_name || person.email || 'Someone';
  return <Avatar id={person.id} name={person.full_name} email={person.email} size={size} title={`Assigned to ${name}`} />;
}

/* --------------------------------------------------------- status menu --- */

/**
 * The status as a button that opens the four choices: how a card moves on a
 * phone, and how it moves by keyboard anywhere.
 */
export function StatusMenu({
  task,
  onChanged,
  align = 'right',
}: {
  task: Task;
  onChanged?: (status: TaskStatus) => void;
  align?: 'left' | 'right';
}) {
  return (
    <Menu
      label="Status"
      align={align}
      items={TASK_STATUSES.map((status) => ({
        key: status,
        label: STATUS_LABEL[status],
        icon: status === task.status ? <IconCheck size={16} /> : <span class="wb-task-menu-gap" />,
        onSelect: () => {
          if (status === task.status) return;
          void setTaskStatus(task.id, status);
          onChanged?.(status);
        },
      }))}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          class="wb-task-status-button"
          aria-label={`Status: ${STATUS_LABEL[task.status]}. Change the status of ${task.title}`}
        >
          <StatusDot status={task.status} />
          <IconChevronDown size={14} />
        </button>
      )}
    />
  );
}
