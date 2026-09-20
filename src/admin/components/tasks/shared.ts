/**
 * Shared shapes and small helpers for the task components. The same set backs
 * "Tasks" in a general project and "Deliverables" in a grant, so nothing in
 * here knows which it is.
 */
import type { Horizon, Task, TaskPriority, TaskStatus, WorkstreamDef } from '../../lib/types';
import { daysUntil, firstName } from '../../lib/format';

/**
 * A `who` filter value that stands for a free-text owner label rather than a
 * member. Prefixed so it can never collide with a user id.
 */
export const OWNER_PREFIX = 'owner:';

export interface TaskFilters {
  search: string;
  ws: string;
  status: TaskStatus | '';
  who: string;
  horizon: Horizon | '';
  hideDone: boolean;
}

export const EMPTY_FILTERS: TaskFilters = {
  search: '',
  ws: '',
  status: '',
  who: '',
  // Done work is history, not a to-do list: it starts out of the way and the
  // toolbar remembers whoever wants it back.
  hideDone: true,
  horizon: '',
};

export type TaskView = 'list' | 'board';

/** The label to show for a workstream key, falling back to the key itself. */
export function workstreamLabel(key: string, workstreams: WorkstreamDef[]): string {
  if (!key) return '';
  return workstreams.find((entry) => entry.key === key)?.label ?? key;
}

export interface MatchContext {
  /** Matches `who` against the assignee id and the free-text owner label. */
  nameOf: (userId: string | null) => string;
}

export function matchesFilters(task: Task, filters: TaskFilters, context: MatchContext): boolean {
  if (filters.hideDone && task.status === 'done') return false;
  if (filters.ws && task.ws !== filters.ws) return false;
  if (filters.status && task.status !== filters.status) return false;
  if (filters.horizon && task.horizon !== filters.horizon) return false;

  if (filters.who) {
    if (filters.who === 'unassigned') {
      if (task.assignee || task.owner.trim()) return false;
    } else if (filters.who.startsWith(OWNER_PREFIX)) {
      // An owner label picked from the list: it has to be that exact label.
      if (task.owner.trim() !== filters.who.slice(OWNER_PREFIX.length)) return false;
    } else if (task.assignee !== filters.who) {
      // Also let a free-text owner label stand in for a person.
      const name = firstName(context.nameOf(filters.who)).toLowerCase();
      if (!name || !task.owner.toLowerCase().includes(name)) return false;
    }
  }

  if (filters.search) {
    const needle = filters.search.toLowerCase();
    const haystack = [task.title, task.ws, task.owner, task.why, task.done_when, task.notes]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/* ------------------------------------------------------------- ordering --- */

/**
 * The reading order of a work list: what is stuck first, then what is moving,
 * then what has not started, and finished work at the bottom. Within a status
 * the loudest priority wins, then the nearest due date (an undated item sits
 * after every dated one), then whatever order somebody arranged by hand.
 */
const STATUS_RANK: Record<TaskStatus, number> = { blocked: 0, doing: 1, todo: 2, done: 3 };
const PRIORITY_RANK: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2 };
const HORIZON_RANK: Record<Horizon, number> = { now: 0, next: 1, later: 2 };

export function compareTasks(a: Task, b: Task): number {
  const status = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
  if (status) return status;

  const priority = (PRIORITY_RANK[a.pri] ?? 9) - (PRIORITY_RANK[b.pri] ?? 9);
  if (priority) return priority;

  // Blanks last, and only then: two blanks are still a tie to be broken below.
  const dueA = a.due || '';
  const dueB = b.due || '';
  if (dueA !== dueB) {
    if (!dueA) return 1;
    if (!dueB) return -1;
    return dueA < dueB ? -1 : 1;
  }

  return a.sort - b.sort;
}

/**
 * Horizon-major, so that a list grouped into Now / Next / Later can slice the
 * array for paging and still get whole groups, and so that a board column
 * reads in the same order as the list.
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const horizon = (HORIZON_RANK[a.horizon] ?? 9) - (HORIZON_RANK[b.horizon] ?? 9);
    return horizon || compareTasks(a, b);
  });
}

/** The distinct free-text owner labels in use, in alphabetical order. */
export function ownerLabels(tasks: Task[]): string[] {
  const seen = new Set<string>();
  for (const task of tasks) {
    const label = task.owner.trim();
    if (label && !/^(unassigned|nobody|none|n\/a|tbd)$/i.test(label)) seen.add(label);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Critical, blocked, or overdue: the things worth interrupting someone for. */
export function needsAttention(task: Task): boolean {
  if (task.status === 'done') return false;
  if (task.pri === 'critical') return true;
  if (task.status === 'blocked') return true;
  const days = daysUntil(task.due);
  return days !== null && days < 0;
}

export function isOverdueTask(task: Task): boolean {
  if (task.status === 'done') return false;
  const days = daysUntil(task.due);
  return days !== null && days < 0;
}

/** The next sort value, so a new task lands at the end of its horizon. */
export function nextSort(tasks: Task[]): number {
  return tasks.reduce((highest, task) => Math.max(highest, task.sort), 0) + 10;
}

export const HORIZON_HEADING: Record<Horizon, string> = {
  now: 'Now',
  next: 'Next',
  later: 'Later',
};
