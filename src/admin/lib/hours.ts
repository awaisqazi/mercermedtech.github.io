/**
 * Hours maths. Pure functions only (the one exception, `downloadText`, is
 * labelled), so the week view, the team month, Home and the CSV export all
 * agree on what "this week" and "a total" mean.
 *
 * Two rules run through all of it:
 *
 *  1. A `work_date` is a calendar date (`YYYY-MM-DD`), never an instant. It
 *     is parsed with `parseLocalDate`, because `new Date('2026-09-21')` is UTC
 *     midnight, which in New Jersey is the evening before.
 *  2. Hours are quarter hours. Anything summed is rounded back to the nearest
 *     quarter so floating point never prints "7.999999 h".
 *
 * Weeks start on Monday.
 */
import { parseLocalDate, toDateInput } from './format';
import type { Profile, Project, Task, TimeEntry } from './types';

/* ------------------------------------------------------------- calendar */

/** `YYYY-MM-DD` plus or minus whole days. */
export function addDays(value: string, days: number): string {
  const date = parseLocalDate(value) ?? new Date();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

/** Today as `YYYY-MM-DD`, in the local zone. */
export function todayKey(now: Date = new Date()): string {
  return toDateInput(now);
}

/** The Monday on or before a date. */
export function weekStart(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? (parseLocalDate(value) ?? new Date()) : new Date(value);
  const offset = (date.getDay() + 6) % 7; // Monday 0 ... Sunday 6
  date.setDate(date.getDate() - offset);
  return toDateInput(date);
}

export interface WeekBounds {
  /** The Monday. */
  from: string;
  /** The Sunday. */
  to: string;
  /** Monday to Sunday, seven dates. */
  days: string[];
}

export function weekBounds(value: string | Date = new Date()): WeekBounds {
  const from = weekStart(value);
  const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
  return { from, to: days[6]!, days };
}

/** "Mon", "Tue" ... for a date. */
export function weekdayShort(value: string): string {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString('en-US', { weekday: 'short' }) : '';
}

/** "Nov 3 to 9" or "Oct 27 to Nov 2", for the week switcher. */
export function weekLabel(from: string): string {
  const start = parseLocalDate(from);
  const end = parseLocalDate(addDays(from, 6));
  if (!start || !end) return '';
  const month = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' });
  const sameMonth = start.getMonth() === end.getMonth();
  return `${month(start)} ${start.getDate()} to ${sameMonth ? '' : `${month(end)} `}${end.getDate()}`;
}

/** `YYYY-MM` for a date or a `YYYY-MM-DD`. */
export function monthKey(value: string | Date = new Date()): string {
  if (typeof value === 'string') return value.slice(0, 7);
  return toDateInput(value).slice(0, 7);
}

/** The first of the month, `YYYY-MM-01`: the key of `hours_months`. */
export function monthStart(value: string | Date = new Date()): string {
  return `${monthKey(value)}-01`;
}

/** `YYYY-MM` plus or minus whole months. */
export function addMonths(month: string, count: number): string {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year ?? 2000, (mon ?? 1) - 1 + count, 1);
  return monthKey(date);
}

export interface MonthBounds {
  /** `YYYY-MM`. */
  month: string;
  /** The first day, `YYYY-MM-01`. */
  from: string;
  /** The last day. */
  to: string;
  days: string[];
}

export function monthBounds(value: string | Date = new Date()): MonthBounds {
  const month = monthKey(value);
  const [year, mon] = month.split('-').map(Number);
  const last = new Date(year ?? 2000, mon ?? 1, 0).getDate();
  const from = `${month}-01`;
  const days = Array.from({ length: last }, (_, index) => addDays(from, index));
  return { month, from, to: days[days.length - 1]!, days };
}

/** The Mondays of every week that touches the month, for people by weeks. */
export function weeksOfMonth(month: string): string[] {
  const { from, to } = monthBounds(month);
  const weeks: string[] = [];
  for (let start = weekStart(from); start <= to; start = addDays(start, 7)) weeks.push(start);
  return weeks;
}

/** "November 2026" for `2026-11` or `2026-11-01`. */
export function monthLabel(value: string): string {
  const date = parseLocalDate(`${monthKey(value)}-01`);
  return date ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : value;
}

/* ---------------------------------------------------------------- hours */

export const MIN_HOURS = 0.25;
export const MAX_HOURS = 24;

/** Rounds to the nearest quarter hour. */
export function roundQuarter(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 4) / 4;
}

/** Nearest quarter, held between 0.25 and 24: what one entry may hold. */
export function clampHours(value: number): number {
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, roundQuarter(value)));
}

/** True for 0.25, 0.5 ... 24, which is exactly what the database accepts. */
export function isValidHours(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_HOURS && value <= MAX_HOURS && value * 4 === Math.floor(value * 4);
}

/** "2.5 h", "0.25 h", "8 h". No trailing zeros, never more than two places. */
export function formatHours(value: number): string {
  return `${formatHoursNumber(value)} h`;
}

/** The number alone, for the big Fraunces numerals and CSV cells. */
export function formatHoursNumber(value: number): string {
  const rounded = roundQuarter(value);
  return String(Number(rounded.toFixed(2)));
}

/**
 * What a person typed into an hours box: "1.5", "1,5", "1:30", "90m",
 * "1h 15m". Returns null when it is not a number of hours at all. The result
 * is not rounded; the caller decides whether to round or refuse.
 */
export function parseHours(text: string): number | null {
  const value = text.trim().toLowerCase().replace(',', '.');
  if (!value) return null;
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(value);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
  const minutes = /^(\d+)\s*m(in)?$/.exec(value);
  if (minutes) return Number(minutes[1]) / 60;
  const mixed = /^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+)\s*m(?:in)?)?$/.exec(value);
  if (mixed) return Number(mixed[1]) + (mixed[2] ? Number(mixed[2]) / 60 : 0);
  const plain = Number(value);
  return Number.isFinite(plain) ? plain : null;
}

/* --------------------------------------------------------------- totals */

type EntryLike = Pick<TimeEntry, 'hours' | 'work_date' | 'user_id' | 'project_id' | 'task_id'>;

export function sumHours(entries: readonly Pick<TimeEntry, 'hours'>[]): number {
  let total = 0;
  for (const entry of entries) total += Number(entry.hours) || 0;
  return roundQuarter(total);
}

function totalsBy<T extends EntryLike>(entries: readonly T[], key: (entry: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of entries) {
    const bucket = key(entry);
    out[bucket] = (out[bucket] ?? 0) + (Number(entry.hours) || 0);
  }
  for (const bucket of Object.keys(out)) out[bucket] = roundQuarter(out[bucket]!);
  return out;
}

/** Keyed by `work_date`. Days with nothing logged are absent, not zero. */
export function totalsByDay<T extends EntryLike>(entries: readonly T[]): Record<string, number> {
  return totalsBy(entries, (entry) => entry.work_date);
}

/** Keyed by `user_id`. */
export function totalsByPerson<T extends EntryLike>(entries: readonly T[]): Record<string, number> {
  return totalsBy(entries, (entry) => entry.user_id);
}

/** The key used for entries with no project. */
export const NO_PROJECT = 'none';

/** Keyed by `project_id`, with `NO_PROJECT` for entries that have none. */
export function totalsByProject<T extends EntryLike>(entries: readonly T[]): Record<string, number> {
  return totalsBy(entries, (entry) => entry.project_id ?? NO_PROJECT);
}

/** Keyed by `task_id`; entries with no task are left out. */
export function totalsByTask<T extends EntryLike>(entries: readonly T[]): Record<string, number> {
  return totalsBy(
    entries.filter((entry) => entry.task_id),
    (entry) => entry.task_id!
  );
}

/** Person by week: `{ [user_id]: { [monday]: hours } }`, for the team table. */
export function totalsByPersonWeek<T extends EntryLike>(entries: readonly T[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const entry of entries) {
    const person = (out[entry.user_id] ??= {});
    const week = weekStart(entry.work_date);
    person[week] = (person[week] ?? 0) + (Number(entry.hours) || 0);
  }
  for (const person of Object.values(out)) {
    for (const week of Object.keys(person)) person[week] = roundQuarter(person[week]!);
  }
  return out;
}

/** Seven numbers, Monday first, for the week strip on Home and Hours. */
export function weekStrip<T extends EntryLike>(entries: readonly T[], from: string): number[] {
  const byDay = totalsByDay(entries);
  return weekBounds(from).days.map((day) => byDay[day] ?? 0);
}

/* ------------------------------------------------------------------ CSV */

/**
 * One RFC 4180 cell. Quoted when it holds a comma, a quote, a line break or
 * edge spaces; quotes inside are doubled. A cell that a spreadsheet would run
 * as a formula (=, +, @, a tab) gets a leading apostrophe, so an exported
 * summary can never execute when somebody opens the file.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value);
  if (/^[=+@\t\r]/.test(text) || /^-[^\s\d]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Rows to CSV text, CRLF line ends as RFC 4180 asks. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const CSV_HEADER = ['Date', 'Person', 'Email', 'Hours', 'Project code', 'Project', 'Task', 'Summary'] as const;

export interface CsvLookups {
  profiles: readonly Profile[];
  projects: readonly Project[];
  tasks: readonly Task[];
}

/** The hours export: one row per entry, oldest first, then by person. */
export function buildHoursCsv(entries: readonly TimeEntry[], lookups: CsvLookups): string {
  const people = new Map(lookups.profiles.map((profile) => [profile.id, profile]));
  const projects = new Map(lookups.projects.map((project) => [project.id, project]));
  const tasks = new Map(lookups.tasks.map((task) => [task.id, task]));
  const sorted = [...entries].sort(
    (a, b) =>
      a.work_date.localeCompare(b.work_date) ||
      (people.get(a.user_id)?.full_name ?? '').localeCompare(people.get(b.user_id)?.full_name ?? '') ||
      a.created_at.localeCompare(b.created_at)
  );
  const rows: unknown[][] = [[...CSV_HEADER]];
  for (const entry of sorted) {
    const person = people.get(entry.user_id);
    const project = entry.project_id ? projects.get(entry.project_id) : undefined;
    const task = entry.task_id ? tasks.get(entry.task_id) : undefined;
    rows.push([
      entry.work_date,
      person?.full_name ?? '',
      person?.email ?? '',
      roundQuarter(Number(entry.hours)),
      project?.code ?? '',
      project?.name ?? '',
      task?.title ?? '',
      entry.summary,
    ]);
  }
  return toCsv(rows);
}

/** `hours-2026-11.csv`, or `hours-2026-11-person-name.csv` when filtered. */
export function csvFilename(month: string, suffix?: string): string {
  const tail = suffix
    ? `-${suffix
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}`
    : '';
  return `hours-${monthKey(month)}${tail}.csv`;
}

/**
 * Not pure: hands a text file to the browser. Lives here so the CSV and its
 * download sit together. The byte-order mark makes Excel read UTF-8 names
 * correctly.
 */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob(['﻿', text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
