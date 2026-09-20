/**
 * Shared shapes and small helpers for the task components. The same set backs
 * "Tasks" in a general project and "Deliverables" in a grant, so nothing in
 * here knows which it is.
 */
import type { Horizon, Task, TaskStatus, WorkstreamDef } from '../../lib/types';
import { daysUntil, firstName } from '../../lib/format';

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
  hideDone: false,
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
