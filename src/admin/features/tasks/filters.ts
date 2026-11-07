/**
 * The Tasks screen's filters, grouping and the small rules every task view
 * shares (due wording, who may change what). Pure functions over rows, so the
 * list, the board and the drawer agree without asking each other.
 *
 * Filters live in the query string, so a filtered view is a link:
 *   view=list|board  scope=mine|all  project=<id>|none  person=<id>|none
 *   status=todo|doing|blocked|done  q=<text>
 */
import { useEffect, useState } from 'preact/hooks';
import { daysUntil, dueWording, formatDate } from '../../lib/format';
import { weekStart } from '../../lib/hours';
import { roleAllows } from '../../lib/perms';
import { TASK_STATUSES, type Project, type Role, type Task, type TaskStatus } from '../../lib/types';
import { byDue } from '../../lib/workspace';

export type TaskView = 'list' | 'board';
export type TaskScope = 'mine' | 'all';

/** "No project" and "Unassigned" as filter values. */
export const NONE = 'none';

export interface TaskFilters {
  view: TaskView;
  scope: TaskScope;
  project: string;
  person: string;
  status: TaskStatus | '';
  q: string;
}

const VIEW_KEY = 'wb.tasks.view';

/** The last view someone picked, for a visit without `view=` in the address. */
export function rememberedView(): TaskView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
}

export function rememberView(view: TaskView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* private mode: the address still carries it */
  }
}

export function readFilters(query: Record<string, string>): TaskFilters {
  const status = query.status as TaskStatus;
  return {
    view: query.view === 'board' ? 'board' : query.view === 'list' ? 'list' : rememberedView(),
    scope: query.scope === 'mine' ? 'mine' : 'all',
    project: query.project ?? '',
    person: query.person ?? '',
    status: TASK_STATUSES.includes(status) ? status : '',
    q: query.q ?? '',
  };
}

/** True when anything narrows the list beyond the defaults. */
export function isFiltered(filters: TaskFilters): boolean {
  return filters.scope === 'mine' || Boolean(filters.project || filters.person || filters.status || filters.q.trim());
}

export function activeFilterCount(filters: TaskFilters): number {
  return [filters.scope === 'mine', filters.project, filters.person, filters.status].filter(Boolean).length;
}

/** The Monday this week began, as `YYYY-MM-DD`. */
export function thisWeekStart(): string {
  return weekStart(new Date());
}

/** Done tasks only count while they are this week's news. */
export function doneThisWeek(task: Task, monday = thisWeekStart()): boolean {
  if (task.status !== 'done') return false;
  if (!task.done_at) return true;
  return task.done_at.slice(0, 10) >= monday;
}

export function applyFilters(
  tasks: readonly Task[],
  filters: TaskFilters,
  me: string | null,
  projects: readonly Project[]
): Task[] {
  const needle = filters.q.trim().toLowerCase();
  const codes = new Map(projects.map((project) => [project.id, `${project.code} ${project.name}`.toLowerCase()]));
  return tasks.filter((task) => {
    if (filters.person) {
      if (filters.person === NONE ? task.assignee_id !== null : task.assignee_id !== filters.person) return false;
    } else if (filters.scope === 'mine' && task.assignee_id !== me) {
      return false;
    }
    if (filters.project) {
      if (filters.project === NONE ? task.project_id !== null : task.project_id !== filters.project) return false;
    }
    if (filters.status && task.status !== filters.status) return false;
    if (needle) {
      const haystack = `${task.title} ${task.description} ${task.project_id ? (codes.get(task.project_id) ?? '') : ''}`;
      if (!haystack.toLowerCase().includes(needle)) return false;
    }
    return true;
  });
}

export interface TaskGroup {
  status: TaskStatus;
  label: string;
  tasks: Task[];
}

export const GROUP_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  blocked: 'Blocked',
  done: 'Done this week',
};

const byDoneAt = (a: Task, b: Task) => (b.done_at ?? '').localeCompare(a.done_at ?? '') || a.sort - b.sort;

/**
 * Four groups in board order. Done holds this week's work only, unless the
 * person asked for done tasks by name, when it holds all that are loaded.
 */
export function groupTasks(tasks: readonly Task[], filters: TaskFilters): TaskGroup[] {
  const monday = thisWeekStart();
  const askedForDone = filters.status === 'done';
  return TASK_STATUSES.map((status) => {
    const rows = tasks.filter(
      (task) => task.status === status && (status !== 'done' || askedForDone || doneThisWeek(task, monday))
    );
    rows.sort(status === 'done' ? byDoneAt : byDue);
    return {
      status,
      label: status === 'done' && askedForDone ? 'Done' : GROUP_LABEL[status],
      tasks: rows,
    };
  });
}

export interface DueInfo {
  text: string;
  tone: 'overdue' | 'soon' | 'plain' | 'done';
}

/** "2 days overdue" in the crit colour, "Due tomorrow" in warn, the rest plain. */
export function dueInfo(task: Pick<Task, 'due' | 'status' | 'done_at'>): DueInfo | null {
  if (task.status === 'done') {
    return task.done_at ? { text: `Done ${formatDate(task.done_at.slice(0, 10))}`, tone: 'done' } : null;
  }
  if (!task.due) return null;
  const days = daysUntil(task.due);
  if (days === null) return null;
  const text = dueWording(task.due);
  if (days < 0) return { text, tone: 'overdue' };
  if (days <= 2) return { text, tone: 'soon' };
  return { text, tone: 'plain' };
}

/* ------------------------------------------------------------ who may --- */

/** Edit the fields, the checklist, move it: edit_any, or you made it, or it is yours. */
export function canEditTask(task: Task, me: string | null, role: Role | null): boolean {
  if (!me) return false;
  return roleAllows(role, 'tasks.edit_any') || task.created_by === me || task.assignee_id === me;
}

/** Delete: tasks.delete, or a task you made. */
export function canDeleteTask(task: Task, me: string | null, role: Role | null): boolean {
  if (!me) return false;
  return roleAllows(role, 'tasks.delete') || task.created_by === me;
}

const PHONE_QUERY = '(max-width: 719px)';

/** A phone, by the same 720px line the drawer uses. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const list = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return phone;
}

/** True when a key press is going into a field, so a shortcut must stay out of it. */
export function isTyping(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node || !node.tagName) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) || node.isContentEditable;
}
