/**
 * ============================================================================
 * THE WORKSPACE STORE
 * ============================================================================
 *
 * One store for the signed-in session. AdminApp opens it once there is a
 * user and closes it on sign-out. Every screen reads through the hooks below
 * and writes through the mutation helpers; nothing else talks to the nine
 * workspace tables directly (Account's own profile edit in auth.ts is the one
 * exception, and the realtime echo brings that back here too).
 *
 * ----------------------------------------------------------------- lifecycle
 *   openWorkspace()              loads roles, profiles (all, inactive too),
 *                                projects, tasks (open, or done in the last
 *                                90 days), every checklist item, closed
 *                                months and the newest 50 activity rows, then
 *                                joins the private channel `workspace`.
 *                                Safe to call repeatedly.
 *   closeWorkspace()             leaves the channel, forgets everything.
 *   retryWorkspace()             what a "Try again" button calls.
 *   refetch()                    re-reads everything and every open time
 *                                window (used after a reconnection).
 *   loadOlderTasks()             adds done tasks older than 90 days.
 *   loadMoreActivity()           the next 50 activity rows.
 *   loadOlderInquiries()         the next 200 inquiries (inquiries.view only;
 *                                the newest 200 load with everything else).
 *
 * ------------------------------------------------------------ status, hooks
 *   useWorkspace()               { status, error, slow, connection }
 *                                status: 'idle' | 'loading' | 'ready' |
 *                                'denied' | 'missing' | 'error'. `missing`
 *                                means the v2 tables are not there yet: say
 *                                the database needs MIGRATION_FILE.
 *   useRoles()                   Role[]          (sort, then name)
 *   useRole(id)                  Role | null
 *   useProfiles()                Profile[]       (name order, inactive too;
 *                                filter on `active` for pickers)
 *   useProfile(id)               Profile | null
 *   useProjects()                Project[]       (sort, then code; archived too)
 *   useProject(id)               Project | null
 *   useTasks()                   Task[]          (sort, then created_at)
 *   useTask(id)                  Task | null
 *   useMyTasks()                 open tasks assigned to me, soonest due first
 *                                (no due date last)
 *   useTaskItems(taskId)         TaskItem[]      (sort, then created_at)
 *   useTaskProgress(taskId)      { done, total, percent, fromChecklist }:
 *                                the checklist fraction when there is a
 *                                checklist, otherwise the manual `progress`
 *   useComments(taskId)          { rows, loading }  (loaded on first ask,
 *                                newest last)
 *   useTaskHistory(taskId)       { rows, loading }  (activity for one task)
 *   useTimeEntries(window)       { entries, loading, error } for a window:
 *                                { from?, to?, userId?, projectId?, taskId? }
 *                                (dates are YYYY-MM-DD, inclusive). Fetched
 *                                once per distinct window, kept fresh from
 *                                realtime. Pass a stable-valued object.
 *   useHoursOnTask(taskId)       number of hours logged against a task
 *   useWeekTotals(monday, userId?)  { days: number[7], total, loading }
 *   useClosedMonths()            HoursMonth[]    (newest first)
 *   useMonthClosed(date)         HoursMonth | null for the month of a date
 *   useActivity()                { rows, done, loading, loadMore }
 *   usePresence()                PresencePeer[]  (everyone here, me included)
 *   useIsHere(userId)            boolean
 *   useInquiries()               Inquiry[]       (newest first; empty unless
 *                                the person has inquiries.view)
 *   useNewInquiryCount()         how many have status 'new' (the rail numeral)
 *   useInvitations()             { rows, loading, error, reload } (loaded on
 *                                first ask; people.manage only, by RLS)
 *   useLiveField(...)            binds one column of one row to one input
 *                                (see the function; LiveField.tsx uses it)
 *   useWorkspaceSlice(select, deps, isEqual?)  any other derived value
 *
 *   Outside components: getWorkspace(), nameOf(userId), profileOf(userId),
 *   isMonthClosed(date), nextTaskSort(), nextItemSort(taskId).
 *
 * ----------------------------------------------------------------- mutations
 *   Every mutation is optimistic: the change shows at once and is rolled back
 *   if the database refuses it, and a refusal is toasted in the server's own
 *   words (pass `{ quiet: true }` to handle the error yourself). All return
 *   `Promise<MutationResult>`: { ok, row?, error? }.
 *
 *   insertRow(table, values)     temp id until the server answers
 *   updateRow(table, id, patch)  only the changed columns are sent
 *   deleteRow(table, id)
 *
 *   createTask(values)           title required; sort = max(sort) + 10
 *   updateTask(id, patch)
 *   deleteTask(id)
 *   assignTask(id, userId | null)
 *   setTaskStatus(id, status)
 *   addItem(taskId, text)        appends to the checklist
 *   toggleItem(itemId, done?)    flips, or sets when `done` is given
 *   addComment(taskId, body)
 *   deleteComment(id)
 *   logHours(values)             { work_date, hours, summary, project_id?,
 *                                task_id?, user_id? (defaults to me) }
 *   updateEntry(id, patch)  deleteEntry(id)
 *   closeMonth(month, note?)     month is YYYY-MM or any date in it
 *   reopenMonth(month)
 *   createInvite(values)         { role_id, email?, note?, expires_at? };
 *                                the row (with its token) comes back in `row`
 *   revokeInvite(id)
 *   setRole(userId, roleId)  setActive(userId, active)
 *   saveRole(values)             insert without `id`, update with one
 *   deleteRole(id)
 *   saveProject(values)          insert without `id`, update with one
 *   setInquiryStatus(id, status)  assignInquiry(id, userId | null)
 *   saveInquiryNotes(id, notes)   linkInquiryTask(id, taskId | null)
 *   setPresence({ where?, task? })   what this person is looking at; `task`
 *                                is the task whose drawer is open (it drives
 *                                the "Sam changed the due date" heads-up)
 *
 * ---------------------------------------------- collaboration, in four parts
 *  1. Optimistic updates, rolled back on refusal.
 *  2. Echo suppression. Every in-flight write records the fields it touched;
 *     when our own realtime echo arrives those fields keep the local value,
 *     so a slow round trip cannot make a field flicker back.
 *  3. Focused-field protection. `useLiveField` locks a field while the cursor
 *     is in it. An incoming change is held as a hint ("Updated by Sam") and
 *     taken on blur if nothing was typed.
 *  4. Heads-up. When someone else changes the task whose drawer you have
 *     open, a toast says who and what.
 *
 * ------------------------------------------------------------------- caveats
 *  - Realtime is filtered by RLS: someone without hours.view_all never
 *    receives another person's time entry, so windows stay correct.
 *  - DELETE events carry the old row only on tables with replica identity
 *    full (tasks, task_items, task_comments, time_entries); the rest are
 *    matched by key alone, which is all a delete needs.
 *  - `hours_months` is keyed by `month`, `activity` by a number; every other
 *    table by a uuid `id`.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { supabase } from './supabase';
import { ACTIVITY_PAGE, CLOCK_SKEW_RETRY_MS, LOAD_DEADLINE_MS, SLOW_LOAD_MS } from './config';
import { withDeadline } from './deadline';
import { observable, sameArray, useObservable } from './observable';
import { getAuth, refreshProfile, resumeSession } from './auth';
import { isClockSkewError, logError, toAppError, type AppError } from './errors';
import { timed } from './timing';
import { toast } from './toasts';
import { monthStart, sumHours, weekBounds, weekStrip } from './hours';
import { OWNER_ROLE_KEY } from './types';
import type {
  ActivityRow,
  HoursMonth,
  Inquiry,
  InquiryStatus,
  Invitation,
  Profile,
  Project,
  Role,
  Task,
  TaskComment,
  TaskItem,
  TaskStatus,
  TimeEntry,
  WorkspaceTable,
} from './types';

/** Where the v2 schema lives, for the "the database needs the migration" notice. */
export const MIGRATION_FILE = 'supabase/migrations/0002_workspace.sql';

/** Done tasks younger than this are loaded at start; older ones on request. */
const DONE_WINDOW_DAYS = 90;

/* ========================================================== state shape === */

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'missing' | 'error';
export type Connection = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface PresencePeer {
  user_id: string;
  name: string;
  /** The route name, or `task:<id>` while a task drawer is open. */
  where: string;
}

type WindowStatus = 'loading' | 'ready' | 'error';

export interface WorkspaceState {
  status: LoadStatus;
  error: AppError | null;
  /** The load has been going a while; not an error yet. */
  slow: boolean;
  connection: Connection;

  roles: Role[];
  profiles: Profile[];
  projects: Project[];
  tasks: Task[];
  task_items: TaskItem[];
  /** Only the threads somebody has opened. */
  task_comments: TaskComment[];
  /** Every entry any open window has fetched, plus what realtime brought. */
  time_entries: TimeEntry[];
  hours_months: HoursMonth[];
  activity: ActivityRow[];
  /** Public form responses; only loaded for someone with inquiries.view. */
  inquiries: Inquiry[];

  olderTasksLoaded: boolean;
  inquiriesDone: boolean;
  activityDone: boolean;
  activityLoading: boolean;
  /** Threads by task id: loading or ready. */
  commentThreads: Record<string, 'loading' | 'ready'>;
  /** Activity for one task, by task id, loaded when its history opens. */
  history: Record<string, ActivityRow[]>;
  historyLoading: Record<string, boolean>;
  /** Time windows by key. */
  windows: Record<string, WindowStatus>;
  windowErrors: Record<string, AppError>;

  invitations: Invitation[];
  invitationsStatus: 'idle' | 'loading' | 'ready' | 'error';
  invitationsError: AppError | null;

  presence: PresencePeer[];
}

const EMPTY: WorkspaceState = {
  status: 'idle',
  error: null,
  slow: false,
  connection: 'idle',
  roles: [],
  profiles: [],
  projects: [],
  tasks: [],
  task_items: [],
  task_comments: [],
  time_entries: [],
  hours_months: [],
  activity: [],
  inquiries: [],
  olderTasksLoaded: false,
  inquiriesDone: true,
  activityDone: false,
  activityLoading: false,
  commentThreads: {},
  history: {},
  historyLoading: {},
  windows: {},
  windowErrors: {},
  invitations: [],
  invitationsStatus: 'idle',
  invitationsError: null,
  presence: [],
};

const store = observable<WorkspaceState>(EMPTY);

export function getWorkspace(): WorkspaceState {
  return store.get();
}

/* ======================================================= table config === */

type AnyRow = Record<string, unknown>;

/** The tables that live in a list in the state, and how each is keyed. */
type ListTable = WorkspaceTable | 'inquiries';

const KEY_OF: Record<ListTable, string> = {
  roles: 'id',
  profiles: 'id',
  projects: 'id',
  tasks: 'id',
  task_items: 'id',
  task_comments: 'id',
  time_entries: 'id',
  hours_months: 'month',
  activity: 'id',
  inquiries: 'id',
};

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const num = (value: unknown) => (typeof value === 'number' ? value : Number(value) || 0);

const SORTERS: Record<ListTable, (a: AnyRow, b: AnyRow) => number> = {
  roles: (a, b) => num(a.sort) - num(b.sort) || text(a.name).localeCompare(text(b.name)),
  profiles: (a, b) =>
    text(a.full_name || a.email).localeCompare(text(b.full_name || b.email), 'en', { sensitivity: 'base' }),
  projects: (a, b) => num(a.sort) - num(b.sort) || text(a.code).localeCompare(text(b.code)),
  tasks: (a, b) => num(a.sort) - num(b.sort) || text(a.created_at).localeCompare(text(b.created_at)),
  task_items: (a, b) => num(a.sort) - num(b.sort) || text(a.created_at).localeCompare(text(b.created_at)),
  task_comments: (a, b) => text(a.created_at).localeCompare(text(b.created_at)),
  time_entries: (a, b) =>
    text(a.work_date).localeCompare(text(b.work_date)) || text(a.created_at).localeCompare(text(b.created_at)),
  hours_months: (a, b) => text(b.month).localeCompare(text(a.month)),
  activity: (a, b) => num(b.id) - num(a.id),
  inquiries: (a, b) => text(b.received_at).localeCompare(text(a.received_at)),
};

function sortRows<T>(table: ListTable, rows: T[]): T[] {
  return [...rows].sort(SORTERS[table] as unknown as (a: T, b: T) => number);
}

function keyOf(table: ListTable, row: AnyRow): string {
  return text(row[KEY_OF[table]]);
}

function listOf(state: WorkspaceState, table: ListTable): AnyRow[] {
  return state[table] as unknown as AnyRow[];
}

function withList(state: WorkspaceState, table: ListTable, rows: AnyRow[]): WorkspaceState {
  return { ...state, [table]: rows } as WorkspaceState;
}

function upsert(table: ListTable, rows: AnyRow[], row: AnyRow): AnyRow[] {
  const key = keyOf(table, row);
  const index = rows.findIndex((item) => keyOf(table, item) === key);
  const next = index === -1 ? [...rows, row] : rows.map((item, at) => (at === index ? row : item));
  return sortRows(table, next);
}

/* ==================================== echo suppression + field locking === */

/** Fields with a write in flight: `<table>:<key>` -> field -> local value. */
const inFlight = new Map<string, Map<string, unknown>>();
/** Fields the cursor is in: `<table>:<key>:<field>`. */
const focusLocks = new Set<string>();

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

function noteInFlight(table: string, id: string, patch: AnyRow): void {
  const key = `${table}:${id}`;
  const fields = inFlight.get(key) ?? new Map<string, unknown>();
  for (const [field, value] of Object.entries(patch)) fields.set(field, value);
  inFlight.set(key, fields);
}

function clearInFlight(table: string, id: string, patch: AnyRow): void {
  const key = `${table}:${id}`;
  const fields = inFlight.get(key);
  if (!fields) return;
  for (const field of Object.keys(patch)) {
    if (Object.is(fields.get(field), patch[field])) fields.delete(field);
  }
  if (fields.size === 0) inFlight.delete(key);
}

/**
 * Merges a row the server sent with the copy on screen, keeping any field
 * that is mid-save (our own echo) or under the cursor right now.
 */
function mergeIncoming(table: string, id: string, local: AnyRow | undefined, incoming: AnyRow, byName: string): AnyRow {
  if (!local) return incoming;
  const pending = inFlight.get(`${table}:${id}`);
  const merged: AnyRow = { ...local, ...incoming };
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
  if (Object.keys(newHints).length) hints.update((current) => ({ ...current, ...newHints }));
  return merged;
}

/* ================================ rows touched while a read is in flight === */

/*
 * A window or thread read replaces the rows it covers with what the server
 * sent. A change that lands while the read is on the wire (a realtime event,
 * our own write) is newer than that snapshot, so the read must not undo it.
 * Touches are only recorded while some read is open, and forgotten when the
 * last one finishes, so the map never grows past one burst.
 */
let touchSeq = 0;
let readsOpen = 0;
const touched = new Map<string, number>();

function touch(table: ListTable, key: string): void {
  if (readsOpen > 0 && key) touched.set(`${table}:${key}`, ++touchSeq);
}

/** Starts a read; the number it returns is what `touchedSince` compares with. */
function beginRead(): number {
  readsOpen += 1;
  return touchSeq;
}

function endRead(): void {
  readsOpen = Math.max(0, readsOpen - 1);
  if (readsOpen === 0) touched.clear();
}

function touchedSince(table: ListTable, key: string, since: number): boolean {
  return (touched.get(`${table}:${key}`) ?? 0) > since;
}

/* PostgREST hands back at most 1,000 rows a request. Reads that can grow past
   that go page by page, in a stable order, until a short page. */
const PAGE_ROWS = 1000;

async function readAll(
  label: string,
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<{ data: AnyRow[] | null; error: unknown }> {
  const rows: AnyRow[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await timed(label, page(from, from + PAGE_ROWS - 1));
    if (error) return { data: null, error };
    const chunk = (data ?? []) as AnyRow[];
    rows.push(...chunk);
    if (chunk.length < PAGE_ROWS) return { data: rows, error: null };
  }
}

/* ============================================================ loading === */

let loadToken = 0;
let opened = false;
/** Whose workspace this is: another person signing in from a second tab gets a fresh one. */
let openedFor: string | null = null;
/** When the last full read landed, so the first channel join can tell if it missed anything. */
let loadedAt = 0;

interface Loaded {
  roles: Role[];
  profiles: Profile[];
  projects: Project[];
  tasks: Task[];
  task_items: TaskItem[];
  hours_months: HoursMonth[];
  activity: ActivityRow[];
}

function doneCutoff(): string {
  return new Date(Date.now() - DONE_WINDOW_DAYS * 86_400_000).toISOString();
}

/** Everything the screens need at once, in one parallel batch. */
async function fetchEverything(): Promise<Loaded> {
  const cutoff = doneCutoff();
  const results = await Promise.all([
    timed('ws.roles', supabase.from('roles').select('*')),
    timed('ws.profiles', supabase.from('profiles').select('*')),
    timed('ws.projects', supabase.from('projects').select('*')),
    // Two reads rather than one `or=`: open work, and work done recently.
    timed('ws.tasks.open', supabase.from('tasks').select('*').neq('status', 'done')),
    timed('ws.tasks.done', supabase.from('tasks').select('*').eq('status', 'done').gt('done_at', cutoff)),
    readAll('ws.items', (from, to) =>
      supabase.from('task_items').select('*').order('sort').order('id').range(from, to)
    ),
    timed('ws.months', supabase.from('hours_months').select('*')),
    timed(
      'ws.activity',
      supabase.from('activity').select('*').order('id', { ascending: false }).limit(ACTIVITY_PAGE)
    ),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const [roles, profiles, projects, open, done, items, months, activity] = results.map(
    (result) => (result.data ?? []) as AnyRow[]
  ) as [AnyRow[], AnyRow[], AnyRow[], AnyRow[], AnyRow[], AnyRow[], AnyRow[], AnyRow[]];

  // A v1 database answers `profiles` and `tasks` with the old columns, and
  // only fails on the new tables. Belt and braces: a profile without a
  // role_id means the migration has not run.
  if (profiles.length && profiles.every((row) => !('role_id' in row))) {
    throw { message: 'column profiles.role_id does not exist', code: '42703' };
  }

  return {
    roles: sortRows('roles', roles) as unknown as Role[],
    profiles: sortRows('profiles', profiles) as unknown as Profile[],
    projects: sortRows('projects', projects) as unknown as Project[],
    tasks: sortRows('tasks', [...open, ...done]) as unknown as Task[],
    task_items: sortRows('task_items', items) as unknown as TaskItem[],
    hours_months: sortRows('hours_months', months) as unknown as HoursMonth[],
    activity: sortRows('activity', activity) as unknown as ActivityRow[],
  };
}

const INQUIRY_PAGE = 200;

/**
 * Whether the person may see the inbox, decided from the rows just loaded.
 * perms.ts reads this store, so the check is repeated here rather than
 * imported, to keep the two modules from importing each other.
 */
function canViewInquiries(roles: Role[], profiles: Profile[]): boolean {
  const me = getAuth().userId;
  const profile = profiles.find((row) => row.id === me);
  const role = roles.find((row) => row.id === profile?.role_id) ?? getAuth().role;
  if (!role) return false;
  return role.key === OWNER_ROLE_KEY || (role.permissions ?? []).includes('inquiries.view');
}

/**
 * The newest inquiries. A failure is logged and left at that: the inbox is a
 * side door, and a database without the table yet must not take the whole
 * workspace down with it.
 */
async function fetchInquiries(before?: string): Promise<{ rows: Inquiry[]; done: boolean } | null> {
  try {
    let query = supabase.from('inquiries').select('*').order('received_at', { ascending: false }).limit(INQUIRY_PAGE);
    if (before) query = query.lt('received_at', before);
    const { data, error } = await timed('ws.inquiries', query);
    if (error) throw error;
    const rows = (data ?? []) as Inquiry[];
    return { rows, done: rows.length < INQUIRY_PAGE };
  } catch (error) {
    logError('fetchInquiries', error);
    return null;
  }
}

async function refreshInquiries(): Promise<void> {
  const state = store.get();
  if (!canViewInquiries(state.roles, state.profiles)) {
    store.update((current) => ({ ...current, inquiries: [], inquiriesDone: true }));
    return;
  }
  const result = await fetchInquiries();
  if (!result) return;
  store.update((current) => ({
    ...current,
    inquiries: sortRows('inquiries', result.rows),
    inquiriesDone: result.done,
  }));
}

export async function loadOlderInquiries(): Promise<void> {
  const state = store.get();
  if (state.inquiriesDone || state.status !== 'ready') return;
  const oldest = state.inquiries[state.inquiries.length - 1]?.received_at;
  const result = await fetchInquiries(oldest);
  if (!result) return;
  store.update((current) => {
    let rows = listOf(current, 'inquiries');
    for (const row of result.rows as unknown as AnyRow[]) rows = upsert('inquiries', rows, row);
    return { ...withList(current, 'inquiries', rows), inquiriesDone: result.done };
  });
}

function statusFor(error: AppError): LoadStatus {
  return error.missingSchema ? 'missing' : error.permission ? 'denied' : 'error';
}

let slowTimer: ReturnType<typeof setTimeout> | null = null;

function startSlowTimer(token: number): void {
  stopSlowTimer();
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
 * Loads the workspace and joins its channel. A no-op once loading or ready
 * for the same person; for a different one the old store is closed first.
 */
export async function openWorkspace(userId: string | null = getAuth().userId): Promise<void> {
  if (opened && openedFor !== userId) closeWorkspace();
  const current = store.get();
  if (opened && (current.status === 'loading' || current.status === 'ready')) return;
  opened = true;
  openedFor = userId;
  const token = ++loadToken;
  teardownChannel();
  store.set({ ...EMPTY, status: 'loading', connection: 'connecting' });
  startSlowTimer(token);
  for (let attempt = 0; ; attempt += 1) {
    try {
      const loaded = await withDeadline(fetchEverything(), LOAD_DEADLINE_MS);
      if (token !== loadToken) return;
      stopSlowTimer();
      store.update((state) => ({
        ...state,
        ...loaded,
        status: 'ready',
        error: null,
        slow: false,
        activityDone: loaded.activity.length < ACTIVITY_PAGE,
      }));
      loadedAt = Date.now();
      void refreshInquiries();
      subscribe();
      return;
    } catch (error) {
      if (token !== loadToken) return;
      if (attempt === 0 && isClockSkewError(error)) {
        // A token refreshed a moment ago can read as "issued at future" to the
        // API for about a second. One quiet retry, before showing anything.
        await new Promise((resolve) => setTimeout(resolve, CLOCK_SKEW_RETRY_MS));
        if (token !== loadToken) return;
        continue;
      }
      stopSlowTimer();
      const appError = toAppError(error);
      logError('openWorkspace', error);
      store.update((state) => ({ ...state, status: statusFor(appError), error: appError, slow: false, connection: 'idle' }));
      return;
    }
  }
}

/** What "Try again" calls: a stalled load usually means a stalled session. */
export async function retryWorkspace(): Promise<void> {
  loadToken += 1;
  opened = false;
  store.set(EMPTY);
  await resumeSession('restore');
  await openWorkspace();
}

/** Re-reads everything plus every open time window. Keeps the screen on failure. */
export async function refetch(): Promise<void> {
  // Only a loaded workspace catches up; a first load still on the wire (an
  // `online` event mid-load, say) is left to finish, or its token would be
  // taken and the skeleton would never go.
  if (!opened || store.get().status !== 'ready') return;
  const token = ++loadToken;
  try {
    const loaded = await withDeadline(fetchEverything(), LOAD_DEADLINE_MS);
    if (token !== loadToken) return;
    // The task list and the activity feed are cut back to their first page,
    // so the "load older" and "load more" flags start over too.
    store.update((state) => ({
      ...state,
      ...loaded,
      status: 'ready',
      error: null,
      olderTasksLoaded: false,
      activityDone: loaded.activity.length < ACTIVITY_PAGE,
    }));
    loadedAt = Date.now();
    void refreshInquiries();
    for (const [key, window] of openWindows) void fetchWindow(key, window.spec, true);
    const threads = Object.keys(store.get().commentThreads);
    for (const taskId of threads) void loadComments(taskId, true);
  } catch (error) {
    if (token !== loadToken) return;
    // A background errand: keep what is on screen, let the banner talk.
    logError('refetch', error);
    store.update((state) => (state.connection === 'live' ? { ...state, connection: 'reconnecting' } : state));
  }
}

export function closeWorkspace(): void {
  loadToken += 1;
  opened = false;
  openedFor = null;
  loadedAt = 0;
  stopSlowTimer();
  teardownChannel();
  touched.clear();
  inFlight.clear();
  focusLocks.clear();
  hints.set({});
  openWindows.clear();
  watching = null;
  presenceMeta = { where: '' };
  store.set(EMPTY);
}

export async function loadOlderTasks(): Promise<void> {
  const state = store.get();
  if (state.olderTasksLoaded || state.status !== 'ready') return;
  try {
    const { data, error } = await supabase.from('tasks').select('*').eq('status', 'done').lte('done_at', doneCutoff());
    if (error) throw error;
    store.update((current) => {
      let rows = listOf(current, 'tasks');
      for (const row of (data ?? []) as AnyRow[]) rows = upsert('tasks', rows, row);
      return { ...withList(current, 'tasks', rows), olderTasksLoaded: true };
    });
  } catch (error) {
    logError('loadOlderTasks', error);
    toast.error(error);
  }
}

export async function loadMoreActivity(): Promise<void> {
  const state = store.get();
  if (state.activityDone || state.activityLoading || state.status !== 'ready') return;
  store.update((current) => ({ ...current, activityLoading: true }));
  const oldest = state.activity[state.activity.length - 1]?.id;
  try {
    let query = supabase.from('activity').select('*').order('id', { ascending: false }).limit(ACTIVITY_PAGE);
    if (oldest !== undefined) query = query.lt('id', oldest);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as AnyRow[];
    store.update((current) => {
      let list = listOf(current, 'activity');
      for (const row of rows) list = upsert('activity', list, row);
      return { ...withList(current, 'activity', list), activityDone: rows.length < ACTIVITY_PAGE, activityLoading: false };
    });
  } catch (error) {
    logError('loadMoreActivity', error);
    store.update((current) => ({ ...current, activityLoading: false, activityDone: true }));
  }
}

/* ------------------------------------------------------ comments, history */

export async function loadComments(taskId: string, force = false): Promise<void> {
  if (!taskId || taskId.startsWith('temp-')) return;
  if (!force && store.get().commentThreads[taskId]) return;
  store.update((state) => ({ ...state, commentThreads: { ...state.commentThreads, [taskId]: state.commentThreads[taskId] ?? 'loading' } }));
  const since = beginRead();
  try {
    const { data, error } = await supabase.from('task_comments').select('*').eq('task_id', taskId);
    if (error) throw error;
    store.update((state) => {
      // Keep what is mid-save, and what changed after the read went out.
      let rows = listOf(state, 'task_comments').filter(
        (row) =>
          row.task_id !== taskId ||
          text(row.id).startsWith('temp-') ||
          touchedSince('task_comments', text(row.id), since)
      );
      for (const row of (data ?? []) as AnyRow[]) {
        if (touchedSince('task_comments', text(row.id), since)) continue;
        rows = upsert('task_comments', rows, row);
      }
      return { ...withList(state, 'task_comments', rows), commentThreads: { ...state.commentThreads, [taskId]: 'ready' } };
    });
  } catch (error) {
    logError('loadComments', error);
    store.update((state) => ({ ...state, commentThreads: { ...state.commentThreads, [taskId]: 'ready' } }));
  } finally {
    endRead();
  }
}

const HISTORY_PAGE = 40;

export async function loadTaskHistory(taskId: string): Promise<void> {
  if (!taskId || taskId.startsWith('temp-')) return;
  const state = store.get();
  if (state.history[taskId] || state.historyLoading[taskId]) return;
  store.update((current) => ({ ...current, historyLoading: { ...current.historyLoading, [taskId]: true } }));
  try {
    const { data, error } = await supabase
      .from('activity')
      .select('*')
      .eq('task_id', taskId)
      .order('id', { ascending: false })
      .limit(HISTORY_PAGE);
    if (error) throw error;
    store.update((current) => ({
      ...current,
      history: { ...current.history, [taskId]: sortRows('activity', (data ?? []) as AnyRow[]) as unknown as ActivityRow[] },
      historyLoading: { ...current.historyLoading, [taskId]: false },
    }));
  } catch (error) {
    logError('loadTaskHistory', error);
    store.update((current) => ({
      ...current,
      history: { ...current.history, [taskId]: [] },
      historyLoading: { ...current.historyLoading, [taskId]: false },
    }));
  }
}

/* -------------------------------------------------------- time windows --- */

export interface TimeWindow {
  /** First day, inclusive, YYYY-MM-DD. */
  from?: string;
  /** Last day, inclusive, YYYY-MM-DD. */
  to?: string;
  userId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
}

function windowKey(spec: TimeWindow): string {
  return [spec.from ?? '', spec.to ?? '', spec.userId ?? '', spec.projectId ?? '', spec.taskId ?? ''].join('|');
}

function inWindow(entry: TimeEntry, spec: TimeWindow): boolean {
  if (spec.from && entry.work_date < spec.from) return false;
  if (spec.to && entry.work_date > spec.to) return false;
  if (spec.userId && entry.user_id !== spec.userId) return false;
  if (spec.projectId && entry.project_id !== spec.projectId) return false;
  if (spec.taskId && entry.task_id !== spec.taskId) return false;
  return true;
}

/** Windows some component is showing right now, with a count of users. */
const openWindows = new Map<string, { spec: TimeWindow; users: number }>();

async function fetchWindow(key: string, spec: TimeWindow, force = false): Promise<void> {
  const state = store.get();
  if (!force && (state.windows[key] === 'ready' || state.windows[key] === 'loading')) return;
  if (state.status !== 'ready' && !force) return;
  store.update((current) => ({ ...current, windows: { ...current.windows, [key]: current.windows[key] === 'ready' ? 'ready' : 'loading' } }));
  const since = beginRead();
  try {
    const { data, error } = await readAll('ws.time_entries', (from, to) => {
      let query = supabase.from('time_entries').select('*');
      if (spec.from) query = query.gte('work_date', spec.from);
      if (spec.to) query = query.lte('work_date', spec.to);
      if (spec.userId) query = query.eq('user_id', spec.userId);
      if (spec.projectId) query = query.eq('project_id', spec.projectId);
      if (spec.taskId) query = query.eq('task_id', spec.taskId);
      return query.order('work_date').order('id').range(from, to);
    });
    if (error) throw error;
    store.update((current) => {
      // Drop what this window used to hold (it may have been deleted while we
      // were away), keep what other windows or a pending write still need,
      // and anything that changed after the read went out.
      let rows = listOf(current, 'time_entries').filter((row) => {
        if (text(row.id).startsWith('temp-')) return true;
        if (!inWindow(row as unknown as TimeEntry, spec)) return true;
        return touchedSince('time_entries', text(row.id), since);
      });
      for (const row of data ?? []) {
        if (touchedSince('time_entries', text(row.id), since)) continue;
        rows = upsert('time_entries', rows, row);
      }
      const windowErrors = { ...current.windowErrors };
      delete windowErrors[key];
      // A window closed while its read was out is not marked ready: nothing
      // refreshes it after a reconnection, so reopening it must read again.
      const windows = { ...current.windows };
      if (openWindows.has(key)) windows[key] = 'ready';
      else delete windows[key];
      return { ...withList(current, 'time_entries', rows), windows, windowErrors };
    });
  } catch (error) {
    logError('fetchWindow', error);
    const appError = toAppError(error);
    store.update((current) => ({
      ...current,
      windows: { ...current.windows, [key]: 'error' },
      windowErrors: { ...current.windowErrors, [key]: appError },
    }));
  } finally {
    endRead();
  }
}

/** Forgets a window nobody is showing, so the next look reads it afresh. */
function forgetWindow(key: string): void {
  store.update((current) => {
    if (!(key in current.windows) && !(key in current.windowErrors)) return current;
    const windows = { ...current.windows };
    const windowErrors = { ...current.windowErrors };
    delete windows[key];
    delete windowErrors[key];
    return { ...current, windows, windowErrors };
  });
}

/* =========================================================== realtime === */

let channel: RealtimeChannel | null = null;
let hadConnection = false;

const WATCHED: WorkspaceTable[] = [
  'roles',
  'profiles',
  'projects',
  'tasks',
  'task_items',
  'task_comments',
  'time_entries',
  'hours_months',
  'activity',
];

/** The channel also carries the inbox; RLS keeps it from those without inquiries.view. */
const CHANNEL_TABLES: ListTable[] = [...WATCHED, 'inquiries'];

export function nameOf(userId: string | null | undefined): string {
  if (!userId) return 'Someone';
  const profile = store.get().profiles.find((row) => row.id === userId);
  return profile?.full_name?.trim() || profile?.email || 'Someone';
}

export function profileOf(userId: string | null | undefined): Profile | null {
  if (!userId) return null;
  return store.get().profiles.find((row) => row.id === userId) ?? null;
}

interface ChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: AnyRow;
  old: AnyRow;
}

function applyChange(table: ListTable, payload: ChangePayload): void {
  const event = payload.eventType;
  const row = payload.new ?? {};
  const old = payload.old ?? {};

  if (table === 'activity') {
    if (event !== 'INSERT') return;
    store.update((state) => {
      if (state.activity.some((item) => item.id === row.id)) return state;
      const next = withList(state, 'activity', upsert('activity', listOf(state, 'activity'), row));
      const taskId = row.task_id ? text(row.task_id) : '';
      const thread = taskId ? state.history[taskId] : undefined;
      if (thread && !thread.some((item) => item.id === row.id)) {
        next.history = { ...state.history, [taskId]: [row as unknown as ActivityRow, ...thread] };
      }
      return next;
    });
    return;
  }

  const key = keyOf(table, event === 'DELETE' ? old : row);
  if (!key) return;
  touch(table, key);

  // A thread nobody has opened is not worth holding.
  if (table === 'task_comments' && event === 'INSERT' && !store.get().commentThreads[text(row.task_id)]) return;

  store.update((state) => {
    const list = listOf(state, table);
    if (event === 'DELETE') {
      if (!list.some((item) => keyOf(table, item) === key)) return state;
      return withList(state, table, list.filter((item) => keyOf(table, item) !== key));
    }
    const local = list.find((item) => keyOf(table, item) === key);
    if (event === 'UPDATE' && local && table === 'tasks') headsUp(key, local, row);
    const merged = mergeIncoming(table, key, local, row, nameOf(text(row.updated_by) || null));
    return withList(state, table, upsert(table, list, merged));
  });
}

/* The words for a changed task column, for the heads-up toast. */
const FIELD_WORDS: Record<string, string> = {
  title: 'the title',
  description: 'the description',
  status: 'the status',
  priority: 'the priority',
  assignee_id: 'who it is assigned to',
  due: 'the due date',
  project_id: 'the project',
  progress: 'the progress',
};

/** The task whose drawer is open here, for the heads-up. */
let watching: string | null = null;

function headsUp(id: string, local: AnyRow, incoming: AnyRow): void {
  if (watching !== id) return;
  const by = incoming.updated_by as string | null | undefined;
  if (!by || by === getAuth().userId) return;
  const changed = Object.keys(FIELD_WORDS).filter(
    (field) => field in incoming && JSON.stringify(local[field]) !== JSON.stringify(incoming[field])
  );
  if (!changed.length) return;
  const words = changed.slice(0, 2).map((field) => FIELD_WORDS[field]);
  toast.info(`${nameOf(by)} changed ${words.join(' and ')}${changed.length > 2 ? ' and more' : ''}.`);
}

function subscribe(): void {
  const auth = getAuth();
  const userId = auth.userId ?? 'anonymous';
  channel = supabase.channel('workspace', {
    config: {
      // A private channel: the policies on realtime.messages let only an
      // active profile join it.
      private: true,
      presence: { key: userId },
      broadcast: { self: false },
    },
  });

  for (const table of CHANNEL_TABLES) {
    channel.on(
      // The SDK's overloads are string-literal based; this is the documented shape.
      'postgres_changes' as never,
      { event: '*', schema: 'public', table } as never,
      ((payload: ChangePayload) => {
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
    const unique = new Map<string, PresencePeer>();
    for (const entries of Object.values(raw)) {
      for (const entry of entries) {
        if (!entry?.user_id) continue;
        // One entry per person, even with two tabs open.
        unique.set(String(entry.user_id), {
          user_id: String(entry.user_id),
          name: String(entry.name ?? ''),
          where: String(entry.where ?? ''),
        });
      }
    }
    store.update((state) => ({ ...state, presence: [...unique.values()] }));
  });

  const joining = channel;
  // Private channels are authorised with the user's JWT. Setting it before
  // joining removes the race between "session restored" and "channel opened".
  void supabase.realtime
    .setAuth()
    .catch((error) => logError('realtime setAuth', error))
    .then(() => {
      if (channel !== joining) return;
      joining.subscribe((status, error) => {
        if (channel !== joining) return;
        onChannelStatus(status, error);
      });
    });
}

/* The SDK rejoins after a dropped socket, but not after the server closes or
   refuses a channel. Those need a fresh channel, tried again with a growing
   pause so a real outage is not hammered. */
let rejoinAttempts = 0;
let rejoinTimer: ReturnType<typeof setTimeout> | null = null;
const REJOIN_MAX_DELAY_MS = 30_000;

function cancelRejoin(): void {
  if (rejoinTimer) clearTimeout(rejoinTimer);
  rejoinTimer = null;
}

function scheduleRejoin(): void {
  if (rejoinTimer) return;
  /*
   * 1s, 2s, 4s ... up to 30s, reset only by an actual SUBSCRIBED. Safari can
   * close a freshly opened socket several times over when a tab comes back;
   * if returning to the tab reset the count, the two would take turns and the
   * portal would open and close sockets as fast as it could.
   */
  const delay = Math.min(REJOIN_MAX_DELAY_MS, 1_000 * 2 ** Math.min(rejoinAttempts, 5));
  rejoinAttempts += 1;
  rejoinTimer = setTimeout(() => {
    rejoinTimer = null;
    if (!opened) return;
    const resumed = hadConnection;
    const attempts = rejoinAttempts;
    teardownChannel();
    hadConnection = resumed;
    rejoinAttempts = attempts;
    subscribe();
  }, delay);
}

/** How long after the load a first join may come before it reads again. */
const FIRST_JOIN_GRACE_MS = 2_000;

function onChannelStatus(status: string, error?: unknown): void {
  if (status === 'SUBSCRIBED') {
    rejoinAttempts = 0;
    cancelRejoin();
    store.update((state) => ({ ...state, connection: 'live' }));
    void trackPresence();
    // Nothing missed while away is replayed, so a reconnection goes and looks.
    // So does a first join that came a while after the load: a change made
    // in between reached neither the read nor the channel.
    if (hadConnection || Date.now() - loadedAt > FIRST_JOIN_GRACE_MS) void refetch();
    hadConnection = true;
    return;
  }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    if (error) logError(`realtime ${status}`, error);
    // The channel policies refuse a person who has been switched off; read
    // the profile again so that shows as a sign-out, not an endless retry.
    if (status === 'CHANNEL_ERROR') void refreshProfile();
    store.update((state) => (state.connection === 'idle' ? state : { ...state, connection: 'reconnecting' }));
    scheduleRejoin();
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
    // Safari may already have torn the socket down; a cleanup must not throw.
    void Promise.resolve(supabase.removeChannel(leaving)).catch((error) => logError('removeChannel', error));
  } catch (error) {
    logError('removeChannel', error);
  }
}

/* ------------------------------------------------------------ presence --- */

let presenceMeta: { where: string } = { where: '' };
/** The route the shell last reported, for when a drawer closes. */
let routeWhere = '';

async function trackPresence(): Promise<void> {
  if (!channel || store.get().connection !== 'live') return;
  const auth = getAuth();
  try {
    await channel.track({
      user_id: auth.userId ?? '',
      name: auth.profile?.full_name?.trim() || auth.email || 'Someone',
      where: presenceMeta.where,
    });
  } catch (error) {
    logError('track presence', error);
  }
}

/**
 * Tells everyone else where you are. The shell sets `where` to the route; a
 * task drawer sets `task` while it is open and `task: null` when it closes.
 */
export function setPresence(meta: { where?: string; task?: string | null }): void {
  if (meta.where !== undefined) routeWhere = meta.where;
  if (meta.task !== undefined) watching = meta.task;
  const where = watching ? `task:${watching}` : routeWhere;
  if (where === presenceMeta.where) return;
  presenceMeta = { where };
  void trackPresence();
}

/* ============================================================ mutations === */

export interface MutationResult<T = AnyRow> {
  ok: boolean;
  row?: T;
  error?: AppError;
}

export interface MutationOptions {
  /** Skip the error toast; the caller shows the error itself. */
  quiet?: boolean;
}

/** Tables a client may write. `activity` is written by triggers only. */
export type WritableTable = Exclude<ListTable, 'activity'> | 'invitations';

function fail(error: unknown, options: MutationOptions, where: string): MutationResult<never> {
  logError(where, error);
  const appError = error instanceof Refusal ? error.appError : toAppError(error);
  if (!options.quiet) toast.bad(appError.message);
  return { ok: false, error: appError };
}

/*
 * Row level security does not refuse an update or delete of a row it hides:
 * PostgREST answers 204 with nothing changed. Writes therefore ask for the
 * keys they touched back, and an empty answer is thrown as one of these.
 */
class Refusal extends Error {
  readonly appError: AppError;
  constructor(message: string) {
    super(message);
    this.appError = { message, permission: true, missingSchema: false, offline: false };
  }
}

const tempId = () => `temp-${Math.random().toString(36).slice(2, 10)}`;

/** Columns the database stamps on audited tables, mirrored optimistically. */
const AUDITED = new Set<WritableTable>(['projects', 'tasks', 'task_items', 'time_entries', 'inquiries']);

function isListTable(table: WritableTable): table is Exclude<WritableTable, 'invitations'> {
  return table !== 'invitations';
}

/** Inserts a row, showing it straight away under a temporary key. */
export async function insertRow<T = AnyRow>(
  table: WritableTable,
  values: AnyRow,
  options: MutationOptions = {}
): Promise<MutationResult<T>> {
  const auth = getAuth();
  const now = new Date().toISOString();
  const listed = isListTable(table);
  const temp: AnyRow = { ...values };
  if (listed && KEY_OF[table] === 'id' && temp.id === undefined) temp.id = tempId();
  temp.created_at ??= now;
  if (AUDITED.has(table)) {
    temp.updated_at = now;
    temp.created_by = auth.userId;
    temp.updated_by = auth.userId;
  }
  if (table === 'task_comments') temp.user_id = auth.userId;
  const tempKey = listed ? keyOf(table, temp) : '';

  if (listed) store.update((state) => withList(state, table, upsert(table, listOf(state, table), temp)));

  try {
    const { data, error } = await supabase.from(table).insert(values).select('*').single();
    if (error) throw error;
    const row = data as AnyRow;
    if (listed) {
      touch(table, keyOf(table, row));
      store.update((state) => {
        const rows = listOf(state, table).filter((item) => keyOf(table, item) !== tempKey);
        return withList(state, table, upsert(table, rows, row));
      });
    } else {
      store.update((state) => ({ ...state, invitations: [row as unknown as Invitation, ...state.invitations] }));
    }
    return { ok: true, row: row as unknown as T };
  } catch (error) {
    if (listed) {
      store.update((state) => withList(state, table, listOf(state, table).filter((item) => keyOf(table, item) !== tempKey)));
    }
    return fail(error, options, `insert ${table}`);
  }
}

function findRow(table: WritableTable, key: string): AnyRow | undefined {
  if (!isListTable(table)) return store.get().invitations.find((row) => row.id === key) as unknown as AnyRow | undefined;
  return listOf(store.get(), table).find((row) => keyOf(table, row) === key);
}

function replaceRow(table: WritableTable, key: string, patch: AnyRow): void {
  store.update((state) => {
    if (!isListTable(table)) {
      return {
        ...state,
        invitations: state.invitations.map((row) => (row.id === key ? ({ ...row, ...patch } as Invitation) : row)),
      };
    }
    const rows = listOf(state, table).map((row) => (keyOf(table, row) === key ? { ...row, ...patch } : row));
    return withList(state, table, sortRows(table, rows));
  });
}

/** Updates only the columns in `patch`, optimistically, rolling back on error. */
export async function updateRow(
  table: WritableTable,
  id: string,
  patch: AnyRow,
  options: MutationOptions = {}
): Promise<MutationResult> {
  if (!id || id.startsWith('temp-')) {
    return fail({ message: 'That is still being saved. Try again in a moment.' }, options, `update ${table}`);
  }
  const before = findRow(table, id);
  if (!before) return fail({ message: 'That is gone. Reload to see the latest.' }, options, `update ${table}`);

  const rollback: AnyRow = {};
  for (const field of Object.keys(patch)) rollback[field] = before[field];
  const optimistic: AnyRow = { ...patch };
  if (AUDITED.has(table)) {
    optimistic.updated_by = getAuth().userId;
    optimistic.updated_at = new Date().toISOString();
    rollback.updated_by = before.updated_by;
    rollback.updated_at = before.updated_at;
  }

  noteInFlight(table, id, patch);
  if (isListTable(table)) touch(table, id);
  replaceRow(table, id, optimistic);
  try {
    const keyColumn = isListTable(table) ? KEY_OF[table] : 'id';
    const { data, error } = await supabase.from(table).update(patch).eq(keyColumn, id).select(keyColumn);
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) throw new Refusal('You cannot change this.');
    // Give the realtime echo a moment to arrive before releasing the fields.
    setTimeout(() => clearInFlight(table, id, patch), 1500);
    return { ok: true };
  } catch (error) {
    // Released at once: a refused value must not come back with the next echo.
    clearInFlight(table, id, patch);
    replaceRow(table, id, rollback);
    return fail(error, options, `update ${table}`);
  }
}

export async function deleteRow(table: WritableTable, id: string, options: MutationOptions = {}): Promise<MutationResult> {
  if (!id || id.startsWith('temp-')) {
    return fail({ message: 'That is still being saved. Try again in a moment.' }, options, `delete ${table}`);
  }
  const before = findRow(table, id);
  if (isListTable(table)) {
    touch(table, id);
    store.update((state) => withList(state, table, listOf(state, table).filter((row) => keyOf(table, row) !== id)));
  } else {
    store.update((state) => ({ ...state, invitations: state.invitations.filter((row) => row.id !== id) }));
  }
  try {
    const keyColumn = isListTable(table) ? KEY_OF[table] : 'id';
    const { data, error } = await supabase.from(table).delete().eq(keyColumn, id).select(keyColumn);
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) throw new Refusal('You cannot delete this.');
    return { ok: true };
  } catch (error) {
    if (before) {
      if (isListTable(table)) {
        store.update((state) => withList(state, table, upsert(table, listOf(state, table), before)));
      } else {
        store.update((state) => ({ ...state, invitations: [before as unknown as Invitation, ...state.invitations] }));
      }
    }
    return fail(error, options, `delete ${table}`);
  }
}

/* ------------------------------------------------------- typed helpers --- */

/** Board and list order: always max + 10, never a timestamp. */
export function nextTaskSort(): number {
  return store.get().tasks.reduce((max, task) => Math.max(max, task.sort ?? 0), 0) + 10;
}

export function nextItemSort(taskId: string): number {
  return (
    store
      .get()
      .task_items.filter((item) => item.task_id === taskId)
      .reduce((max, item) => Math.max(max, item.sort ?? 0), 0) + 10
  );
}

export type NewTask = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'done_at'>> & {
  title: string;
};

export function createTask(values: NewTask, options?: MutationOptions): Promise<MutationResult<Task>> {
  const title = values.title.trim();
  if (!title) return Promise.resolve(fail({ message: 'A task needs a title.' }, options ?? {}, 'createTask'));
  return insertRow<Task>(
    'tasks',
    {
      status: 'todo',
      priority: 'normal',
      description: '',
      progress: 0,
      project_id: null,
      assignee_id: null,
      due: null,
      ...values,
      title,
      sort: values.sort ?? nextTaskSort(),
    },
    options
  );
}

export function updateTask(id: string, patch: Partial<Task>, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('tasks', id, patch as AnyRow, options);
}

export function deleteTask(id: string, options?: MutationOptions): Promise<MutationResult> {
  return deleteRow('tasks', id, options);
}

export function assignTask(id: string, userId: string | null, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('tasks', id, { assignee_id: userId }, options);
}

export function setTaskStatus(id: string, status: TaskStatus, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('tasks', id, { status }, options);
}

export function addItem(taskId: string, itemText: string, options?: MutationOptions): Promise<MutationResult<TaskItem>> {
  const value = itemText.trim();
  if (!value) return Promise.resolve(fail({ message: 'Write the step first.' }, options ?? {}, 'addItem'));
  return insertRow<TaskItem>('task_items', { task_id: taskId, text: value, done: false, sort: nextItemSort(taskId) }, options);
}

export function toggleItem(itemId: string, done?: boolean, options?: MutationOptions): Promise<MutationResult> {
  const item = store.get().task_items.find((row) => row.id === itemId);
  const next = done ?? !item?.done;
  return updateRow('task_items', itemId, { done: next }, options);
}

export function addComment(taskId: string, body: string, options?: MutationOptions): Promise<MutationResult<TaskComment>> {
  const value = body.trim();
  if (!value) return Promise.resolve(fail({ message: 'Write something first.' }, options ?? {}, 'addComment'));
  // Make sure the thread is held, or our own echo would be thrown away.
  if (!store.get().commentThreads[taskId]) {
    store.update((state) => ({ ...state, commentThreads: { ...state.commentThreads, [taskId]: 'ready' } }));
  }
  // user_id is stamped by the database; it is never trusted from here.
  return insertRow<TaskComment>('task_comments', { task_id: taskId, body: value }, options);
}

export function deleteComment(id: string, options?: MutationOptions): Promise<MutationResult> {
  return deleteRow('task_comments', id, options);
}

export interface NewEntry {
  work_date: string;
  hours: number;
  summary: string;
  project_id?: string | null;
  task_id?: string | null;
  /** Defaults to the signed-in person. Someone else needs hours.edit_any. */
  user_id?: string;
}

export function logHours(values: NewEntry, options?: MutationOptions): Promise<MutationResult<TimeEntry>> {
  const summary = values.summary.trim();
  if (!summary) return Promise.resolve(fail({ message: 'Say what you worked on.' }, options ?? {}, 'logHours'));
  return insertRow<TimeEntry>(
    'time_entries',
    {
      work_date: values.work_date,
      hours: values.hours,
      summary,
      project_id: values.project_id ?? null,
      task_id: values.task_id ?? null,
      user_id: values.user_id ?? getAuth().userId,
    },
    options
  );
}

export function updateEntry(id: string, patch: Partial<TimeEntry>, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('time_entries', id, patch as AnyRow, options);
}

export function deleteEntry(id: string, options?: MutationOptions): Promise<MutationResult> {
  return deleteRow('time_entries', id, options);
}

export function closeMonth(month: string, note = '', options?: MutationOptions): Promise<MutationResult<HoursMonth>> {
  return insertRow<HoursMonth>(
    'hours_months',
    { month: monthStart(month), note: note.trim(), closed_by: getAuth().userId },
    options
  );
}

export function reopenMonth(month: string, options?: MutationOptions): Promise<MutationResult> {
  return deleteRow('hours_months', monthStart(month), options);
}

export interface NewInvite {
  role_id: string;
  email?: string | null;
  note?: string | null;
  /** ISO timestamp; the database defaults to 14 days from now. */
  expires_at?: string | null;
}

export function createInvite(values: NewInvite, options?: MutationOptions): Promise<MutationResult<Invitation>> {
  const row: AnyRow = {
    role_id: values.role_id,
    email: values.email?.trim() || null,
    note: values.note?.trim() || null,
    invited_by: getAuth().userId,
  };
  if (values.expires_at) row.expires_at = values.expires_at;
  return insertRow<Invitation>('invitations', row, options);
}

export function revokeInvite(id: string, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('invitations', id, { revoked_at: new Date().toISOString() }, options);
}

export async function loadInvitations(force = false): Promise<void> {
  const state = store.get();
  if (!force && (state.invitationsStatus === 'loading' || state.invitationsStatus === 'ready')) return;
  store.update((current) => ({ ...current, invitationsStatus: 'loading', invitationsError: null }));
  try {
    const { data, error } = await supabase.from('invitations').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    store.update((current) => ({ ...current, invitations: (data ?? []) as Invitation[], invitationsStatus: 'ready' }));
  } catch (error) {
    logError('loadInvitations', error);
    store.update((current) => ({ ...current, invitationsStatus: 'error', invitationsError: toAppError(error) }));
  }
}

export function setRole(userId: string, roleId: string, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('profiles', userId, { role_id: roleId }, options);
}

export function setActive(userId: string, active: boolean, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('profiles', userId, { active }, options);
}

export type RoleInput = Partial<Pick<Role, 'key' | 'name' | 'description' | 'permissions' | 'sort'>> & { id?: string };

export function saveRole(values: RoleInput, options?: MutationOptions): Promise<MutationResult> {
  const { id, ...rest } = values;
  if (id) return updateRow('roles', id, rest as AnyRow, options);
  return insertRow('roles', { description: '', permissions: [], sort: 100, ...rest }, options);
}

export function deleteRole(id: string, options?: MutationOptions): Promise<MutationResult> {
  return deleteRow('roles', id, options);
}

export type ProjectInput = Partial<Pick<Project, 'name' | 'code' | 'track' | 'summary' | 'status' | 'lead_id' | 'sort'>> & {
  id?: string;
};

export function saveProject(values: ProjectInput, options?: MutationOptions): Promise<MutationResult> {
  const { id, ...rest } = values;
  if (rest.code) rest.code = rest.code.trim().toUpperCase();
  if (id) return updateRow('projects', id, rest as AnyRow, options);
  return insertRow('projects', { summary: '', status: 'active', track: 'org', sort: 100, lead_id: null, ...rest }, options);
}

export function setInquiryStatus(id: string, status: InquiryStatus, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('inquiries', id, { status }, options);
}

export function assignInquiry(id: string, userId: string | null, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('inquiries', id, { assignee_id: userId }, options);
}

export function saveInquiryNotes(id: string, notes: string, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('inquiries', id, { notes }, options);
}

export function linkInquiryTask(id: string, taskId: string | null, options?: MutationOptions): Promise<MutationResult> {
  return updateRow('inquiries', id, { task_id: taskId }, options);
}

/* ============================================================== hooks === */

/**
 * A derived slice of the store that re-renders only when it changes. `deps`
 * are the values `select` closes over (an id, a date); `isEqual` decides what
 * "changed" means (pass `sameArray` for a filtered list).
 */
export function useWorkspaceSlice<S>(
  select: (state: WorkspaceState) => S,
  deps: readonly unknown[],
  isEqual: (a: S, b: S) => boolean = Object.is
): S {
  const [, setTick] = useState(0);
  const selectRef = useRef(select);
  selectRef.current = select;
  const equalRef = useRef(isEqual);
  equalRef.current = isEqual;
  const held = useRef<{ value: S; deps: readonly unknown[] } | null>(null);

  const fresh = select(store.get());
  if (!held.current || !sameArray(held.current.deps, deps) || !isEqual(held.current.value, fresh)) {
    held.current = { value: fresh, deps };
  }

  useEffect(
    () =>
      store.subscribe((state) => {
        const next = selectRef.current(state);
        if (!held.current || !equalRef.current(held.current.value, next)) setTick((tick) => tick + 1);
      }),
    []
  );

  return held.current.value;
}

export interface WorkspaceView {
  status: LoadStatus;
  error: AppError | null;
  slow: boolean;
  connection: Connection;
}

export function useWorkspace(): WorkspaceView {
  return useWorkspaceSlice(
    (state) => ({ status: state.status, error: state.error, slow: state.slow, connection: state.connection }),
    [],
    (a, b) => a.status === b.status && a.error === b.error && a.slow === b.slow && a.connection === b.connection
  );
}

export const useRoles = (): Role[] => useWorkspaceSlice((state) => state.roles, []);
export const useProfiles = (): Profile[] => useWorkspaceSlice((state) => state.profiles, []);
export const useProjects = (): Project[] => useWorkspaceSlice((state) => state.projects, []);
export const useTasks = (): Task[] => useWorkspaceSlice((state) => state.tasks, []);
export const useClosedMonths = (): HoursMonth[] => useWorkspaceSlice((state) => state.hours_months, []);

export function useRole(id: string | null | undefined): Role | null {
  return useWorkspaceSlice((state) => (id ? (state.roles.find((row) => row.id === id) ?? null) : null), [id]);
}

export function useProfile(id: string | null | undefined): Profile | null {
  return useWorkspaceSlice((state) => (id ? (state.profiles.find((row) => row.id === id) ?? null) : null), [id]);
}

export function useProject(id: string | null | undefined): Project | null {
  return useWorkspaceSlice((state) => (id ? (state.projects.find((row) => row.id === id) ?? null) : null), [id]);
}

export function useTask(id: string | null | undefined): Task | null {
  return useWorkspaceSlice((state) => (id ? (state.tasks.find((row) => row.id === id) ?? null) : null), [id]);
}

/** Soonest due first; tasks with no due date after every dated one. */
export function byDue(a: Task, b: Task): number {
  if (a.due && b.due) return a.due.localeCompare(b.due) || a.sort - b.sort;
  if (a.due) return -1;
  if (b.due) return 1;
  return a.sort - b.sort;
}

export function useMyTasks(): Task[] {
  const me = getAuth().userId;
  return useWorkspaceSlice(
    (state) => state.tasks.filter((task) => task.assignee_id === me && task.status !== 'done').sort(byDue),
    [me],
    sameArray
  );
}

export function useTaskItems(taskId: string | null | undefined): TaskItem[] {
  return useWorkspaceSlice(
    (state) => (taskId ? state.task_items.filter((item) => item.task_id === taskId) : []),
    [taskId],
    sameArray
  );
}

export interface TaskProgress {
  done: number;
  total: number;
  /** 0 to 100. */
  percent: number;
  /** True when the numbers come from the checklist rather than `progress`. */
  fromChecklist: boolean;
}

export function progressOf(task: Task | null | undefined, items: readonly TaskItem[]): TaskProgress {
  if (items.length) {
    const done = items.filter((item) => item.done).length;
    return { done, total: items.length, percent: Math.round((done / items.length) * 100), fromChecklist: true };
  }
  const percent = task?.status === 'done' ? 100 : Math.max(0, Math.min(100, task?.progress ?? 0));
  return { done: 0, total: 0, percent, fromChecklist: false };
}

export function useTaskProgress(taskId: string | null | undefined): TaskProgress {
  const task = useTask(taskId);
  const items = useTaskItems(taskId);
  return progressOf(task, items);
}

const NO_COMMENTS: TaskComment[] = [];

export function useComments(taskId: string | null | undefined): { rows: TaskComment[]; loading: boolean } {
  useEffect(() => {
    if (taskId) void loadComments(taskId);
  }, [taskId]);
  const rows = useWorkspaceSlice(
    (state) => (taskId ? state.task_comments.filter((row) => row.task_id === taskId) : NO_COMMENTS),
    [taskId],
    sameArray
  );
  const loading = useWorkspaceSlice((state) => Boolean(taskId && state.commentThreads[taskId] === 'loading'), [taskId]);
  return { rows, loading };
}

const NO_HISTORY: ActivityRow[] = [];

export function useTaskHistory(taskId: string | null | undefined): { rows: ActivityRow[]; loading: boolean } {
  useEffect(() => {
    if (taskId) void loadTaskHistory(taskId);
  }, [taskId]);
  const rows = useWorkspaceSlice((state) => (taskId ? (state.history[taskId] ?? NO_HISTORY) : NO_HISTORY), [taskId]);
  const loading = useWorkspaceSlice((state) => Boolean(taskId && state.historyLoading[taskId]), [taskId]);
  return { rows, loading };
}

export interface TimeEntriesView {
  entries: TimeEntry[];
  loading: boolean;
  error: AppError | null;
}

const NO_ENTRIES: TimeEntry[] = [];

/** `enabled: false` holds no window and reads nothing (a task with no id yet). */
export function useTimeEntries(spec: TimeWindow, enabled = true): TimeEntriesView {
  const key = windowKey(spec);
  const ready = useWorkspaceSlice((state) => state.status === 'ready', []);

  useEffect(() => {
    if (!ready || !enabled) return undefined;
    const held = openWindows.get(key);
    if (held) held.users += 1;
    else openWindows.set(key, { spec: { ...spec }, users: 1 });
    void fetchWindow(key, spec);
    return () => {
      const entry = openWindows.get(key);
      if (!entry) return;
      entry.users -= 1;
      if (entry.users <= 0) {
        openWindows.delete(key);
        forgetWindow(key);
      }
    };
    // The key is the spec, value for value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, enabled]);

  const entries = useWorkspaceSlice(
    (state) => (enabled ? state.time_entries.filter((entry) => inWindow(entry, spec)) : NO_ENTRIES),
    [key, enabled],
    sameArray
  );
  const status = useWorkspaceSlice((state) => state.windows[key], [key]);
  const error = useWorkspaceSlice((state) => state.windowErrors[key] ?? null, [key]);
  if (!enabled) return { entries, loading: false, error: null };
  return { entries, loading: !status || status === 'loading', error };
}

export function useHoursOnTask(taskId: string | null | undefined): number {
  const usable = Boolean(taskId && !taskId.startsWith('temp-'));
  const { entries } = useTimeEntries({ taskId: usable ? taskId : null }, usable);
  return sumHours(entries);
}

export interface WeekTotals {
  /** Monday to Sunday. */
  days: number[];
  total: number;
  loading: boolean;
}

export function useWeekTotals(monday: string, userId?: string | null): WeekTotals {
  const bounds = weekBounds(monday);
  const { entries, loading } = useTimeEntries({ from: bounds.from, to: bounds.to, userId: userId ?? undefined });
  const days = weekStrip(entries, bounds.from);
  return { days, total: sumHours(entries), loading };
}

export function isMonthClosed(date: string): boolean {
  const key = monthStart(date);
  return store.get().hours_months.some((row) => row.month.slice(0, 10) === key);
}

export function useMonthClosed(date: string | null | undefined): HoursMonth | null {
  const key = date ? monthStart(date) : '';
  return useWorkspaceSlice((state) => (key ? (state.hours_months.find((row) => row.month.slice(0, 10) === key) ?? null) : null), [key]);
}

export interface ActivityView {
  rows: ActivityRow[];
  done: boolean;
  loading: boolean;
  loadMore: () => void;
}

export function useActivity(): ActivityView {
  const rows = useWorkspaceSlice((state) => state.activity, []);
  const done = useWorkspaceSlice((state) => state.activityDone, []);
  const loading = useWorkspaceSlice((state) => state.activityLoading, []);
  return { rows, done, loading, loadMore: () => void loadMoreActivity() };
}

export function usePresence(): PresencePeer[] {
  return useWorkspaceSlice((state) => state.presence, []);
}

export function useIsHere(userId: string | null | undefined): boolean {
  return useWorkspaceSlice((state) => Boolean(userId && state.presence.some((peer) => peer.user_id === userId)), [userId]);
}

export function useInquiries(): Inquiry[] {
  return useWorkspaceSlice((state) => state.inquiries, []);
}

export function useNewInquiryCount(): number {
  return useWorkspaceSlice((state) => state.inquiries.filter((row) => row.status === 'new').length, []);
}

export function useInvitations(): { rows: Invitation[]; loading: boolean; error: AppError | null; reload: () => void } {
  const ready = useWorkspaceSlice((state) => state.status === 'ready', []);
  useEffect(() => {
    if (ready) void loadInvitations();
  }, [ready]);
  const rows = useWorkspaceSlice((state) => state.invitations, []);
  const status = useWorkspaceSlice((state) => state.invitationsStatus, []);
  const error = useWorkspaceSlice((state) => state.invitationsError, []);
  return { rows, loading: status === 'idle' || status === 'loading', error, reload: () => void loadInvitations(true) };
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
  value: string;
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
 * Binds one column of one row to one input. Text saves on blur and on Enter;
 * `immediate` saves on change. While the input has focus the store will not
 * overwrite it: an incoming change is held as a hint and applied on blur if
 * the person did not type anything of their own. Errors are not toasted here
 * (the caller's `onError` decides), so a field can show its own message.
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
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (focused.current) return;
    setDraft(toText(serverValue));
    dirty.current = false;
  }, [serverValue]);

  const save = useCallback(
    async (raw: unknown) => {
      const next = parse ? parse(String(raw ?? '')) : raw;
      const same = equals ? equals(next, serverValue) : Object.is(next, serverValue);
      if (same) return;
      setSaving(true);
      const result = await updateRow(table, id, { [field]: next }, { quiet: true });
      setSaving(false);
      if (result.ok) optionsRef.current.onSaved?.();
      else if (result.error) optionsRef.current.onError?.(result.error);
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
    if (dirty.current) void save(draft);
    else if (hint) setDraft(toText(hint.value));
    else setDraft(toText(serverValue));
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

let lastNudge = 0;

/**
 * Coming back to a tab whose channel died: catch up now rather than at the
 * end of the backoff. `hard` is a page Safari handed back from its
 * back-forward cache, whose socket came back in name only.
 */
function wakeUp(kind: 'soft' | 'hard'): void {
  if (!opened || store.get().status !== 'ready') return;
  if (kind === 'hard') {
    teardownChannel();
    void refetch();
    subscribe();
    return;
  }
  if (store.get().connection === 'live') return;
  void refetch();
  // One free fast retry per backoff window, so flipping tabs cannot turn a
  // failing channel into a tight loop.
  const now = Date.now();
  if (now - lastNudge > REJOIN_MAX_DELAY_MS) {
    lastNudge = now;
    rejoinAttempts = 0;
  }
  cancelRejoin();
  scheduleRejoin();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (opened) void refetch();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wakeUp('soft');
  });
  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) wakeUp('hard');
  });
}

