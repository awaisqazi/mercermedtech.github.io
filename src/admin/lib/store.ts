/**
 * ============================================================================
 * THE PROJECT DATA STORE
 * ============================================================================
 *
 * One open project at a time. `openProject(slug)` loads everything that
 * project's screens need, opens a single private realtime channel for it, and
 * keeps the in-memory copy in step with the database. `closeProject()` tears
 * all of that down. Everything else in the portal reads through the hooks
 * below and writes through the mutation helpers; nothing else talks to the
 * `tasks` / `reports` / `partners` / `project_state` / `project_docs` /
 * `comments` / `activity` tables directly.
 *
 * ----------------------------------------------------------------- lifecycle
 *   openProject(slug)            loads project, my membership and role, the
 *                                member profiles, tasks, reports, partners,
 *                                state, docs and recent activity, then
 *                                subscribes to `project:<id>` (private).
 *                                Safe to call repeatedly with the same slug.
 *   closeProject()               unsubscribes, drops presence, clears state.
 *   refetch()                    re-reads everything (used on reconnect).
 *
 * --------------------------------------------------------------------- hooks
 *   useProject()                 { status, error, project, role, canEdit,
 *                                  canManage, readOnly, members, profiles,
 *                                  connection, config }
 *   useTasks()                   Task[]              (sort, then created_at)
 *   useReports()                 Report[]            (due, then period)
 *   usePartners()                Partner[]           (sort, then name)
 *   useProjectState(key)         [data, patch]  patch(fn) === upsertState
 *   useDocs(section)             ProjectDoc[]        (sort, then title)
 *   useActivity()                { rows, loadMore, loading, done }
 *   useComments(entity, id)      { rows, loading, add, remove }  (lazy load)
 *   usePresence()                PresencePeer[]      (other people, not you)
 *   useLiveField(...)            see below
 *   useProfileOf(userId)         Profile | null      (for avatars and names)
 *   useHistory(entityId)         { rows, loading }   (activity for one item, lazy)
 *
 * ----------------------------------------------------------------- mutations
 *   insertRow(table, values)     -> { ok, row?, error? }   optimistic, temp id
 *   updateRow(table, id, patch)  -> { ok, error? }         optimistic, rollback
 *   deleteRow(table, id)         -> { ok, error? }         optimistic, rollback
 *   upsertState(key, patchFn)    -> { ok, error? }         read-modify-write,
 *                                                          serialised per key
 *   setPresence({ tab, editing })
 *
 * `table` is one of 'tasks' | 'reports' | 'partners' | 'project_docs' |
 * 'comments'. `project_id` is filled in for you.
 *
 * ---------------------------------------------- collaboration, in three parts
 *  1. Optimistic updates. A change lands in memory first and is rolled back if
 *     the database refuses it. Only the changed columns are sent.
 *  2. Echo suppression. Every in-flight write records which fields it touched.
 *     When the realtime event for our own write arrives, those fields keep the
 *     local value, so a slow round trip cannot make a field flicker back.
 *  3. Focused-field protection. `useLiveField` locks the field while the
 *     cursor is in it. An incoming change to a locked field is not applied;
 *     instead the field reports a hint ("Updated by Sam") and adopts the new
 *     value on blur if the user did not type anything of their own.
 *  4. Heads-up. When somebody else changes the task, report or partner you
 *     have open (the one in your presence `editing`), a toast says who and
 *     what ("Sam changed the due date"), so a change is never silent.
 *
 * ------------------------------------------------------------------- caveats
 *  - The database may not be migrated yet. Every load path reports
 *    `status: 'missing'` rather than retrying, and the UI says so plainly.
 *  - A permission error flips `readOnly` on instead of looping.
 *  - Realtime DELETEs only carry the primary key unless the table has
 *    `replica identity full`, which is why deletes are matched by id alone.
 */
import { supabase } from './supabase';
import { ACTIVITY_PAGE, LOAD_DEADLINE_MS, SLOW_LOAD_MS } from './config';
import { withDeadline } from './deadline';
import { observable, useObservable } from './observable';
import { getAuth, resumeSession } from './auth';
import { logError, toAppError, type AppError } from './errors';
import { getProjectList, noteProjectChanged } from './projects';
import { timed } from './timing';
import { toast } from './toasts';
import type {
  ActivityRow,
  Comment,
  CommentEntity,
  Partner,
  Profile,
  Project,
  ProjectConfig,
  ProjectDoc,
  ProjectMember,
  ProjectRole,
  ProjectStateRow,
  Report,
  Task,
} from './types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { RealtimeChannel } from '@supabase/supabase-js';

/* ========================================================== state shape === */

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'missing' | 'error';
export type Connection = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline';

/** A writable content table. `project_state` has its own helper. */
export type WritableTable = 'tasks' | 'reports' | 'partners' | 'project_docs' | 'comments';

export interface PresencePeer {
  user_id: string;
  name: string;
  tab: string;
  /** `task:<id>` while someone has that card open, otherwise empty. */
  editing: string;
}

export interface ProjectStoreState {
  slug: string | null;
  status: LoadStatus;
  error: AppError | null;
  project: Project | null;
  role: ProjectRole | null;
  canEdit: boolean;
  canManage: boolean;
  /** True when this person may look but not touch (viewer, or RLS said no). */
  readOnly: boolean;
  members: ProjectMember[];
  profiles: Record<string, Profile>;
  tasks: Task[];
  reports: Report[];
  partners: Partner[];
  /** `project_state` rows by key. */
  state: Record<string, ProjectStateRow>;
  docs: ProjectDoc[];
  activity: ActivityRow[];
  activityDone: boolean;
  /** Comment threads by `<entity>:<id>`, loaded on demand. */
  comments: Record<string, Comment[]>;
  commentsLoading: Record<string, boolean>;
  /** Activity for one item, by entity id, loaded when its panel opens. */
  history: Record<string, ActivityRow[]>;
  historyLoading: Record<string, boolean>;
  presence: PresencePeer[];
  connection: Connection;
  /**
   * The load is still going and has been for a while. Not an error yet: the
   * screen says "still loading" instead of showing a placeholder in silence.
   */
  slow: boolean;
}

const EMPTY_STATE: ProjectStoreState = {
  slug: null,
  status: 'idle',
  error: null,
  project: null,
  role: null,
  canEdit: false,
  canManage: false,
  readOnly: true,
  members: [],
  profiles: {},
  tasks: [],
  reports: [],
  partners: [],
  state: {},
  docs: [],
  activity: [],
  activityDone: false,
  comments: {},
  commentsLoading: {},
  history: {},
  historyLoading: {},
  presence: [],
  connection: 'idle',
  slow: false,
};

const store = observable<ProjectStoreState>(EMPTY_STATE);

export function getProjectState(): ProjectStoreState {
  return store.get();
}

/* ============================================================ sorting === */

const byTaskOrder = (a: Task, b: Task) =>
  a.sort - b.sort || a.created_at.localeCompare(b.created_at);
const byReportOrder = (a: Report, b: Report) =>
  (a.due ?? a.period).localeCompare(b.due ?? b.period) || a.period.localeCompare(b.period);
const byPartnerOrder = (a: Partner, b: Partner) => a.sort - b.sort || a.name.localeCompare(b.name);
const byDocOrder = (a: ProjectDoc, b: ProjectDoc) => a.sort - b.sort || a.title.localeCompare(b.title);
const byActivityOrder = (a: ActivityRow, b: ActivityRow) => b.id - a.id;

function sortFor(table: WritableTable | 'activity'): ((a: never, b: never) => number) | null {
  switch (table) {
    case 'tasks':
      return byTaskOrder as never;
    case 'reports':
      return byReportOrder as never;
    case 'partners':
      return byPartnerOrder as never;
    case 'project_docs':
      return byDocOrder as never;
    case 'activity':
      return byActivityOrder as never;
    default:
      return null;
  }
}

/* ==================================== echo suppression + field locking === */

/** Fields with a write in flight: `<table>:<id>` -> field -> local value. */
const inFlight = new Map<string, Map<string, unknown>>();
/** Fields the cursor is in: `<table>:<id>:<field>`. */
const focusLocks = new Set<string>();

/** Hints for locked fields whose value changed underneath the typist. */
export interface FieldHint {
  by: string;
  value: unknown;
}
const hints = observable<Record<string, FieldHint>>({});

export function lockField(table: string, id: string, field: string): void {
  focusLocks.add(`${table}:${id}:${field}`);
}

export function unlockField(table: string, id: string, field: string): FieldHint | null {
  const key = `${table}:${id}:${field}`;
  focusLocks.delete(key);
  const hint = hints.get()[key] ?? null;
  if (hint) {
    hints.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  return hint;
}

function noteInFlight(table: string, id: string, patch: Record<string, unknown>): void {
  const key = `${table}:${id}`;
  const fields = inFlight.get(key) ?? new Map<string, unknown>();
  for (const [field, value] of Object.entries(patch)) fields.set(field, value);
  inFlight.set(key, fields);
}

function clearInFlight(table: string, id: string, patch: Record<string, unknown>): void {
  const key = `${table}:${id}`;
  const fields = inFlight.get(key);
  if (!fields) return;
  for (const field of Object.keys(patch)) fields.delete(field);
  if (fields.size === 0) inFlight.delete(key);
}

/**
 * Merges a row the server sent with the copy we are showing, keeping any field
 * that is either mid-save (our own echo) or under the cursor right now.
 */
function mergeIncoming<T extends Record<string, unknown>>(
  table: string,
  id: string,
  local: T | undefined,
  incoming: T,
  byName: string
): T {
  if (!local) return incoming;
  const pending = inFlight.get(`${table}:${id}`);
  const merged: Record<string, unknown> = { ...incoming };
  const newHints: Record<string, FieldHint> = {};

  for (const field of Object.keys(incoming)) {
    if (pending?.has(field)) {
      merged[field] = pending.get(field);
      continue;
    }
    const lockKey = `${table}:${id}:${field}`;
    if (focusLocks.has(lockKey) && !Object.is(local[field], incoming[field])) {
      merged[field] = local[field];
      newHints[lockKey] = { by: byName, value: incoming[field] };
    }
  }

  if (Object.keys(newHints).length) {
    hints.update((current) => ({ ...current, ...newHints }));
  }
  return merged as T;
}

/* ============================================================ loading === */

let loadToken = 0;
let channel: RealtimeChannel | null = null;
let currentProjectId: string | null = null;
let hadConnection = false;

interface Loaded {
  project: Project;
  membership: ProjectMember | null;
  members: ProjectMember[];
  profiles: Record<string, Profile>;
  tasks: Task[];
  reports: Report[];
  partners: Partner[];
  state: Record<string, ProjectStateRow>;
  docs: ProjectDoc[];
  activity: ActivityRow[];
}

/**
 * Everything a project screen needs, in as few round trips as possible.
 *
 * The project row usually comes from the project list the shell has already
 * read (projects.ts), so every other request can go out at once, alongside a
 * fresh read of the project row itself. Only an address for a project the
 * list does not know yet (a new one, or a list that has not loaded) costs a
 * first round trip to turn the slug into an id. Profiles no longer wait for
 * the member list: every signed-in person may read every profile, so they are
 * fetched in the same batch and the members' ones picked out.
 */
async function fetchEverything(slug: string): Promise<Loaded> {
  let known = getProjectList().projects.find((project) => project.slug === slug) ?? null;
  if (!known) {
    const projectResult = await timed(
      'project.row',
      supabase.from('projects').select('*').eq('slug', slug).maybeSingle()
    );
    if (projectResult.error) throw projectResult.error;
    if (!projectResult.data) {
      throw { message: 'That project does not exist, or you are not a member of it.', code: 'NOPROJECT' };
    }
    known = projectResult.data as Project;
  }
  const projectId = known.id;

  const [fresh, members, profileRows, tasks, reports, partners, state, docs, activity] = await Promise.all([
    timed('project.fresh', supabase.from('projects').select('*').eq('id', projectId).maybeSingle()),
    timed('project.members', supabase.from('project_members').select('*').eq('project_id', projectId)),
    timed('project.profiles', supabase.from('profiles').select('*')),
    timed('project.tasks', supabase.from('tasks').select('*').eq('project_id', projectId)),
    timed('project.reports', supabase.from('reports').select('*').eq('project_id', projectId)),
    timed('project.partners', supabase.from('partners').select('*').eq('project_id', projectId)),
    timed('project.state', supabase.from('project_state').select('*').eq('project_id', projectId)),
    timed('project.docs', supabase.from('project_docs').select('*').eq('project_id', projectId)),
    timed(
      'project.activity',
      supabase
        .from('activity')
        .select('*')
        .eq('project_id', projectId)
        .order('id', { ascending: false })
        .limit(ACTIVITY_PAGE)
    ),
  ]);

  for (const result of [fresh, members, profileRows, tasks, reports, partners, state, docs, activity]) {
    if (result.error) throw result.error;
  }
  if (!fresh.data) {
    throw { message: 'That project does not exist, or you are not a member of it.', code: 'NOPROJECT' };
  }
  const project = fresh.data as Project;

  const memberRows = (members.data ?? []) as ProjectMember[];
  const memberIds = new Set(memberRows.map((row) => row.user_id));
  const profiles: Record<string, Profile> = {};
  for (const row of (profileRows.data ?? []) as Profile[]) {
    if (memberIds.has(row.id)) profiles[row.id] = row;
  }

  const stateMap: Record<string, ProjectStateRow> = {};
  for (const row of (state.data ?? []) as ProjectStateRow[]) stateMap[row.key] = row;

  const me = getAuth().userId;

  return {
    project,
    membership: memberRows.find((row) => row.user_id === me) ?? null,
    members: memberRows,
    profiles,
    tasks: ((tasks.data ?? []) as Task[]).sort(byTaskOrder),
    reports: ((reports.data ?? []) as Report[]).sort(byReportOrder),
    partners: ((partners.data ?? []) as Partner[]).sort(byPartnerOrder),
    state: stateMap,
    docs: ((docs.data ?? []) as ProjectDoc[]).sort(byDocOrder),
    activity: ((activity.data ?? []) as ActivityRow[]).sort(byActivityOrder),
  };
}

function applyLoaded(slug: string, loaded: Loaded): void {
  const auth = getAuth();
  const globalAdmin = auth.profile?.role === 'admin' || auth.profile?.role === 'owner';
  const role = loaded.membership?.role ?? null;
  const canManage = globalAdmin || role === 'manager';
  const canEdit = canManage || role === 'editor';

  store.set({
    ...EMPTY_STATE,
    slug,
    status: 'ready',
    project: loaded.project,
    role,
    canEdit,
    canManage,
    readOnly: !canEdit,
    members: loaded.members,
    profiles: loaded.profiles,
    tasks: loaded.tasks,
    reports: loaded.reports,
    partners: loaded.partners,
    state: loaded.state,
    docs: loaded.docs,
    activity: loaded.activity,
    activityDone: loaded.activity.length < ACTIVITY_PAGE,
    connection: 'connecting',
  });
}

function reportLoadFailure(error: unknown): void {
  const appError = toAppError(error);
  logError('openProject', error);
  const status: LoadStatus = appError.missingSchema
    ? 'missing'
    : appError.permission
      ? 'denied'
      : 'error';
  store.update((current) => ({
    ...current,
    status,
    error: appError,
    slow: false,
    connection: 'idle',
  }));
}

/*
 * A load that is still going after a few seconds says so, and a load that is
 * still going after the deadline stops being a load and becomes an error with
 * a Retry on it. Between them there is no way to be left looking at a
 * placeholder that will never fill in.
 */
let slowTimer: ReturnType<typeof setTimeout> | null = null;

function startSlowTimer(token: number): void {
  if (slowTimer) clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    slowTimer = null;
    if (token !== loadToken) return;
    store.update((current) => (current.status === 'loading' ? { ...current, slow: true } : current));
  }, SLOW_LOAD_MS);
}

function stopSlowTimer(): void {
  if (slowTimer) clearTimeout(slowTimer);
  slowTimer = null;
}

/**
 * Loads a project and starts its realtime channel. Calling it again with the
 * same slug is a no-op once the project is ready.
 */
export async function openProject(slug: string): Promise<void> {
  const current = store.get();
  if (current.slug === slug && (current.status === 'ready' || current.status === 'loading')) return;

  const token = ++loadToken;
  teardownChannel();
  store.set({ ...EMPTY_STATE, slug, status: 'loading', connection: 'connecting' });
  startSlowTimer(token);

  try {
    const loaded = await withDeadline(fetchEverything(slug), LOAD_DEADLINE_MS);
    if (token !== loadToken) return;
    stopSlowTimer();
    applyLoaded(slug, loaded);
    currentProjectId = loaded.project.id;
    subscribe(loaded.project.id);
  } catch (error) {
    if (token !== loadToken) return;
    stopSlowTimer();
    reportLoadFailure(error);
  }
}

/** What the Retry button on the project screen calls. */
export async function retryProject(): Promise<void> {
  const { slug } = store.get();
  if (!slug) return;
  // Forget the failed attempt so `openProject` does not treat it as settled,
  // and ask the SDK for the session again: a stalled load usually means the
  // session itself is the thing that is stuck.
  loadToken += 1;
  store.set({ ...EMPTY_STATE, slug, status: 'idle' });
  await resumeSession('restore');
  await openProject(slug);
}

/** Re-reads everything for the open project. Used after a reconnection. */
export async function refetch(): Promise<void> {
  const { slug } = store.get();
  if (!slug) return;
  const token = ++loadToken;
  try {
    const loaded = await withDeadline(fetchEverything(slug), LOAD_DEADLINE_MS);
    if (token !== loadToken) return;
    const connection = store.get().connection;
    applyLoaded(slug, loaded);
    store.update((current) => ({ ...current, connection }));
    currentProjectId = loaded.project.id;
  } catch (error) {
    if (token !== loadToken) return;
    // A refetch is a background errand. If it fails we keep what is already on
    // screen and let the connection banner do the talking, rather than
    // throwing away a readable project because one catch-up request stalled.
    logError('refetch', error);
    store.update((seen) =>
      seen.connection === 'live' ? { ...seen, connection: 'reconnecting' } : seen
    );
  }
}

export function closeProject(): void {
  loadToken += 1;
  stopSlowTimer();
  teardownChannel();
  currentProjectId = null;
  inFlight.clear();
  focusLocks.clear();
  hints.set({});
  store.set(EMPTY_STATE);
}

/* =========================================================== realtime === */

function nameOf(userId: string | null | undefined): string {
  if (!userId) return 'someone';
  const profile = store.get().profiles[userId];
  return profile?.full_name?.trim() || profile?.email || 'someone';
}

type AnyRow = Record<string, unknown>;

function upsertInList<T extends { id: string }>(
  list: T[],
  row: T,
  sorter: ((a: T, b: T) => number) | null
): T[] {
  const index = list.findIndex((item) => item.id === row.id);
  const next = index === -1 ? [...list, row] : list.map((item, i) => (i === index ? row : item));
  return sorter ? next.sort(sorter) : next;
}

function applyChange(table: WritableTable | 'activity' | 'project_state', payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: AnyRow;
  old: AnyRow;
}): void {
  const event = payload.eventType;
  const row = payload.new ?? {};
  const old = payload.old ?? {};

  // project_state has a composite key and no `id`.
  if (table === 'project_state') {
    store.update((current) => {
      if (event === 'DELETE') {
        const key = String(old.key ?? '');
        if (!key || !(key in current.state)) return current;
        const next = { ...current.state };
        delete next[key];
        return { ...current, state: next };
      }
      const incoming = row as unknown as ProjectStateRow;
      if (!incoming.key) return current;
      const local = current.state[incoming.key];
      const merged = mergeIncoming(
        'project_state',
        incoming.key,
        local as unknown as AnyRow | undefined,
        incoming as unknown as AnyRow,
        nameOf(incoming.updated_by)
      ) as unknown as ProjectStateRow;
      return { ...current, state: { ...current.state, [incoming.key]: merged } };
    });
    return;
  }

  if (table === 'activity') {
    if (event !== 'INSERT') return;
    const incoming = row as unknown as ActivityRow;
    store.update((current) => {
      if (current.activity.some((item) => item.id === incoming.id)) return current;
      const next = { ...current, activity: [incoming, ...current.activity].sort(byActivityOrder) };
      const thread = incoming.entity_id ? current.history[incoming.entity_id] : undefined;
      if (thread && !thread.some((item) => item.id === incoming.id)) {
        next.history = { ...current.history, [incoming.entity_id!]: [incoming, ...thread] };
      }
      return next;
    });
    return;
  }

  if (table === 'comments') {
    const incoming = (event === 'DELETE' ? old : row) as unknown as Comment;
    if (!incoming?.id) return;
    const key = `${incoming.entity}:${incoming.entity_id}`;
    store.update((current) => {
      const thread = current.comments[key];
      // A thread nobody has opened is not worth keeping in memory.
      if (!thread) return current;
      if (event === 'DELETE') {
        return { ...current, comments: { ...current.comments, [key]: thread.filter((c) => c.id !== incoming.id) } };
      }
      const next = upsertInList(thread, incoming, (a, b) => a.created_at.localeCompare(b.created_at));
      return { ...current, comments: { ...current.comments, [key]: next } };
    });
    return;
  }

  const id = String((event === 'DELETE' ? old.id : row.id) ?? '');
  if (!id) return;

  store.update((current) => {
    const listKey = table === 'project_docs' ? 'docs' : (table as 'tasks' | 'reports' | 'partners');
    const list = current[listKey] as Array<{ id: string }>;

    if (event === 'DELETE') {
      if (!list.some((item) => item.id === id)) return current;
      return { ...current, [listKey]: list.filter((item) => item.id !== id) } as ProjectStoreState;
    }

    const local = list.find((item) => item.id === id) as AnyRow | undefined;
    if (event === 'UPDATE' && local) headsUp(table, id, local, row);
    const merged = mergeIncoming(table, id, local, row, nameOf(row.updated_by as string | null));
    const next = upsertInList(list, merged as { id: string }, sortFor(table) as never);
    return { ...current, [listKey]: next } as ProjectStoreState;
  });
}

/* The words for a changed column, for the heads-up toast. */
const FIELD_WORDS: Record<string, string> = {
  title: 'the title',
  name: 'the name',
  status: 'the status',
  pri: 'the priority',
  horizon: 'when it is planned for',
  due: 'the due date',
  assignee: 'who it is assigned to',
  owner: 'the owner',
  ws: 'the workstream',
  why: 'why it matters',
  done_when: 'what done looks like',
  notes: 'the notes',
  sources: 'the sources',
  checks: 'the checklist',
  amount: 'the amount',
  submitted_on: 'the date it was submitted',
  covers: 'what it covers',
  stage: 'the stage',
  referrals: 'the referral count',
  next_step: 'the next step',
  contact: 'the contact',
  county: 'the county',
  kind: 'the kind',
};

const ENTITY_OF: Partial<Record<WritableTable, string>> = {
  tasks: 'task',
  reports: 'report',
  partners: 'partner',
};

/**
 * Someone else changed the item this person has open: say so. Our own echoes
 * never get here as "someone else", and a field under the cursor still gets
 * its own hint from mergeIncoming as well.
 */
function headsUp(table: WritableTable, id: string, local: AnyRow, incoming: AnyRow): void {
  const entity = ENTITY_OF[table];
  if (!entity || presenceMeta.editing !== `${entity}:${id}`) return;
  const by = incoming.updated_by as string | null | undefined;
  if (!by || by === getAuth().userId) return;
  const changed = Object.keys(FIELD_WORDS).filter(
    (field) => field in incoming && JSON.stringify(local[field]) !== JSON.stringify(incoming[field])
  );
  if (!changed.length) return;
  const words = changed.slice(0, 2).map((field) => FIELD_WORDS[field]);
  const more = changed.length > 2 ? ' and more' : '';
  toast.info(`${nameOf(by)} changed ${words.join(' and ')}${more}.`);
}

const WATCHED: Array<WritableTable | 'activity' | 'project_state'> = [
  'tasks',
  'reports',
  'partners',
  'project_state',
  'project_docs',
  'comments',
  'activity',
];

function subscribe(projectId: string): void {
  const auth = getAuth();
  const userId = auth.userId ?? 'anonymous';

  channel = supabase.channel(`project:${projectId}`, {
    config: {
      // A private channel: the policies on realtime.messages check membership,
      // so nobody can listen to a project they are not on.
      private: true,
      presence: { key: userId },
      broadcast: { self: false },
    },
  });

  for (const table of WATCHED) {
    channel.on(
      // The SDK's overloads are string-literal based; this is the documented
      // postgres_changes shape.
      'postgres_changes' as never,
      { event: '*', schema: 'public', table, filter: `project_id=eq.${projectId}` } as never,
      ((payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: AnyRow; old: AnyRow }) => {
        try {
          applyChange(table, payload);
        } catch (error) {
          logError(`realtime ${table}`, error);
        }
      }) as never
    );
  }

  channel.on('presence', { event: 'sync' }, () => {
    if (!channel) return;
    const raw = channel.presenceState<Partial<PresencePeer>>();
    const peers: PresencePeer[] = [];
    for (const entries of Object.values(raw)) {
      for (const entry of entries) {
        if (!entry?.user_id) continue;
        peers.push({
          user_id: String(entry.user_id),
          name: String(entry.name ?? ''),
          tab: String(entry.tab ?? ''),
          editing: String(entry.editing ?? ''),
        });
      }
    }
    // One entry per person, even with two tabs open.
    const unique = new Map<string, PresencePeer>();
    for (const peer of peers) unique.set(peer.user_id, peer);
    store.update((current) => ({ ...current, presence: [...unique.values()] }));
  });

  const joining = channel;
  // Private channels are authorised with the user's JWT. The SDK forwards it on
  // auth events, but setting it explicitly before joining removes any race
  // between "session restored" and "first channel opened".
  void supabase.realtime
    .setAuth()
    .catch((error) => logError('realtime setAuth', error))
    .then(() => {
      if (channel !== joining) return; // project was closed while we waited
      joining.subscribe((status, error) => {
        // A channel we have already replaced still reports its own CLOSED.
        if (channel !== joining) return;
        onChannelStatus(projectId, status, error);
      });
    });
}

/* The SDK rejoins after a dropped socket, but not after the server closes or
   refuses a channel (an expired token, a policy hiccup, a timeout). Those need
   a fresh channel, tried again with a growing pause so a real outage is not
   hammered. */
let rejoinAttempts = 0;
let rejoinTimer: ReturnType<typeof setTimeout> | null = null;

function cancelRejoin(): void {
  if (rejoinTimer) clearTimeout(rejoinTimer);
  rejoinTimer = null;
}

function scheduleRejoin(projectId: string): void {
  if (rejoinTimer) return;
  /*
   * 1s, 2s, 4s … up to 30s, and the count is only ever reset by an actual
   * SUBSCRIBED. Safari suspends WebSockets hard when a tab goes to the back,
   * and it can close a freshly opened one straight away several times over; if
   * coming back to the tab reset the count, the two would take turns and the
   * portal would sit there opening and closing sockets as fast as it could.
   */
  const delay = Math.min(REJOIN_MAX_DELAY_MS, 1_000 * 2 ** Math.min(rejoinAttempts, 5));
  rejoinAttempts += 1;
  rejoinTimer = setTimeout(() => {
    rejoinTimer = null;
    if (currentProjectId !== projectId) return;
    const resumed = hadConnection;
    const attempts = rejoinAttempts;
    teardownChannel();
    hadConnection = resumed; // so the next SUBSCRIBED refetches what we missed
    rejoinAttempts = attempts; // teardown must not wipe the backoff either
    subscribe(projectId);
  }, delay);
}

/** Never wait longer than this between attempts, however bad it gets. */
const REJOIN_MAX_DELAY_MS = 30_000;

function onChannelStatus(projectId: string, status: string, error?: unknown): void {
  if (status === 'SUBSCRIBED') {
    rejoinAttempts = 0;
    cancelRejoin();
    store.update((current) => ({ ...current, connection: 'live' }));
    void trackPresence();
    // Anything that changed while we were away is not replayed, so a
    // reconnection has to go and look.
    if (hadConnection) void refetch();
    hadConnection = true;
    return;
  }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    if (error) logError(`realtime ${status}`, error);
    store.update((current) =>
      current.connection === 'idle' ? current : { ...current, connection: 'reconnecting' }
    );
    scheduleRejoin(projectId);
  }
}

function teardownChannel(): void {
  cancelRejoin();
  hadConnection = false;
  rejoinAttempts = 0;
  if (!channel) return;
  const leaving = channel;
  channel = null;
  try {
    void leaving.untrack().catch((error) => logError('untrack', error));
  } catch (error) {
    logError('untrack', error);
  }
  try {
    // Safari can have already torn the socket down underneath us, in which
    // case this rejects. It is a cleanup: a failure here must not stop the
    // fresh channel from being opened.
    void Promise.resolve(supabase.removeChannel(leaving)).catch((error) =>
      logError('removeChannel', error)
    );
  } catch (error) {
    logError('removeChannel', error);
  }
}

/* ============================================================ presence === */

let presenceMeta: { tab: string; editing: string } = { tab: '', editing: '' };

async function trackPresence(): Promise<void> {
  if (!channel || store.get().connection !== 'live') return;
  const auth = getAuth();
  try {
    await channel.track({
      user_id: auth.userId ?? '',
      name: auth.profile?.full_name?.trim() || auth.email || 'Someone',
      tab: presenceMeta.tab,
      editing: presenceMeta.editing,
    });
  } catch (error) {
    logError('track presence', error);
  }
}

/** Tells everyone else which tab you are on and what you have open. */
export function setPresence(meta: { tab?: string; editing?: string }): void {
  const next = {
    tab: meta.tab ?? presenceMeta.tab,
    editing: meta.editing ?? presenceMeta.editing,
  };
  if (next.tab === presenceMeta.tab && next.editing === presenceMeta.editing) return;
  presenceMeta = next;
  void trackPresence();
}

/* ============================================================ mutations === */

export interface MutationResult<T = unknown> {
  ok: boolean;
  row?: T;
  error?: AppError;
}

function listKeyFor(table: WritableTable): 'tasks' | 'reports' | 'partners' | 'docs' | null {
  if (table === 'project_docs') return 'docs';
  if (table === 'comments') return null;
  return table;
}

function requireProject(): string | null {
  return store.get().project?.id ?? null;
}

function denied(): MutationResult {
  return {
    ok: false,
    error: toAppError({ message: 'permission denied', code: '42501' }),
  };
}

/** Inserts a row, showing it straight away under a temporary id. */
export async function insertRow<T extends { id: string }>(
  table: WritableTable,
  values: Record<string, unknown>
): Promise<MutationResult<T>> {
  const projectId = requireProject();
  if (!projectId) return { ok: false, error: toAppError({ message: 'No project open.' }) };
  const current = store.get();
  if (table === 'comments' ? false : current.readOnly) return denied() as MutationResult<T>;

  const tempId = `temp-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const auth = getAuth();
  const optimistic = {
    ...values,
    id: tempId,
    project_id: projectId,
    created_at: now,
    updated_at: now,
    created_by: auth.userId,
    updated_by: auth.userId,
    user_id: table === 'comments' ? auth.userId : values.user_id,
  } as unknown as T;

  const key = listKeyFor(table);
  if (key) {
    store.update((state) => ({
      ...state,
      [key]: upsertInList(state[key] as Array<{ id: string }>, optimistic, sortFor(table) as never),
    }));
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .insert({ ...values, project_id: projectId })
      .select('*')
      .single();
    if (error) throw error;
    const row = data as T;
    if (key) {
      store.update((state) => ({
        ...state,
        [key]: upsertInList(
          (state[key] as Array<{ id: string }>).filter((item) => item.id !== tempId),
          row,
          sortFor(table) as never
        ),
      }));
    }
    return { ok: true, row };
  } catch (error) {
    logError(`insert ${table}`, error);
    if (key) {
      store.update((state) => ({
        ...state,
        [key]: (state[key] as Array<{ id: string }>).filter((item) => item.id !== tempId),
      }));
    }
    return { ok: false, error: toAppError(error) };
  }
}

/** Updates only the columns in `patch`, optimistically, rolling back on error. */
export async function updateRow(
  table: WritableTable,
  id: string,
  patch: Record<string, unknown>
): Promise<MutationResult> {
  if (!id || id.startsWith('temp-')) {
    return { ok: false, error: toAppError({ message: 'That row is still being saved.' }) };
  }
  if (store.get().readOnly) return denied();
  const key = listKeyFor(table);
  if (!key) return { ok: false, error: toAppError({ message: 'That row cannot be edited.' }) };

  const before = (store.get()[key] as unknown as Array<Record<string, unknown>>).find(
    (item) => item.id === id
  );
  if (!before) return { ok: false, error: toAppError({ message: 'That row is gone. Reload.' }) };

  const rollback: Record<string, unknown> = {};
  for (const field of Object.keys(patch)) rollback[field] = before[field];

  noteInFlight(table, id, patch);
  store.update((state) => ({
    ...state,
    [key]: (state[key] as unknown as Array<Record<string, unknown>>).map((item) =>
      item.id === id ? { ...item, ...patch } : item
    ),
  }));

  try {
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    logError(`update ${table}`, error);
    store.update((state) => ({
      ...state,
      [key]: (state[key] as unknown as Array<Record<string, unknown>>).map((item) =>
        item.id === id ? { ...item, ...rollback } : item
      ),
    }));
    const appError = toAppError(error);
    if (appError.permission) store.update((state) => ({ ...state, readOnly: true }));
    return { ok: false, error: appError };
  } finally {
    // Give the realtime echo a moment to arrive before releasing the field.
    setTimeout(() => clearInFlight(table, id, patch), 1500);
  }
}

export async function deleteRow(table: WritableTable, id: string): Promise<MutationResult> {
  if (!id || id.startsWith('temp-')) return { ok: false, error: toAppError({ message: 'Still saving.' }) };
  const key = listKeyFor(table);

  if (table === 'comments') {
    // Comments live in their threads, not in a top-level list.
    const snapshot = store.get().comments;
    let threadKey: string | null = null;
    let removed: Comment | null = null;
    for (const [entryKey, thread] of Object.entries(snapshot)) {
      const found = thread.find((comment) => comment.id === id);
      if (found) {
        threadKey = entryKey;
        removed = found;
        break;
      }
    }
    if (threadKey) {
      store.update((state) => ({
        ...state,
        comments: {
          ...state.comments,
          [threadKey!]: (state.comments[threadKey!] ?? []).filter((comment) => comment.id !== id),
        },
      }));
    }
    try {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      logError('delete comment', error);
      if (threadKey && removed) {
        const restore = removed;
        const restoreKey = threadKey;
        store.update((state) => ({
          ...state,
          comments: {
            ...state.comments,
            [restoreKey]: [...(state.comments[restoreKey] ?? []), restore].sort((a, b) =>
              a.created_at.localeCompare(b.created_at)
            ),
          },
        }));
      }
      return { ok: false, error: toAppError(error) };
    }
  }

  if (store.get().readOnly) return denied();
  if (!key) return { ok: false, error: toAppError({ message: 'That row cannot be deleted.' }) };

  const before = (store.get()[key] as Array<{ id: string }>).find((item) => item.id === id);
  store.update((state) => ({
    ...state,
    [key]: (state[key] as Array<{ id: string }>).filter((item) => item.id !== id),
  }));

  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    logError(`delete ${table}`, error);
    if (before) {
      store.update((state) => ({
        ...state,
        [key]: upsertInList(state[key] as Array<{ id: string }>, before, sortFor(table) as never),
      }));
    }
    const appError = toAppError(error);
    if (appError.permission) store.update((state) => ({ ...state, readOnly: true }));
    return { ok: false, error: appError };
  }
}

/* ------------------------------------------------------- project_state --- */

/** One promise chain per key, so two quick edits cannot race each other. */
const stateQueues = new Map<string, Promise<unknown>>();

/**
 * Read-modify-write on a `project_state` row. The patch function receives the
 * current data (never null) and returns the whole new object.
 */
export function upsertState(
  key: string,
  patchFn: (current: Record<string, unknown>) => Record<string, unknown>
): Promise<MutationResult> {
  const run = async (): Promise<MutationResult> => {
    const projectId = requireProject();
    if (!projectId) return { ok: false, error: toAppError({ message: 'No project open.' }) };
    if (store.get().readOnly) return denied();

    const existing = store.get().state[key];
    const before = existing?.data ?? {};
    const data = patchFn({ ...before });

    const optimistic: ProjectStateRow = {
      project_id: projectId,
      key,
      data,
      updated_by: getAuth().userId,
      updated_at: new Date().toISOString(),
    };
    noteInFlight('project_state', key, { data });
    store.update((state) => ({ ...state, state: { ...state.state, [key]: optimistic } }));

    try {
      const { error } = await supabase
        .from('project_state')
        .upsert({ project_id: projectId, key, data }, { onConflict: 'project_id,key' });
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      logError('upsertState', error);
      store.update((state) => {
        const next = { ...state.state };
        if (existing) next[key] = existing;
        else delete next[key];
        return { ...state, state: next };
      });
      const appError = toAppError(error);
      if (appError.permission) store.update((state) => ({ ...state, readOnly: true }));
      return { ok: false, error: appError };
    } finally {
      setTimeout(() => clearInFlight('project_state', key, { data }), 1500);
    }
  };

  const previous = stateQueues.get(key) ?? Promise.resolve();
  const next = previous.then(run, run);
  stateQueues.set(key, next.catch(() => undefined));
  return next;
}

/* ------------------------------------------------------------ comments --- */

function threadKey(entity: CommentEntity, id: string): string {
  return `${entity}:${id}`;
}

export async function loadComments(entity: CommentEntity, id: string): Promise<void> {
  const projectId = requireProject();
  if (!projectId || !id || id.startsWith('temp-')) return;
  const key = threadKey(entity, id);
  const current = store.get();
  if (current.comments[key] || current.commentsLoading[key]) return;

  store.update((state) => ({
    ...state,
    commentsLoading: { ...state.commentsLoading, [key]: true },
  }));

  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('project_id', projectId)
      .eq('entity', entity)
      .eq('entity_id', id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    store.update((state) => ({
      ...state,
      comments: { ...state.comments, [key]: (data ?? []) as Comment[] },
      commentsLoading: { ...state.commentsLoading, [key]: false },
    }));
  } catch (error) {
    logError('loadComments', error);
    store.update((state) => ({
      ...state,
      comments: { ...state.comments, [key]: [] },
      commentsLoading: { ...state.commentsLoading, [key]: false },
    }));
  }
}

export async function addComment(
  entity: CommentEntity,
  id: string,
  body: string
): Promise<MutationResult<Comment>> {
  const projectId = requireProject();
  const auth = getAuth();
  const text = body.trim();
  if (!projectId || !auth.userId) {
    return { ok: false, error: toAppError({ message: 'No project open.' }) };
  }
  if (!text) return { ok: false, error: toAppError({ message: 'Write something first.' }) };

  const key = threadKey(entity, id);
  const temp: Comment = {
    id: `temp-${Math.random().toString(36).slice(2, 10)}`,
    project_id: projectId,
    entity,
    entity_id: id,
    body: text,
    user_id: auth.userId,
    created_at: new Date().toISOString(),
  };
  store.update((state) => ({
    ...state,
    comments: { ...state.comments, [key]: [...(state.comments[key] ?? []), temp] },
  }));

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({ project_id: projectId, entity, entity_id: id, body: text, user_id: auth.userId })
      .select('*')
      .single();
    if (error) throw error;
    const row = data as Comment;
    store.update((state) => ({
      ...state,
      comments: {
        ...state.comments,
        [key]: [...(state.comments[key] ?? []).filter((c) => c.id !== temp.id), row].sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        ),
      },
    }));
    return { ok: true, row };
  } catch (error) {
    logError('addComment', error);
    store.update((state) => ({
      ...state,
      comments: {
        ...state.comments,
        [key]: (state.comments[key] ?? []).filter((c) => c.id !== temp.id),
      },
    }));
    return { ok: false, error: toAppError(error) };
  }
}

/* ------------------------------------------------------------ activity --- */

let activityLoading = false;

export async function loadMoreActivity(): Promise<void> {
  const current = store.get();
  const projectId = current.project?.id;
  if (!projectId || activityLoading || current.activityDone) return;
  activityLoading = true;
  const oldest = current.activity[current.activity.length - 1]?.id;
  try {
    let query = supabase
      .from('activity')
      .select('*')
      .eq('project_id', projectId)
      .order('id', { ascending: false })
      .limit(ACTIVITY_PAGE);
    if (oldest !== undefined) query = query.lt('id', oldest);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as ActivityRow[];
    store.update((state) => {
      const seen = new Set(state.activity.map((row) => row.id));
      const merged = [...state.activity, ...rows.filter((row) => !seen.has(row.id))];
      return { ...state, activity: merged.sort(byActivityOrder), activityDone: rows.length < ACTIVITY_PAGE };
    });
  } catch (error) {
    logError('loadMoreActivity', error);
    store.update((state) => ({ ...state, activityDone: true }));
  } finally {
    activityLoading = false;
  }
}

/* ------------------------------------------------------------- members --- */

/** Adds or changes a member. Managers only; the database enforces it too. */
export async function setMember(userId: string, role: ProjectRole): Promise<MutationResult> {
  const projectId = requireProject();
  if (!projectId) return { ok: false, error: toAppError({ message: 'No project open.' }) };
  try {
    const { data, error } = await supabase
      .from('project_members')
      .upsert({ project_id: projectId, user_id: userId, role }, { onConflict: 'project_id,user_id' })
      .select('*')
      .single();
    if (error) throw error;
    const row = data as ProjectMember;
    store.update((state) => ({
      ...state,
      members: [...state.members.filter((member) => member.user_id !== userId), row],
    }));
    await ensureProfiles([userId]);
    return { ok: true };
  } catch (error) {
    logError('setMember', error);
    return { ok: false, error: toAppError(error) };
  }
}

export async function removeMember(userId: string): Promise<MutationResult> {
  const projectId = requireProject();
  if (!projectId) return { ok: false, error: toAppError({ message: 'No project open.' }) };
  const before = store.get().members;
  store.update((state) => ({
    ...state,
    members: state.members.filter((member) => member.user_id !== userId),
  }));
  try {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    logError('removeMember', error);
    store.update((state) => ({ ...state, members: before }));
    return { ok: false, error: toAppError(error) };
  }
}

/** Pulls in profiles the store does not have yet (new members, comment authors). */
export async function ensureProfiles(ids: string[]): Promise<void> {
  const known = store.get().profiles;
  const missing = [...new Set(ids.filter((id) => id && !known[id]))];
  if (!missing.length) return;
  try {
    const { data, error } = await supabase.from('profiles').select('*').in('id', missing);
    if (error) throw error;
    const add: Record<string, Profile> = {};
    for (const row of (data ?? []) as Profile[]) add[row.id] = row;
    store.update((state) => ({ ...state, profiles: { ...state.profiles, ...add } }));
  } catch (error) {
    logError('ensureProfiles', error);
  }
}

/** Saves project-level settings (name, summary, track, status, config). */
export async function updateProject(patch: Partial<Project>): Promise<MutationResult<Project>> {
  const projectId = requireProject();
  if (!projectId) return { ok: false, error: toAppError({ message: 'No project open.' }) };
  const before = store.get().project;
  store.update((state) => ({
    ...state,
    project: state.project ? { ...state.project, ...patch } : state.project,
  }));
  try {
    const { data, error } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', projectId)
      .select('*')
      .single();
    if (error) throw error;
    const row = data as Project;
    store.update((state) => ({ ...state, project: row }));
    noteProjectChanged(row);
    return { ok: true, row };
  } catch (error) {
    logError('updateProject', error);
    store.update((state) => ({ ...state, project: before }));
    return { ok: false, error: toAppError(error) };
  }
}

/** Applies a change made elsewhere (the project list) to the open project. */
export function patchOpenProject(id: string, patch: Partial<Project>): void {
  store.update((state) =>
    state.project && state.project.id === id ? { ...state, project: { ...state.project, ...patch } } : state
  );
}

/* ------------------------------------------------------------- history --- */

const HISTORY_PAGE = 40;

/** Reads the activity rows about one item. Once per item per open project. */
export async function loadHistory(entityId: string): Promise<void> {
  const projectId = requireProject();
  if (!projectId || !entityId || entityId.startsWith('temp-')) return;
  const current = store.get();
  if (current.history[entityId] || current.historyLoading[entityId]) return;
  store.update((state) => ({ ...state, historyLoading: { ...state.historyLoading, [entityId]: true } }));
  try {
    const { data, error } = await supabase
      .from('activity')
      .select('*')
      .eq('project_id', projectId)
      .eq('entity_id', entityId)
      .order('id', { ascending: false })
      .limit(HISTORY_PAGE);
    if (error) throw error;
    store.update((state) => ({
      ...state,
      history: { ...state.history, [entityId]: ((data ?? []) as ActivityRow[]).sort(byActivityOrder) },
      historyLoading: { ...state.historyLoading, [entityId]: false },
    }));
  } catch (error) {
    logError('loadHistory', error);
    store.update((state) => ({
      ...state,
      history: { ...state.history, [entityId]: [] },
      historyLoading: { ...state.historyLoading, [entityId]: false },
    }));
  }
}

/* ============================================================== hooks === */

export interface ProjectView {
  status: LoadStatus;
  error: AppError | null;
  project: Project | null;
  config: ProjectConfig;
  role: ProjectRole | null;
  canEdit: boolean;
  canManage: boolean;
  readOnly: boolean;
  members: ProjectMember[];
  profiles: Record<string, Profile>;
  connection: Connection;
  /** True once a load has been going long enough to be worth mentioning. */
  slow: boolean;
}

const NO_CONFIG: ProjectConfig = {};

export function useProject(): ProjectView {
  const state = useObservable(store);
  return useMemo(
    () => ({
      status: state.status,
      error: state.error,
      project: state.project,
      config: state.project?.config ?? NO_CONFIG,
      role: state.role,
      canEdit: state.canEdit,
      canManage: state.canManage,
      readOnly: state.readOnly,
      members: state.members,
      profiles: state.profiles,
      connection: state.connection,
      slow: state.slow,
    }),
    [
      state.slow,
      state.status,
      state.error,
      state.project,
      state.role,
      state.canEdit,
      state.canManage,
      state.readOnly,
      state.members,
      state.profiles,
      state.connection,
    ]
  );
}

export function useTasks(): Task[] {
  return useObservable(store).tasks;
}

export function useReports(): Report[] {
  return useObservable(store).reports;
}

export function usePartners(): Partner[] {
  return useObservable(store).partners;
}

/** `[data, patch]` for one `project_state` key. */
export function useProjectState(
  key: string
): [Record<string, unknown>, (patchFn: (current: Record<string, unknown>) => Record<string, unknown>) => Promise<MutationResult>] {
  const state = useObservable(store);
  const data = state.state[key]?.data ?? EMPTY_OBJECT;
  const patch = useCallback(
    (patchFn: (current: Record<string, unknown>) => Record<string, unknown>) =>
      upsertState(key, patchFn),
    [key]
  );
  return [data, patch];
}

const EMPTY_OBJECT: Record<string, unknown> = {};
const EMPTY_DOCS: ProjectDoc[] = [];

/** Docs in one section. Pass no section to get them all. */
export function useDocs(section?: string): ProjectDoc[] {
  const docs = useObservable(store).docs;
  return useMemo(() => {
    if (!section) return docs;
    const matched = docs.filter((doc) => doc.section === section);
    return matched.length ? matched : EMPTY_DOCS;
  }, [docs, section]);
}

export interface ActivityView {
  rows: ActivityRow[];
  done: boolean;
  loadMore: () => void;
}

export function useActivity(): ActivityView {
  const state = useObservable(store);
  return {
    rows: state.activity,
    done: state.activityDone,
    loadMore: () => void loadMoreActivity(),
  };
}

export interface CommentsView {
  rows: Comment[];
  loading: boolean;
  add: (body: string) => Promise<MutationResult<Comment>>;
  remove: (id: string) => Promise<MutationResult>;
}

const EMPTY_COMMENTS: Comment[] = [];

/** Loads the thread the first time a component asks for it. */
export function useComments(entity: CommentEntity, id: string | null): CommentsView {
  const state = useObservable(store);
  const key = id ? threadKey(entity, id) : '';

  useEffect(() => {
    if (!id) return;
    void loadComments(entity, id);
  }, [entity, id]);

  const rows = (key && state.comments[key]) || EMPTY_COMMENTS;

  // Comment authors may not be project members any more; fetch what is missing.
  useEffect(() => {
    const unknown = rows.map((row) => row.user_id).filter((userId) => !state.profiles[userId]);
    if (unknown.length) void ensureProfiles(unknown);
  }, [rows, state.profiles]);

  return {
    rows,
    loading: Boolean(key && state.commentsLoading[key]),
    add: (body: string) =>
      id
        ? addComment(entity, id, body)
        : Promise.resolve({ ok: false, error: toAppError({ message: 'Nothing selected.' }) }),
    remove: (commentId: string) => deleteRow('comments', commentId),
  };
}

const EMPTY_HISTORY: ActivityRow[] = [];

/** What has happened to one task, report or partner, newest first. */
export function useHistory(entityId: string | null): { rows: ActivityRow[]; loading: boolean } {
  const state = useObservable(store);
  useEffect(() => {
    if (entityId) void loadHistory(entityId);
  }, [entityId]);
  if (!entityId) return { rows: EMPTY_HISTORY, loading: false };
  return {
    rows: state.history[entityId] ?? EMPTY_HISTORY,
    loading: Boolean(state.historyLoading[entityId]),
  };
}

/** Everyone else who is in this project right now. */
export function usePresence(): PresencePeer[] {
  const state = useObservable(store);
  const me = getAuth().userId;
  return useMemo(() => state.presence.filter((peer) => peer.user_id !== me), [state.presence, me]);
}

/** A profile from the store, without re-rendering on unrelated changes. */
export function useProfileOf(userId: string | null | undefined): Profile | null {
  const state = useObservable(store);
  return userId ? (state.profiles[userId] ?? null) : null;
}

/* ---------------------------------------------------------- useLiveField --- */

export interface LiveFieldOptions {
  /** Commit as soon as the value changes (selects, checkboxes, dates). */
  immediate?: boolean;
  /** Normalises before saving, e.g. trims or parses a number. */
  parse?: (draft: string) => unknown;
  /** Skips the save when the value has not really changed. */
  equals?: (a: unknown, b: unknown) => boolean;
  onSaved?: () => void;
  onError?: (error: AppError) => void;
}

export interface LiveField {
  /** What the input should show. */
  value: string;
  /** True while the save is in flight. */
  saving: boolean;
  /** "Updated by Sam" when someone changed this field while you were in it. */
  hint: string | null;
  onInput: (event: Event) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  /** For selects and checkboxes: commit a value straight away. */
  commit: (next: unknown) => void;
}

/**
 * Binds one column of one row to one input.
 *
 * Text inputs save on blur and on Enter; anything with `immediate` saves on
 * change. While the input has focus the store will not overwrite it: an
 * incoming change is held as a hint and applied on blur if the user has not
 * typed anything of their own.
 */
export function useLiveField(
  table: WritableTable,
  id: string,
  field: string,
  serverValue: unknown,
  options: LiveFieldOptions = {}
): LiveField {
  const { immediate = false, parse, equals } = options;
  const allHints = useObservable(hints);
  const lockKey = `${table}:${id}:${field}`;

  const toText = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  const [draft, setDraft] = useState(() => toText(serverValue));
  const [saving, setSaving] = useState(false);
  const focused = useRef(false);
  const dirty = useRef(false);

  // Follow the server while the cursor is elsewhere.
  useEffect(() => {
    if (focused.current) return;
    setDraft(toText(serverValue));
    dirty.current = false;
  }, [serverValue]);

  const same = (a: unknown, b: unknown) => (equals ? equals(a, b) : Object.is(a, b));

  const save = useCallback(
    async (raw: unknown) => {
      const next = parse ? parse(String(raw ?? '')) : raw;
      if (same(next, serverValue)) return;
      setSaving(true);
      const result = await updateRow(table, id, { [field]: next });
      setSaving(false);
      if (result.ok) options.onSaved?.();
      else if (result.error) options.onError?.(result.error);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [table, id, field, serverValue]
  );

  const onInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement | null;
    const value = target?.value ?? '';
    dirty.current = true;
    setDraft(value);
    if (immediate) void save(value);
  };

  const onFocus = () => {
    focused.current = true;
    dirty.current = false;
    lockField(table, id, field);
  };

  const onBlur = () => {
    focused.current = false;
    const hint = unlockField(table, id, field);
    if (dirty.current) {
      void save(draft);
    } else if (hint) {
      // Nothing was typed, so take what the other person wrote.
      setDraft(toText(hint.value));
    } else {
      setDraft(toText(serverValue));
    }
    dirty.current = false;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !(event.currentTarget instanceof HTMLTextAreaElement)) {
      (event.currentTarget as HTMLElement | null)?.blur();
    }
    if (event.key === 'Escape') {
      dirty.current = false;
      setDraft(toText(serverValue));
      (event.currentTarget as HTMLElement | null)?.blur();
    }
  };

  const hint = allHints[lockKey];

  return {
    value: draft,
    saving,
    hint: hint ? `Updated by ${hint.by}` : null,
    onInput,
    onFocus,
    onBlur,
    onKeyDown,
    commit: (next: unknown) => {
      setDraft(toText(next));
      void save(next);
    },
  };
}

/* ------------------------------------------------- reconnect on wake-up --- */

/**
 * Coming back to a tab whose channel died: catch up now rather than at the end
 * of the backoff.
 *
 * `soft` is the ordinary case — the tab was in the background. `hard` is a
 * page Safari handed back out of its back-forward cache, where the socket and
 * any half-finished request came back with it in name only; that one throws
 * the channel away and builds a new one instead of nudging the old one.
 */
function wakeUp(kind: 'soft' | 'hard'): void {
  if (!currentProjectId) return;
  const projectId = currentProjectId;

  if (kind === 'hard') {
    teardownChannel(); // also clears the backoff, which is what we want here
    void refetch();
    subscribe(projectId);
    return;
  }

  if (store.get().connection === 'live') return;
  void refetch();
  /*
   * One free fast retry per backoff window. Coming back to the tab should not
   * have to sit out the rest of a thirty-second wait, but a tab that is
   * switched to and away from twenty times must not turn a failing channel
   * into a tight loop of connect-and-close.
   */
  const now = Date.now();
  if (now - lastNudge > REJOIN_MAX_DELAY_MS) {
    lastNudge = now;
    rejoinAttempts = 0;
  }
  cancelRejoin();
  scheduleRejoin(projectId);
}

let lastNudge = 0;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (currentProjectId) void refetch();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wakeUp('soft');
  });
  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) wakeUp('hard');
  });
}
