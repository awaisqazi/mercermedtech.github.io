/**
 * The list of projects this person can see, and which one is home.
 *
 * The Workbench revolves around one project (the grant the whole team works
 * on). That project is the "home project": `#/` opens its Plan, and it sits at
 * the top of the left rail with its own sections. Everything else is listed
 * under "Other projects".
 *
 * Which project is home is a setting, not code, and it needs no new column:
 *
 *   1. the project whose `config.primary` is true (an owner or administrator
 *      sets it from the project's menu, "Make this the home project");
 *   2. if none is flagged, the only active project, when there is just one;
 *   3. if there are several, the most recently updated active one.
 *
 * The list is read once after sign-in and again whenever something that
 * changes it happens here (a new project, an import, an archive, a rename).
 * Row level security does the filtering, as everywhere else.
 */
import { supabase } from './supabase';
import { observable, useObservable } from './observable';
import { logError, toAppError, type AppError } from './errors';
import { timed } from './timing';
import { withDeadline } from './deadline';
import { LOAD_DEADLINE_MS } from './config';
import type { Project, ProjectKind } from './types';

export interface ProjectListState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  projects: Project[];
  error: AppError | null;
}

const EMPTY: ProjectListState = { status: 'idle', projects: [], error: null };
const store = observable<ProjectListState>(EMPTY);

let inFlight: Promise<void> | null = null;

/** Reads the list. Concurrent callers share one request. */
export function loadProjectList(): Promise<void> {
  if (inFlight) return inFlight;
  store.update((current) => ({ ...current, status: current.status === 'ready' ? 'ready' : 'loading' }));
  inFlight = (async () => {
    try {
      const { data, error } = await withDeadline(
        timed('projects.list', supabase.from('projects').select('*').order('name')),
        LOAD_DEADLINE_MS
      );
      if (error) throw error;
      store.set({ status: 'ready', projects: (data ?? []) as Project[], error: null });
    } catch (error) {
      logError('loadProjectList', error);
      store.update((current) => ({
        ...current,
        status: current.projects.length ? 'ready' : 'error',
        error: toAppError(error),
      }));
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function clearProjectList(): void {
  store.set(EMPTY);
}

export function getProjectList(): ProjectListState {
  return store.get();
}

export function useProjectList(): ProjectListState {
  return useObservable(store);
}

/** Keeps the list in step after a project was saved somewhere else. */
export function noteProjectChanged(row: Project): void {
  store.update((current) => {
    if (current.status !== 'ready') return current;
    const exists = current.projects.some((project) => project.id === row.id);
    const projects = exists
      ? current.projects.map((project) => (project.id === row.id ? { ...project, ...row } : project))
      : [...current.projects, row].sort((a, b) => a.name.localeCompare(b.name));
    return { ...current, projects };
  });
}

/* ------------------------------------------------------------ primary --- */

export const isFlaggedPrimary = (project: Project) =>
  Boolean(project.config && (project.config as Record<string, unknown>).primary === true);

/** The home project, by the three rules at the top of this file. */
export function pickPrimary(projects: Project[]): Project | null {
  const active = projects.filter((project) => project.status === 'active');
  const byRecent = (a: Project, b: Project) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  const flagged = active.filter(isFlaggedPrimary).sort(byRecent);
  if (flagged.length) return flagged[0]!;
  if (active.length === 1) return active[0]!;
  return [...active].sort(byRecent)[0] ?? null;
}

export function usePrimaryProject(): Project | null {
  const { projects } = useProjectList();
  return pickPrimary(projects);
}

/**
 * Makes one project the home project and takes the flag off any other. It is
 * a read-modify-write of `config`, so it sends the config it last read; the
 * setting changes rarely enough that this is the right trade.
 */
export async function setPrimaryProject(projectId: string): Promise<{ ok: boolean; error?: AppError }> {
  const { projects } = store.get();
  const changes = projects
    .filter((project) => project.id === projectId || isFlaggedPrimary(project))
    .map((project) => {
      const config = { ...(project.config ?? {}) } as Record<string, unknown>;
      if (project.id === projectId) config.primary = true;
      else delete config.primary;
      return { id: project.id, config };
    });

  try {
    for (const change of changes) {
      const { error } = await supabase.from('projects').update({ config: change.config }).eq('id', change.id);
      if (error) throw error;
    }
    const now = new Date().toISOString();
    store.update((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        const change = changes.find((entry) => entry.id === project.id);
        return change ? { ...project, config: change.config, updated_at: now } : project;
      }),
    }));
    return { ok: true };
  } catch (error) {
    logError('setPrimaryProject', error);
    return { ok: false, error: toAppError(error) };
  }
}

/* --------------------------------------------------------------- tabs --- */

export type TabKey = 'plan' | 'reports' | 'partners' | 'numbers' | 'notes';

export const TABS: Record<ProjectKind, TabKey[]> = {
  grant: ['plan', 'reports', 'partners', 'numbers'],
  general: ['plan', 'notes'],
};

export const TAB_LABEL: Record<TabKey, string> = {
  plan: 'Plan',
  reports: 'Reports',
  partners: 'Partners',
  numbers: 'Numbers',
  notes: 'Notes',
};

/**
 * Addresses from before the redesign, and where they land now. The old tab
 * becomes the new tab plus whatever should open on top of it.
 */
export function redirectFor(
  kind: ProjectKind,
  tab: string | undefined
): { tab: TabKey; query?: Record<string, string> } | null {
  switch (tab) {
    case 'overview':
      return { tab: 'plan', query: { about: 'start' } };
    case 'deliverables':
    case 'tasks':
      return { tab: 'plan' };
    case 'outcomes':
      return kind === 'grant' ? { tab: 'numbers', query: { focus: 'outcomes' } } : { tab: 'plan' };
    case 'budget':
      return kind === 'grant' ? { tab: 'numbers', query: { focus: 'budget' } } : { tab: 'plan' };
    case 'rulebook':
      return { tab: 'plan', query: { about: 'rulebook' } };
    case 'activity':
      return { tab: 'plan', query: { activity: '1' } };
    default:
      return null;
  }
}
