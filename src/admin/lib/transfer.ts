/**
 * Import and export of whole projects, in the `mmt-project/1` format described
 * in ARCHITECTURE.md.
 *
 * Import is deliberately cautious: a file is parsed, validated and previewed
 * before a single row is written, the writes go in chunks so one huge request
 * cannot time out, and if anything fails halfway the caller is offered the
 * chance to delete the half-created project.
 */
import { supabase } from './supabase';
import { IMPORT_CHUNK } from './config';
import { toAppError, logError, type AppError } from './errors';
import { slugify } from './format';
import {
  HORIZONS,
  PARTNER_STAGES,
  REPORT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type DocBlock,
  type DocImport,
  type PartnerImport,
  type Project,
  type ProjectFile,
  type ProjectKind,
  type ReportImport,
  type Source,
  type TaskImport,
  type Track,
} from './types';
import { PROJECT_FILE_FORMAT } from './types';

/* ============================================================ validation */

export interface FileCounts {
  tasks: number;
  reports: number;
  partners: number;
  docs: number;
  state: number;
}

export interface ValidationResult {
  ok: boolean;
  /** Blocking problems. The import button stays disabled while this is not empty. */
  errors: string[];
  /** Things that were fixed or dropped on the way in. */
  warnings: string[];
  file: ProjectFile | null;
  counts: FileCounts;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asDate = (value: unknown): string | null => {
  const text = asString(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

function cleanSources(value: unknown, warnings: string[], where: string): Source[] {
  if (!Array.isArray(value)) return [];
  const kinds = new Set(['onedrive', 'gdrive', 'gmail', 'web', 'other']);
  const out: Source[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const kind = asString(entry.kind, 'other');
    out.push({
      kind: (kinds.has(kind) ? kind : 'other') as Source['kind'],
      name: asString(entry.name).slice(0, 200),
      where: asString(entry.where).slice(0, 500),
      note: asString(entry.note).slice(0, 500) || undefined,
    });
  }
  if (Array.isArray(value) && value.length !== out.length) {
    warnings.push(`${where}: some sources were not readable and were dropped.`);
  }
  return out;
}

function cleanBlocks(value: unknown, warnings: string[], where: string): DocBlock[] {
  if (!Array.isArray(value)) return [];
  const out: DocBlock[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const type = asString(entry.t);
    if (type === 'p' || type === 'h' || type === 'note') {
      out.push({ t: type, text: asString(entry.text) });
    } else if (type === 'ul') {
      const items = Array.isArray(entry.items) ? entry.items.map((item) => asString(item)) : [];
      out.push({ t: 'ul', items });
    } else if (type === 'kv') {
      const rows = Array.isArray(entry.rows)
        ? entry.rows
            .filter((row): row is unknown[] => Array.isArray(row))
            .map((row) => [asString(row[0]), asString(row[1])] as [string, string])
        : [];
      out.push({ t: 'kv', rows });
    }
  }
  if (Array.isArray(value) && value.length !== out.length) {
    warnings.push(`${where}: some blocks used an unknown type and were dropped.`);
  }
  return out;
}

/** Reads a parsed JSON value into a clean, safe ProjectFile. */
export function validateProjectFile(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts: FileCounts = { tasks: 0, reports: 0, partners: 0, docs: 0, state: 0 };

  if (!isRecord(input)) {
    return { ok: false, errors: ['That file is not a JSON object.'], warnings, file: null, counts };
  }
  if (input.format !== PROJECT_FILE_FORMAT) {
    errors.push(
      `The file says format "${asString(input.format) || '(missing)'}". It needs to say "${PROJECT_FILE_FORMAT}".`
    );
  }
  if (!isRecord(input.project)) {
    errors.push('The file has no "project" section.');
    return { ok: false, errors, warnings, file: null, counts };
  }

  const source = input.project;
  const name = asString(source.name).trim();
  if (!name) errors.push('The project has no name.');

  const slug = slugify(asString(source.slug) || name);
  if (!slug) errors.push('The project has no usable short name (slug).');

  const kind = asString(source.kind, 'general');
  if (kind !== 'grant' && kind !== 'general') {
    errors.push(`Kind "${kind}" is not one of grant or general.`);
  }
  const track = asString(source.track, 'org');
  const validTrack: Track = track === 'med' || track === 'tech' || track === 'org' ? track : 'org';
  if (validTrack !== track) warnings.push(`Track "${track}" is not one we know; using "org".`);

  const tasks: TaskImport[] = [];
  for (const [index, entry] of (Array.isArray(input.tasks) ? input.tasks : []).entries()) {
    if (!isRecord(entry)) continue;
    const title = asString(entry.title).trim();
    if (!title) {
      warnings.push(`Task ${index + 1} has no title and was skipped.`);
      continue;
    }
    const status = asString(entry.status, 'todo');
    const pri = asString(entry.pri, 'normal');
    const horizon = asString(entry.horizon, 'now');
    tasks.push({
      title: title.slice(0, 300),
      ws: asString(entry.ws),
      status: (TASK_STATUSES as string[]).includes(status) ? (status as TaskImport['status']) : 'todo',
      pri: (TASK_PRIORITIES as string[]).includes(pri) ? (pri as TaskImport['pri']) : 'normal',
      horizon: (HORIZONS as string[]).includes(horizon) ? (horizon as TaskImport['horizon']) : 'now',
      due: asDate(entry.due),
      owner: asString(entry.owner),
      why: asString(entry.why),
      done_when: asString(entry.done_when),
      notes: asString(entry.notes),
      recurring: asString(entry.recurring),
      sources: cleanSources(entry.sources, warnings, `Task "${title}"`),
      sort: asNumber(entry.sort, index),
    });
  }

  const reports: ReportImport[] = [];
  const seenPeriods = new Set<string>();
  for (const [index, entry] of (Array.isArray(input.reports) ? input.reports : []).entries()) {
    if (!isRecord(entry)) continue;
    const period = asString(entry.period).trim();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      warnings.push(`Report ${index + 1} has no month in YYYY-MM form and was skipped.`);
      continue;
    }
    if (seenPeriods.has(period)) {
      warnings.push(`There is more than one report for ${period}; only the first was kept.`);
      continue;
    }
    seenPeriods.add(period);
    const status = asString(entry.status, 'not_started');
    const kindValue = asString(entry.kind, 'monthly');
    const checks: Record<string, boolean> = {};
    if (isRecord(entry.checks)) {
      for (const [key, value] of Object.entries(entry.checks)) checks[key] = Boolean(value);
    }
    reports.push({
      period,
      due: asDate(entry.due),
      covers: asString(entry.covers),
      kind: kindValue === 'closeout' ? 'closeout' : 'monthly',
      status: (REPORT_STATUSES as string[]).includes(status)
        ? (status as ReportImport['status'])
        : 'not_started',
      checks,
      amount: entry.amount === null || entry.amount === undefined ? null : asNumber(entry.amount),
      submitted_on: asDate(entry.submitted_on),
      notes: asString(entry.notes),
      sources: cleanSources(entry.sources, warnings, `Report ${period}`),
    });
  }

  const partners: PartnerImport[] = [];
  for (const [index, entry] of (Array.isArray(input.partners) ? input.partners : []).entries()) {
    if (!isRecord(entry)) continue;
    const partnerName = asString(entry.name).trim();
    if (!partnerName) {
      warnings.push(`Partner ${index + 1} has no name and was skipped.`);
      continue;
    }
    const stage = asString(entry.stage, 'not_contacted');
    partners.push({
      name: partnerName.slice(0, 200),
      county: asString(entry.county),
      kind: asString(entry.kind),
      stage: (PARTNER_STAGES as string[]).includes(stage)
        ? (stage as PartnerImport['stage'])
        : 'not_contacted',
      contact: asString(entry.contact),
      next_step: asString(entry.next_step),
      notes: asString(entry.notes),
      referrals: Math.max(0, Math.round(asNumber(entry.referrals))),
      sort: asNumber(entry.sort, index),
    });
  }

  const docs: DocImport[] = [];
  const seenDocKeys = new Set<string>();
  for (const [index, entry] of (Array.isArray(input.docs) ? input.docs : []).entries()) {
    if (!isRecord(entry)) continue;
    const title = asString(entry.title).trim();
    const section = asString(entry.section).trim() || 'notes';
    const docSlug = slugify(asString(entry.slug) || title || `doc-${index + 1}`);
    if (!docSlug) {
      warnings.push(`Note ${index + 1} has no title or short name and was skipped.`);
      continue;
    }
    const key = `${section}/${docSlug}`;
    if (seenDocKeys.has(key)) {
      warnings.push(`More than one note is called "${key}"; only the first was kept.`);
      continue;
    }
    seenDocKeys.add(key);
    docs.push({
      section,
      slug: docSlug,
      title: title || docSlug,
      body: cleanBlocks(entry.body, warnings, `Note "${title || docSlug}"`),
      sources: cleanSources(entry.sources, warnings, `Note "${title || docSlug}"`),
      sort: asNumber(entry.sort, index),
    });
  }

  const state: Record<string, Record<string, unknown>> = {};
  if (isRecord(input.state)) {
    for (const [key, value] of Object.entries(input.state)) {
      if (isRecord(value)) state[key] = value;
      else warnings.push(`State "${key}" is not an object and was skipped.`);
    }
  }

  counts.tasks = tasks.length;
  counts.reports = reports.length;
  counts.partners = partners.length;
  counts.docs = docs.length;
  counts.state = Object.keys(state).length;

  const file: ProjectFile = {
    format: PROJECT_FILE_FORMAT,
    project: {
      slug,
      name,
      kind: (kind === 'grant' ? 'grant' : 'general') as ProjectKind,
      track: validTrack,
      summary: asString(source.summary),
      config: isRecord(source.config) ? source.config : {},
    },
    tasks,
    reports,
    partners,
    state,
    docs,
  };

  return { ok: errors.length === 0, errors, warnings, file, counts };
}

/** Parses text and validates it in one step. */
export function readProjectFile(text: string): ValidationResult {
  try {
    return validateProjectFile(JSON.parse(text));
  } catch (error) {
    return {
      ok: false,
      errors: [`That file is not valid JSON (${(error as Error).message}).`],
      warnings: [],
      file: null,
      counts: { tasks: 0, reports: 0, partners: 0, docs: 0, state: 0 },
    };
  }
}

/** True when a project already uses this slug. */
export async function slugTaken(slug: string): Promise<boolean> {
  const { data, error } = await supabase.from('projects').select('id').eq('slug', slug).limit(1);
  if (error) {
    logError('slugTaken', error);
    return false;
  }
  return (data ?? []).length > 0;
}

/* ================================================================ import */

export interface ImportProgress {
  /** 0 to 1. */
  fraction: number;
  label: string;
}

export interface ImportResult {
  ok: boolean;
  project?: Project;
  error?: AppError;
  /** Set when rows failed after the project row was created. */
  partial?: boolean;
}

function chunk<T>(rows: T[], size = IMPORT_CHUNK): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) out.push(rows.slice(index, index + size));
  return out;
}

/**
 * Creates the project and writes every row, reporting progress as it goes.
 * On failure the caller gets `partial: true` and the created project's id via
 * `result.project`, so it can offer to delete it.
 */
export async function importProject(
  file: ProjectFile,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  let project: Project | null = null;
  try {
    onProgress({ fraction: 0.02, label: 'Creating the project' });
    const { data, error } = await supabase
      .from('projects')
      .insert({
        slug: file.project.slug,
        name: file.project.name,
        kind: file.project.kind,
        track: file.project.track ?? 'org',
        summary: file.project.summary ?? '',
        config: file.project.config ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;
    project = data as Project;

    const batches: Array<{ table: string; rows: Record<string, unknown>[]; label: string }> = [];
    const withProject = (rows: Record<string, unknown>[]) =>
      rows.map((row) => ({ ...row, project_id: project!.id }));

    if (file.tasks?.length) {
      for (const part of chunk(file.tasks as Record<string, unknown>[])) {
        batches.push({ table: 'tasks', rows: withProject(part), label: 'Adding tasks' });
      }
    }
    if (file.reports?.length) {
      for (const part of chunk(file.reports as Record<string, unknown>[])) {
        batches.push({ table: 'reports', rows: withProject(part), label: 'Adding reports' });
      }
    }
    if (file.partners?.length) {
      for (const part of chunk(file.partners as Record<string, unknown>[])) {
        batches.push({ table: 'partners', rows: withProject(part), label: 'Adding partners' });
      }
    }
    if (file.docs?.length) {
      for (const part of chunk(file.docs as Record<string, unknown>[])) {
        batches.push({ table: 'project_docs', rows: withProject(part), label: 'Adding notes' });
      }
    }
    const stateRows = Object.entries(file.state ?? {}).map(([key, data]) => ({ key, data }));
    if (stateRows.length) {
      batches.push({
        table: 'project_state',
        rows: withProject(stateRows as unknown as Record<string, unknown>[]),
        label: 'Adding saved numbers',
      });
    }

    for (const [index, batch] of batches.entries()) {
      onProgress({
        fraction: 0.05 + (0.95 * index) / Math.max(1, batches.length),
        label: batch.label,
      });
      const { error: batchError } = await supabase.from(batch.table).insert(batch.rows);
      if (batchError) throw batchError;
    }

    onProgress({ fraction: 1, label: 'Done' });
    return { ok: true, project };
  } catch (error) {
    logError('importProject', error);
    return {
      ok: false,
      project: project ?? undefined,
      partial: Boolean(project),
      error: toAppError(error),
    };
  }
}

/** Removes a project and, by cascade, everything in it. Owners only. */
export async function deleteProject(projectId: string): Promise<{ ok: boolean; error?: AppError }> {
  try {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    logError('deleteProject', error);
    return { ok: false, error: toAppError(error) };
  }
}

/* ================================================================ export */

/** Reads a whole project back out into the interchange format. */
export async function buildProjectFile(projectId: string): Promise<ProjectFile> {
  const [projectResult, tasks, reports, partners, state, docs] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('tasks').select('*').eq('project_id', projectId).order('sort'),
    supabase.from('reports').select('*').eq('project_id', projectId).order('period'),
    supabase.from('partners').select('*').eq('project_id', projectId).order('sort'),
    supabase.from('project_state').select('*').eq('project_id', projectId),
    supabase.from('project_docs').select('*').eq('project_id', projectId).order('sort'),
  ]);

  for (const result of [projectResult, tasks, reports, partners, state, docs]) {
    if (result.error) throw result.error;
  }

  const project = projectResult.data as Project;
  const strip = <T extends Record<string, unknown>>(row: T, keep: string[]) => {
    const out: Record<string, unknown> = {};
    for (const key of keep) out[key] = row[key];
    return out;
  };

  const stateOut: Record<string, Record<string, unknown>> = {};
  for (const row of (state.data ?? []) as Array<{ key: string; data: Record<string, unknown> }>) {
    stateOut[row.key] = row.data;
  }

  return {
    format: PROJECT_FILE_FORMAT,
    project: {
      slug: project.slug,
      name: project.name,
      kind: project.kind,
      track: project.track,
      summary: project.summary ?? '',
      config: project.config ?? {},
    },
    tasks: ((tasks.data ?? []) as Record<string, unknown>[]).map(
      (row) =>
        strip(row, [
          'title',
          'ws',
          'status',
          'pri',
          'horizon',
          'due',
          'owner',
          'why',
          'done_when',
          'notes',
          'recurring',
          'sources',
          'sort',
        ]) as TaskImport
    ),
    reports: ((reports.data ?? []) as Record<string, unknown>[]).map(
      (row) =>
        strip(row, [
          'period',
          'due',
          'covers',
          'kind',
          'status',
          'checks',
          'amount',
          'submitted_on',
          'notes',
          'sources',
        ]) as ReportImport
    ),
    partners: ((partners.data ?? []) as Record<string, unknown>[]).map(
      (row) =>
        strip(row, [
          'name',
          'county',
          'kind',
          'stage',
          'contact',
          'next_step',
          'notes',
          'referrals',
          'sort',
        ]) as PartnerImport
    ),
    state: stateOut,
    docs: ((docs.data ?? []) as Record<string, unknown>[]).map(
      (row) => strip(row, ['section', 'slug', 'title', 'body', 'sources', 'sort']) as DocImport
    ),
  };
}

/**
 * Hands the browser a file to save. The object URL is revoked on the next tick,
 * which is long enough for the click to have started the download.
 */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
