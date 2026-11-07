/**
 * Small helpers the Hours screens share: query-string readers that never
 * trust the address bar, and the wording for dates and months.
 */
import { parseLocalDate } from '../../lib/format';
import { monthKey, weekStart } from '../../lib/hours';
import type { HoursMonth, TimeEntry } from '../../lib/types';

/** A `YYYY-MM-DD` that is a real date, or null. */
export function readDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parseLocalDate(value);
  if (!date) return null;
  // parseLocalDate may roll 2026-02-31 over; only accept a date that round-trips.
  const [y, m, d] = value.split('-').map(Number);
  return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d ? value : null;
}

/** The Monday for a `week` query value, or null when it is missing or wrong. */
export function readWeek(value: string | undefined): string | null {
  const date = readDate(value);
  return date ? weekStart(date) : null;
}

/** `YYYY-MM` from a `month` query value, or null. */
export function readMonth(value: string | undefined): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}

/** "Mon, Nov 2" for a date. */
export function dayWording(value: string): string {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : value;
}

/** "Monday, November 2" for a date, for confirmations. */
export function dayWordingLong(value: string): string {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : value;
}

/** The set of closed months as `YYYY-MM`, for quick lookups per entry. */
export function closedSet(months: readonly HoursMonth[]): Set<string> {
  return new Set(months.map((row) => row.month.slice(0, 7)));
}

export function isClosedEntry(entry: Pick<TimeEntry, 'work_date'>, closed: Set<string>): boolean {
  return closed.has(monthKey(entry.work_date));
}
