/**
 * Small helpers the grant tabs share.
 *
 * Every one of them reads `project.config` or a `project_state` blob and gives
 * back something safe to render: a number that is never NaN, a list that is
 * never undefined, a fraction that is never Infinity. Nothing here knows about
 * any particular grant — the keys, labels, targets and dates are all settings.
 *
 * Two config keys this module introduces, both optional:
 *
 *   funnel[].side    true marks a funnel entry as a side count (people who
 *                    left the funnel, or a quality flag) rather than a step.
 *                    When it is absent we infer it from the key: anything
 *                    ending in `_late`, `exited` or `not_enrolled`.
 *   report_checks[].short
 *                    a one-word name for the checklist toggle in the reports
 *                    table. When it is absent the first word of the label is
 *                    used, cut to ten characters.
 *   metric_map       which `state.metrics` keys feed the headline rates:
 *                    { enrolled, credentialed, placed, retained }. The
 *                    defaults are "enrolled", "credentialed", "placed" and
 *                    "ret90".
 */
import type {
  BudgetCategoryDef,
  BudgetLineDef,
  FunnelStepDef,
  ProjectConfig,
  Report,
  ReportCheckDef,
  ReportStatus,
} from '../../lib/types';
import { clamp, humanize, parseLocalDate, today } from '../../lib/format';

/* ------------------------------------------------------------- numbers --- */

/** A finite number from a JSON blob, or 0. */
export function numberFrom(data: Record<string, unknown> | undefined, key: string): number {
  const value = data?.[key];
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A string from a JSON blob, or ''. */
export function textFrom(data: Record<string, unknown> | undefined, key: string): string {
  const value = data?.[key];
  return typeof value === 'string' ? value : '';
}

/** A nested object from a JSON blob, never null. */
export function objectFrom(
  data: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> {
  const value = data?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/* -------------------------------------------------------------- funnel --- */

/** A funnel entry, with the optional `side` flag this module understands. */
export interface FunnelItem extends FunnelStepDef {
  side?: boolean;
}

/** Keys that describe people who left the funnel, or a timing flag. */
const SIDE_KEY = /(?:_late|exited|not_enrolled)$/;

/**
 * Whether an entry is a side count rather than a step. An explicit `side`
 * always wins; otherwise the key pattern decides, so an existing config needs
 * no editing.
 */
export function isSideStep(item: FunnelItem): boolean {
  if (typeof item.side === 'boolean') return item.side;
  return SIDE_KEY.test(item.key ?? '');
}

/** The funnel from config, cleaned up: no blanks, always a label. */
export function funnelItems(config: ProjectConfig): FunnelItem[] {
  const raw = Array.isArray(config.funnel) ? (config.funnel as FunnelItem[]) : [];
  return raw
    .filter((item) => item && typeof item.key === 'string' && item.key.trim())
    .map((item) => ({ ...item, key: item.key.trim(), label: item.label || humanize(item.key) }));
}

/* --------------------------------------------------------- metric keys --- */

export interface MetricKeys {
  enrolled: string;
  credentialed: string;
  placed: string;
  retained: string;
}

export const DEFAULT_METRIC_KEYS: MetricKeys = {
  enrolled: 'enrolled',
  credentialed: 'credentialed',
  placed: 'placed',
  retained: 'ret90',
};

/** Which metric feeds which headline rate. `config.metric_map` may override. */
export function metricKeys(config: ProjectConfig): MetricKeys {
  const map = objectFrom(config as Record<string, unknown>, 'metric_map');
  const pick = (key: keyof MetricKeys): string => {
    const value = map[key];
    return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_METRIC_KEYS[key];
  };
  return {
    enrolled: pick('enrolled'),
    credentialed: pick('credentialed'),
    placed: pick('placed'),
    retained: pick('retained'),
  };
}

/* ---------------------------------------------------------------- term --- */

export interface TermView {
  start: Date | null;
  end: Date | null;
  /** 0 to 1, or null when the dates are missing or the wrong way round. */
  elapsed: number | null;
}

export function termProgress(config: ProjectConfig): TermView {
  const start = parseLocalDate(config.term_start);
  const end = parseLocalDate(config.term_end);
  if (!start || !end || end <= start) return { start, end, elapsed: null };
  const span = end.getTime() - start.getTime();
  return { start, end, elapsed: clamp((Date.now() - start.getTime()) / span, 0, 1) };
}

const DAYS_PER_MONTH = 365.25 / 12;

/** Fractional months from one date to another. Negative when `to` is past. */
export function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (DAYS_PER_MONTH * 86_400_000);
}

/** Months from today to a `YYYY-MM-DD` date, or null when there is no date. */
export function monthsFromToday(value: string | null | undefined): number | null {
  const date = parseLocalDate(value);
  return date ? monthsBetween(today(), date) : null;
}

/** A date a number of (fractional) months after another one. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getTime() + months * DAYS_PER_MONTH * 86_400_000);
}

/** "March 2027" — the month a projection lands in. */
export function formatMonthOf(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/* -------------------------------------------------------------- budget --- */

export function budgetLines(config: ProjectConfig): BudgetLineDef[] {
  const raw = Array.isArray(config.budget_lines) ? (config.budget_lines as BudgetLineDef[]) : [];
  return raw
    .filter((line) => line && typeof line.id === 'string' && line.id.trim())
    .map((line) => ({
      ...line,
      id: line.id.trim(),
      label: line.label || humanize(line.id),
      category: typeof line.category === 'string' ? line.category : '',
      amount: Number.isFinite(Number(line.amount)) ? Number(line.amount) : 0,
    }));
}

export function budgetCategories(config: ProjectConfig): BudgetCategoryDef[] {
  const raw = Array.isArray(config.budget_categories)
    ? (config.budget_categories as BudgetCategoryDef[])
    : [];
  return raw
    .filter((entry) => entry && typeof entry.name === 'string' && entry.name.trim())
    .map((entry) => ({
      ...entry,
      name: entry.name.trim(),
      total: Number.isFinite(Number(entry.total)) ? Number(entry.total) : 0,
      rule: entry.rule === 'decrease_only' ? 'decrease_only' : 'flex',
    }));
}

/** What a category rule means, in words. Never a colour on its own. */
export const RULE_WORDING: Record<BudgetCategoryDef['rule'], string> = {
  flex: 'Can move up or down',
  decrease_only: 'Can only decrease',
};

/* ------------------------------------------------------------- reports --- */

/** A checklist entry with a short name worked out, so callers never guess. */
export interface ReportCheckItem extends ReportCheckDef {
  /** Always set: `short` from config, or the first word of the label. */
  short: string;
}

/** Longest a derived short name gets before it is cut. */
const SHORT_MAX = 10;

/**
 * A short name for a checklist toggle: whatever config says, else the first
 * word of the label, cut to ten characters. Never empty when the label is not.
 */
export function shortCheckLabel(label: string, short?: string): string {
  const given = typeof short === 'string' ? short.trim() : '';
  if (given) return given.slice(0, SHORT_MAX);
  const word = label.trim().split(/\s+/)[0] ?? '';
  return (word || label.trim()).slice(0, SHORT_MAX);
}

/** The checklist for a report period, from config. Empty when none is set. */
export function checkDefs(value: unknown): ReportCheckItem[] {
  if (!Array.isArray(value)) return [];
  return (value as ReportCheckDef[])
    .filter((entry) => entry && typeof entry.key === 'string' && entry.key.trim())
    .map((entry) => {
      const label = entry.label || humanize(entry.key);
      return {
        key: entry.key.trim(),
        label,
        short: shortCheckLabel(label, entry.short),
      };
    });
}

/** How many of the checklist are ticked on one report. */
export function checksReady(report: Report, defs: ReportCheckDef[]): number {
  const checks = report.checks ?? {};
  return defs.reduce((count, def) => (checks[def.key] ? count + 1 : count), 0);
}

/** A period counts as settled once it has been sent; the rest are pending. */
export const SETTLED_REPORT_STATUSES: ReportStatus[] = [
  'submitted',
  'returned',
  'approved',
  'paid',
];

export const isSettledReport = (report: Report): boolean =>
  SETTLED_REPORT_STATUSES.includes(report.status);
