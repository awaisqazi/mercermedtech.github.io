/**
 * Formatting helpers. Two rules run through all of them:
 *
 *  1. A `YYYY-MM-DD` column is a calendar date, not an instant. `new Date('2026-09-20')`
 *     parses as UTC midnight, which in New Jersey is the evening of the 19th,
 *     so every due date would read a day early. `parseLocalDate` builds the
 *     date in the local zone instead.
 *  2. Numbers, dates and money are rendered for a mono column, so they line up.
 */

/** Turns `YYYY-MM-DD` into a local-midnight Date. Returns null for junk. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const loose = new Date(value);
    return Number.isNaN(loose.getTime()) ? null : loose;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Today at local midnight, for overdue comparisons. */
export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** `YYYY-MM-DD` for a Date, in the local zone (the inverse of parseLocalDate). */
export function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole days from today to a `YYYY-MM-DD` date. Negative means overdue. */
export function daysUntil(value: string | null | undefined): number | null {
  const date = parseLocalDate(value);
  if (!date) return null;
  const ms = date.getTime() - today().getTime();
  return Math.round(ms / 86_400_000);
}

export function isOverdue(value: string | null | undefined): boolean {
  const days = daysUntil(value);
  return days !== null && days < 0;
}

/** "Sep 20" or "Sep 20, 2027" when the year is not the current one. */
export function formatDate(value: string | null | undefined): string {
  const date = parseLocalDate(value);
  if (!date) return '';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "September 20, 2026" for headers and confirmations. */
export function formatDateLong(value: string | null | undefined): string {
  const date = parseLocalDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** `YYYY-MM` to "September 2026". */
export function formatMonth(period: string | null | undefined): string {
  if (!period) return '';
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** "Due in 3 days" / "5 days overdue" / "Due today". */
export function dueWording(value: string | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return '';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days < 14) return `Due in ${days} days`;
  return `Due ${formatDate(value)}`;
}

/** "just now" · "4 min ago" · "3 h ago" · "Sep 12" for a timestamp. */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '';
  const seconds = Math.round((Date.now() - then.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return 'a minute ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Full timestamp for a title attribute. */
export function fullTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "$1,000,000" — no cents unless the amount has them. */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const cents = Math.abs(value % 1) > 0.004;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

/** "$1.0M" / "$248K" for tiles where the full number does not fit. */
export function moneyShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return money(value);
}

/** 0.62 to "62%". */
export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return `${(value * 100).toFixed(digits)}%`;
}

/** Safe ratio; returns 0 rather than NaN or Infinity. */
export function ratio(part: number, whole: number): number {
  if (!whole || !Number.isFinite(whole) || !Number.isFinite(part)) return 0;
  return part / whole;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** "Ada Lovelace" to "AL"; falls back to the first letters of an email. */
export function initials(name: string | null | undefined, email?: string | null): string {
  const source = (name || '').trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  const handle = (email || '').trim();
  if (handle) return handle.slice(0, 2).toUpperCase();
  return '?';
}

/** The part of a name people answer to, used to match free-text owner labels. */
export function firstName(name: string | null | undefined): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/**
 * A stable colour for a person, derived from their id so that every screen and
 * every browser agrees without storing anything. Hues are spread around the
 * wheel and kept at a saturation that reads on both themes.
 */
export function userHue(id: string | null | undefined): number {
  const key = id || '';
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}

export function userColor(id: string | null | undefined): string {
  return `hsl(${userHue(id)} 58% 45%)`;
}

export function userTint(id: string | null | undefined): string {
  return `hsl(${userHue(id)} 58% 45% / 0.14)`;
}

/** A URL-safe slug. Used for project slugs and doc slugs. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Shortens a long string for a chip or a one-line summary. */
export function truncate(value: string, max = 80): string {
  const text = (value || '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** "1 task" / "4 tasks". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "12.4 KB" for the import preview. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Sentence-cases a snake_case enum value for display when no label exists. */
export function humanize(value: string): string {
  const text = (value || '').replace(/[_-]+/g, ' ').trim();
  return text ? text[0]!.toUpperCase() + text.slice(1) : '';
}
