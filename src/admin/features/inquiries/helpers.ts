/**
 * Small pure helpers for the Inbox: the received time as the list shows it,
 * the filters read from the query string, and the task description built from
 * an inquiry's fields.
 */
import { relativeTime } from '../../lib/format';
import {
  INQUIRY_SOURCES,
  INQUIRY_STATUSES,
  type Inquiry,
  type InquirySource,
  type InquiryStatus,
} from '../../lib/types';

const DAY = 24 * 60 * 60 * 1000;

/** "2 h ago" inside a day, "Tue" inside a week, "Oct 3" after that. */
export function receivedWord(value: string): string {
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '';
  const age = Date.now() - then.getTime();
  if (age < DAY) return relativeTime(value);
  if (age < 7 * DAY) return then.toLocaleDateString('en-US', { weekday: 'short' });
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
}

export interface InboxFilters {
  source: InquirySource | '';
  status: InquiryStatus | '';
  /** A person's id, 'none' for unassigned, or '' for anyone. */
  assignee: string;
  q: string;
}

export function filtersFrom(query: Record<string, string>): InboxFilters {
  const source = INQUIRY_SOURCES.find((item) => item === query.source) ?? '';
  const status = INQUIRY_STATUSES.find((item) => item === query.status) ?? '';
  return { source, status, assignee: query.assignee ?? '', q: query.q ?? '' };
}

export const hasFilters = (filters: InboxFilters): boolean =>
  Boolean(filters.source || filters.status || filters.assignee || filters.q.trim());

export function matches(row: Inquiry, filters: InboxFilters): boolean {
  if (filters.source && row.source !== filters.source) return false;
  if (filters.status && row.status !== filters.status) return false;
  if (filters.assignee === 'none' && row.assignee_id) return false;
  if (filters.assignee && filters.assignee !== 'none' && row.assignee_id !== filters.assignee) return false;
  const needle = filters.q.trim().toLowerCase();
  if (needle && !`${row.name} ${row.contact}`.toLowerCase().includes(needle)) return false;
  return true;
}

/** The fields as plain lines, the body of the task made from an inquiry. */
export function taskDescription(row: Inquiry, sourceLabel: string): string {
  const received = new Date(row.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const lines = row.fields.map((field) => `${field.k}: ${field.v}`);
  return [`From the ${sourceLabel.toLowerCase()}, received ${received}.`, '', ...lines].join('\n');
}
