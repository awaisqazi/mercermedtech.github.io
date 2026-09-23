/**
 * Shared shapes and small helpers for the task components. The same set backs
 * the Plan in a grant and in a general project, so nothing in here knows
 * which it is.
 */
import type { Horizon, Task, TaskPriority, TaskStatus, WorkstreamDef } from '../../lib/types';
import { daysUntil, firstName } from '../../lib/format';

export type TaskView = 'list' | 'board';

/** The label to show for a workstream key, falling back to the key itself. */
export function workstreamLabel(key: string, workstreams: WorkstreamDef[]): string {
  if (!key) return '';
  return workstreams.find((entry) => entry.key === key)?.label ?? key;
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

/* ------------------------------------------------------ the Plan list --- */

/**
 * The Plan's groups, in reading order. A task sits in exactly one:
 *   attention  not done, and critical, blocked or overdue
 *   week       not done, and planned for now or due within seven days
 *   next       planned for next
 *   later      planned for later
 *   done       finished (folded away, with a count)
 */
export type PlanGroup = 'attention' | 'week' | 'next' | 'later' | 'done';

export const PLAN_GROUPS: PlanGroup[] = ['attention', 'week', 'next', 'later', 'done'];

export const PLAN_GROUP_LABEL: Record<PlanGroup, string> = {
  attention: 'Needs attention',
  week: 'This week',
  next: 'Next',
  later: 'Later',
  done: 'Done',
};

export function planGroupOf(task: Task): PlanGroup {
  if (task.status === 'done') return 'done';
  if (needsAttention(task)) return 'attention';
  const days = daysUntil(task.due);
  if (task.horizon === 'now' || (days !== null && days <= 7)) return 'week';
  return task.horizon === 'later' ? 'later' : 'next';
}

/** What a quick-add in each group creates. */
export const PLAN_GROUP_DEFAULTS: Record<Exclude<PlanGroup, 'done'>, { horizon: Horizon; pri: TaskPriority }> = {
  attention: { horizon: 'now', pri: 'critical' },
  week: { horizon: 'now', pri: 'normal' },
  next: { horizon: 'next', pri: 'normal' },
  later: { horizon: 'later', pri: 'normal' },
};

export interface PlanFilters {
  search: string;
  mine: boolean;
  critical: boolean;
  overdue: boolean;
  unassigned: boolean;
  /** Workstream keys; empty means all of them. */
  ws: string[];
}

export const EMPTY_PLAN_FILTERS: PlanFilters = {
  search: '',
  mine: false,
  critical: false,
  overdue: false,
  unassigned: false,
  ws: [],
};

const NOBODY = /^(unassigned|nobody|none|n\/a|tbd)$/i;

/** Assigned to me, or carrying my first name in the free-text owner label. */
export function isMine(task: Task, me: string | null, myName: string): boolean {
  if (me && task.assignee === me) return true;
  const first = firstName(myName).toLowerCase();
  return Boolean(first) && first.length > 1 && (task.owner ?? '').toLowerCase().includes(first);
}

export function isUnassigned(task: Task): boolean {
  const owner = (task.owner ?? '').trim();
  return !task.assignee && (!owner || NOBODY.test(owner));
}

export function matchesPlan(task: Task, filters: PlanFilters, me: string | null, myName: string): boolean {
  if (filters.mine && !isMine(task, me, myName)) return false;
  if (filters.critical && task.pri !== 'critical') return false;
  if (filters.overdue && !isOverdueTask(task)) return false;
  if (filters.unassigned && !isUnassigned(task)) return false;
  if (filters.ws.length && !filters.ws.includes(task.ws)) return false;
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    const haystack = [task.title, task.ws, task.owner, task.why, task.done_when, task.notes]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/** Soonest due first inside a group, then the usual order. */
export function comparePlan(a: Task, b: Task): number {
  const dueA = a.due || '9999-12-31';
  const dueB = b.due || '9999-12-31';
  const priority = (PRIORITY_RANK[a.pri] ?? 9) - (PRIORITY_RANK[b.pri] ?? 9);
  if (a.status === 'blocked' && b.status !== 'blocked') return -1;
  if (b.status === 'blocked' && a.status !== 'blocked') return 1;
  if (dueA !== dueB) return dueA < dueB ? -1 : 1;
  return priority || a.sort - b.sort;
}

/** Changed by somebody else since this person was last here. */
export function changedSince(task: { updated_at: string; updated_by: string | null }, since: string | null, me: string | null): boolean {
  return Boolean(since && task.updated_at > since && task.updated_by && task.updated_by !== me);
}
