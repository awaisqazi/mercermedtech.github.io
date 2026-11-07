/**
 * The demo's in-memory database: runs the queries `client.ts` records against
 * the fixture, writes the changes back into it, does the few things the real
 * triggers do (audit stamps, `done_at`, checklist progress, the closed-month
 * and 24-hours-a-day refusals), logs activity in the same shapes the
 * database trigger writes, and replays every change to any open realtime
 * channel. A reload starts again from the fixture.
 *
 * Reads are narrowed the way row level security narrows them for the demo
 * persona: without hours.view_all you see only your own hours, without
 * inquiries.view no inbox, without people.manage no invitations. That is
 * enough to review the permission gating with `#/demo?as=member`; it is not a
 * copy of the policies, which live in the migration.
 *
 * Two colleagues are "here", so presence shows, and the first time you open
 * a task one of them changes its due date a few seconds later, so the
 * "someone else changed this" toast can be seen too.
 */
import { buildFixture, PAT, ROBIN, SAM } from './fixture';
import { DEMO_PERSONA } from './mode';
import type { DemoFilter, DemoQuery } from './types';

type Row = Record<string, unknown>;

const db = buildFixture() as unknown as Record<string, Row[]>;

/** Who the demo is signed in as. */
const ME = DEMO_PERSONA === 'member' ? SAM : DEMO_PERSONA === 'finance' ? ROBIN : PAT;

/** Pretend to be a network: short enough to feel instant, long enough to be async. */
const LATENCY_MS = 60;
const wait = (ms = LATENCY_MS) => new Promise((done) => window.setTimeout(done, ms));

let nextActivityId = 6000;
let nextId = 1;
const newId = (table: string) => `demo-${table}-new-${nextId++}`;
const nowIso = () => new Date().toISOString();

/* --------------------------------------------------------------- auth --- */

function myProfile(): Row | undefined {
  return (db.profiles ?? []).find((row) => row.id === ME);
}

function myPermissions(): string[] {
  const role = (db.roles ?? []).find((row) => row.id === myProfile()?.role_id);
  if (!role) return [];
  if (role.key === 'owner') return ['*'];
  return (role.permissions as string[]) ?? [];
}

const allowed = (key: string) => {
  const permissions = myPermissions();
  return permissions.includes('*') || permissions.includes(key);
};

export function demoSession() {
  const now = Math.floor(Date.now() / 1000);
  const profile = myProfile();
  return {
    access_token: 'demo',
    refresh_token: 'demo',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: ME,
      aud: 'authenticated',
      role: 'authenticated',
      email: String(profile?.email ?? 'demo@example.invalid'),
      app_metadata: {},
      user_metadata: { full_name: String(profile?.full_name ?? 'Demo') },
      created_at: nowIso(),
    },
  };
}

export async function rpc(name: string, args?: Record<string, unknown>) {
  await wait();
  if (name === 'invite_preview') {
    const invite = (db.invitations ?? []).find(
      (row) => row.token === args?.p_token && !row.accepted_at && !row.revoked_at
    );
    if (!invite) return { data: { valid: false }, error: null, status: 200 };
    const role = (db.roles ?? []).find((row) => row.id === invite.role_id);
    return {
      data: {
        valid: true,
        email: invite.email ?? null,
        role_name: role?.name ?? null,
        inviter: nameOf(invite.invited_by),
        expires_at: invite.expires_at,
      },
      error: null,
      status: 200,
    };
  }
  return { data: nowIso(), error: null, status: 200 };
}

/* ------------------------------------------------------------ queries --- */

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function matches(row: Row, filter: DemoFilter): boolean {
  const value = row[filter.column];
  switch (filter.op) {
    case 'eq':
      return String(value) === String(filter.value);
    case 'neq':
      return String(value) !== String(filter.value);
    case 'in':
      return (filter.value as unknown[]).map(String).includes(String(value));
    case 'notin':
      return !(filter.value as unknown[]).map(String).includes(String(value));
    case 'lt':
      return compare(value, filter.value) < 0;
    case 'lte':
      return compare(value, filter.value) <= 0;
    case 'gt':
      return compare(value, filter.value) > 0;
    case 'gte':
      return compare(value, filter.value) >= 0;
    case 'is':
      return filter.value === null ? value === null || value === undefined : value === filter.value;
    case 'notis':
      return filter.value === null ? value !== null && value !== undefined : value !== filter.value;
    default:
      return true;
  }
}

/** What the demo persona may read, mirroring the shape of the real policies. */
function visible(table: string, row: Row): boolean {
  if (table === 'time_entries') return row.user_id === ME || allowed('hours.view_all');
  if (table === 'inquiries') return allowed('inquiries.view');
  if (table === 'invitations') return allowed('people.manage');
  if (table === 'activity' && row.subject_id && row.subject_id !== ME) return allowed('hours.view_all');
  return true;
}

function pick(row: Row, columns: string): Row {
  if (!columns || columns.trim() === '*') return { ...row };
  const out: Row = {};
  for (const column of columns.split(',').map((entry) => entry.trim())) {
    if (column) out[column] = row[column];
  }
  return out;
}

function result(query: DemoQuery, rows: Row[]) {
  const copy = rows.map((row) => pick(row, query.action === 'select' ? query.columns : '*'));
  if (query.single) {
    if (!copy.length && query.single === 'single') {
      return { data: null, error: { message: 'No rows found', code: 'PGRST116' }, status: 406 };
    }
    return { data: copy[0] ?? null, error: null, status: 200 };
  }
  return { data: copy, error: null, count: copy.length, status: 200 };
}

/** A refusal shaped like the one Postgres raises from a trigger. */
class Refused extends Error {
  code: string;
  constructor(message: string, code = 'P0001') {
    super(message);
    this.code = code;
  }
}

export async function execute(query: DemoQuery) {
  await wait();
  try {
    return run(query);
  } catch (error) {
    if (error instanceof Refused) {
      return { data: null, error: { message: error.message, code: error.code }, status: 400 };
    }
    throw error;
  }
}

function run(query: DemoQuery) {
  const table = db[query.table] ?? (db[query.table] = []);
  const hits = () =>
    table.filter((row) => visible(query.table, row) && query.filters.every((filter) => matches(row, filter)));

  switch (query.action) {
    case 'select': {
      let rows = hits();
      for (const order of [...query.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const sign = order.ascending ? 1 : -1;
          return sign * compare(a[order.column], b[order.column]);
        });
      }
      if (query.limit !== null) rows = rows.slice(0, query.limit);
      return result(query, rows);
    }

    case 'insert': {
      const list = Array.isArray(query.values) ? (query.values as Row[]) : [query.values as Row];
      const made = list.map((values) => insert(query.table, values));
      return query.returning ? result(query, made) : { data: null, error: null, status: 201 };
    }

    case 'upsert': {
      const list = Array.isArray(query.values) ? (query.values as Row[]) : [query.values as Row];
      const keys = (query.onConflict ?? 'id').split(',').map((key) => key.trim());
      const made = list.map((values) => {
        const existing = table.find((row) => keys.every((key) => String(row[key]) === String(values[key])));
        return existing ? update(query.table, existing, values) : insert(query.table, values);
      });
      return query.returning ? result(query, made) : { data: null, error: null, status: 201 };
    }

    case 'update': {
      const made = hits().map((row) => update(query.table, row, query.values as Row));
      return query.returning ? result(query, made) : { data: null, error: null, status: 204 };
    }

    case 'delete': {
      const gone = hits();
      for (const row of gone) guard(query.table, row, null);
      db[query.table] = table.filter((row) => !gone.includes(row));
      for (const row of gone) {
        logActivity(query.table, query.table === 'hours_months' ? 'reopened' : 'deleted', row, null);
        emit(query.table, 'DELETE', {}, { ...row });
        if (query.table === 'task_items') syncProgress(String(row.task_id));
      }
      return { data: null, error: null, status: 204 };
    }

    default:
      return { data: null, error: { message: 'Not supported in the demo.' }, status: 400 };
  }
}

/* ------------------------------------------------------------ triggers --- */

const AUDITED = new Set(['projects', 'tasks', 'task_items', 'time_entries']);

const monthOf = (date: unknown) => `${String(date).slice(0, 7)}-01`;
const monthClosed = (date: unknown) => (db.hours_months ?? []).some((row) => String(row.month).slice(0, 10) === monthOf(date));

/** The refusals the real triggers make, for the cases a reviewer will try. */
function guard(tableName: string, before: Row | null, after: Row | null): void {
  if (tableName !== 'time_entries') return;
  for (const row of [before, after]) {
    if (row && monthClosed(row.work_date) && !allowed('hours.close')) {
      throw new Refused('That month is closed. Ask finance to reopen it if an entry needs to change.');
    }
  }
  if (after) {
    const total = (db.time_entries ?? [])
      .filter((row) => row !== before && row.user_id === after.user_id && row.work_date === after.work_date)
      .reduce((sum, row) => sum + Number(row.hours), 0);
    if (total + Number(after.hours) > 24) {
      throw new Refused('That would be more than 24 hours on one day.');
    }
  }
}

function defaultsFor(tableName: string): Row {
  switch (tableName) {
    case 'tasks':
      return {
        project_id: null,
        description: '',
        status: 'todo',
        priority: 'normal',
        assignee_id: null,
        due: null,
        progress: 0,
        done_at: null,
        sort: 0,
      };
    case 'task_items':
      return { done: false, sort: 0 };
    case 'projects':
      return { summary: '', status: 'active', track: 'org', lead_id: null, sort: 100 };
    case 'roles':
      return { description: '', permissions: [], is_system: false, sort: 100, key: `role_${nextId}` };
    case 'invitations':
      return {
        token: `demo-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`,
        email: null,
        note: null,
        expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        accepted_at: null,
        accepted_by: null,
        revoked_at: null,
      };
    case 'hours_months':
      return { note: '', closed_at: nowIso() };
    default:
      return {};
  }
}

function insert(tableName: string, values: Row): Row {
  const now = nowIso();
  const row: Row = { ...defaultsFor(tableName), ...values };
  if (tableName === 'activity') row.id = nextActivityId++;
  else if (tableName !== 'hours_months' && row.id === undefined) row.id = newId(tableName);
  row.created_at = row.created_at ?? now;
  if (AUDITED.has(tableName)) {
    row.updated_at = now;
    row.created_by = ME;
    row.updated_by = ME;
  }
  if (tableName === 'roles') row.updated_at = now;
  if (tableName === 'task_comments') row.user_id = ME;
  if (tableName === 'hours_months') row.closed_by = ME;
  if (tableName === 'tasks' && row.status === 'done') row.done_at = now;
  guard(tableName, null, row);
  (db[tableName] ?? (db[tableName] = [])).push(row);
  logActivity(
    tableName,
    tableName === 'task_comments' ? 'commented' : tableName === 'hours_months' ? 'closed' : 'created',
    null,
    row
  );
  emit(tableName, 'INSERT', row, {});
  if (tableName === 'task_items') syncProgress(String(row.task_id));
  return row;
}

function update(tableName: string, row: Row, patch: Row, by: string = ME): Row {
  const before = { ...row };
  guard(tableName, before, { ...row, ...patch });
  Object.assign(row, patch);
  if (AUDITED.has(tableName) || tableName === 'inquiries') {
    row.updated_at = nowIso();
    row.updated_by = by;
  }
  if (tableName === 'roles') row.updated_at = nowIso();
  if (tableName === 'tasks' && before.status !== row.status) row.done_at = row.status === 'done' ? nowIso() : null;
  logActivity(tableName, 'updated', before, row, by);
  emit(tableName, 'UPDATE', row, before);
  if (tableName === 'task_items') syncProgress(String(row.task_id));
  return row;
}

/** A task with a checklist takes its progress from it, as the trigger does. */
function syncProgress(taskId: string): void {
  const task = (db.tasks ?? []).find((row) => row.id === taskId);
  if (!task) return;
  const items = (db.task_items ?? []).filter((row) => row.task_id === taskId);
  if (!items.length) return;
  const progress = Math.round((items.filter((row) => row.done).length / items.length) * 100);
  if (progress === task.progress) return;
  const before = { ...task };
  task.progress = progress;
  emit('tasks', 'UPDATE', task, before);
}

/* ----------------------------------------------------------- activity --- */

const LABEL: Record<string, string> = {
  todo: 'To do',
  doing: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
  new: 'New',
  contacted: 'Contacted',
  enrolled: 'Enrolled',
  closed: 'Closed',
  active: 'Active',
  archived: 'Archived',
};

const label = (value: unknown) => LABEL[String(value)] ?? (value === null || value === '' ? 'none' : String(value));

function fmtDay(value: unknown): string {
  if (!value) return 'none';
  const [year, month, dayOfMonth] = String(value).split('-').map(Number);
  return new Date(year!, (month ?? 1) - 1, dayOfMonth ?? 1).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function fmtHours(value: unknown): string {
  return `${Number(Number(value).toFixed(2))} h`;
}

const ENTITY: Record<string, string> = {
  tasks: 'task',
  task_items: 'task_item',
  task_comments: 'comment',
  time_entries: 'time_entry',
  projects: 'project',
  profiles: 'profile',
  roles: 'role',
  invitations: 'invitation',
  hours_months: 'month',
  inquiries: 'inquiry',
};

function nameOf(id: unknown): string {
  const profile = (db.profiles ?? []).find((row) => row.id === id);
  return String(profile?.full_name ?? 'someone');
}

function codeOf(projectId: unknown): string {
  const project = (db.projects ?? []).find((row) => row.id === projectId);
  return project ? String(project.code) : '';
}

function titleOf(taskId: unknown): string {
  const task = (db.tasks ?? []).find((row) => row.id === taskId);
  return task ? String(task.title) : 'a task';
}

function roleNameOf(roleId: unknown): string {
  const role = (db.roles ?? []).find((row) => row.id === roleId);
  return role ? String(role.name) : 'another role';
}

function monthWords(value: unknown): string {
  const [year, month] = String(value).split('-').map(Number);
  return new Date(year!, (month ?? 1) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** One human line per change, in the same words the database trigger uses. */
function describe(tableName: string, action: string, before: Row | null, after: Row | null): string {
  const row = (after ?? before)!;
  if (action === 'commented') return `Commented on "${titleOf(row.task_id)}"`;
  if (action === 'closed') return `Closed ${monthWords(row.month)}`;
  if (action === 'reopened') return `Reopened ${monthWords(row.month)}`;

  if (action === 'created') {
    switch (tableName) {
      case 'tasks':
        return `Created "${row.title}"`;
      case 'task_items':
        return `Added "${row.text}" to the checklist`;
      case 'time_entries': {
        const code = codeOf(row.project_id);
        return `Logged ${fmtHours(row.hours)}${code ? ` on ${code}` : ''}`;
      }
      case 'projects':
        return `Created project ${row.code}`;
      case 'roles':
        return `Created the role ${row.name}`;
      case 'invitations':
        return `Invited someone as ${roleNameOf(row.role_id)}`;
      default:
        return 'Added';
    }
  }

  if (action === 'deleted') {
    switch (tableName) {
      case 'tasks':
        return `Deleted "${row.title}"`;
      case 'task_items':
        return `Removed "${row.text}" from the checklist`;
      case 'task_comments':
        return `Deleted a comment on "${titleOf(row.task_id)}"`;
      case 'time_entries':
        return `Removed ${fmtHours(row.hours)} from ${fmtDay(row.work_date)}`;
      case 'roles':
        return `Deleted the role ${row.name}`;
      case 'invitations':
        return 'Withdrew an invitation';
      default:
        return 'Removed';
    }
  }

  if (!before || !after) return '';
  const changed = Object.keys(after).filter(
    (key) =>
      !['updated_at', 'updated_by', 'created_at', 'created_by', 'sort', 'done_at', 'last_seen_at'].includes(key) &&
      JSON.stringify(before[key]) !== JSON.stringify(after[key])
  );
  if (!changed.length) return '';
  const parts: string[] = [];
  for (const key of changed) {
    if (tableName === 'task_items' && key === 'done') parts.push(`${after.done ? 'Ticked' : 'Unticked'} "${after.text}"`);
    else if (tableName === 'task_items' && key === 'text') parts.push(`Renamed a step to "${after.text}"`);
    else if (key === 'title') parts.push(`Renamed to "${after.title}"`);
    else if (key === 'status') parts.push(`Status: ${label(before.status)} → ${label(after.status)}`);
    else if (key === 'priority') parts.push(`Priority: ${label(before.priority)} → ${label(after.priority)}`);
    else if (key === 'due') parts.push(`Due: ${fmtDay(before.due)} → ${fmtDay(after.due)}`);
    else if (key === 'progress' && tableName === 'tasks') parts.push(`Progress: ${before.progress}% → ${after.progress}%`);
    else if (key === 'assignee_id') parts.push(after.assignee_id ? `Assigned to ${nameOf(after.assignee_id)}` : 'Unassigned');
    else if (key === 'project_id') parts.push(after.project_id ? `Moved to ${codeOf(after.project_id)}` : 'Took off its project');
    else if (key === 'role_id') parts.push(`Changed ${nameOf(after.id)} to ${roleNameOf(after.role_id)}`);
    else if (key === 'active') parts.push(after.active ? `Reactivated ${nameOf(after.id)}` : `Deactivated ${nameOf(after.id)}`);
    else if (key === 'permissions') parts.push(`Changed what ${after.name} allows`);
    else if (key === 'revoked_at') parts.push('Withdrew an invitation');
    else if (key === 'task_id' && tableName === 'inquiries') parts.push(after.task_id ? `Made the task "${titleOf(after.task_id)}"` : 'Unlinked the task');
    else if (key === 'hours') parts.push(`Hours: ${fmtHours(before.hours)} → ${fmtHours(after.hours)}`);
    else if (key === 'notes') parts.push('Edited the notes');
    else if (key === 'description') parts.push('Edited the description');
    else parts.push('Edited details');
  }
  return [...new Set(parts)].join(' · ');
}

function logActivity(tableName: string, action: string, before: Row | null, after: Row | null, by: string = ME): void {
  const entity = ENTITY[tableName];
  if (!entity) return;
  // last_seen_at moves on every visit; the real trigger ignores it too.
  if (tableName === 'profiles' && before && after) {
    const keys = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    if (keys.every((key) => key === 'last_seen_at')) return;
  }
  const summary = describe(tableName, action, before, after);
  if (!summary) return;
  const row = (after ?? before)!;
  const taskId =
    tableName === 'tasks' ? row.id : tableName === 'task_items' || tableName === 'task_comments' ? row.task_id : null;
  const entry: Row = {
    id: nextActivityId++,
    actor_id: by,
    entity,
    entity_id: tableName === 'hours_months' ? null : (row.id ?? null),
    task_id: taskId ?? null,
    subject_id: tableName === 'time_entries' ? (row.user_id ?? null) : null,
    action,
    summary,
    created_at: nowIso(),
  };
  (db.activity ?? (db.activity = [])).unshift(entry);
  emit('activity', 'INSERT', entry, {});
}

/* ----------------------------------------------------------- realtime --- */

interface Attached {
  topic: string;
  listeners: Array<{ table: string; filter: string; callback: (payload: unknown) => void }>;
  onPresence: () => void;
}

const channels = new Set<Attached>();

export function attachChannel(entry: Attached): () => void {
  channels.add(entry);
  window.setTimeout(entry.onPresence, 80);
  return () => channels.delete(entry);
}

function emit(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', next: Row, old: Row): void {
  // Realtime is filtered by RLS too: a row you cannot read never arrives.
  const row = eventType === 'DELETE' ? old : next;
  if (!visible(table, row)) return;
  const payload = { eventType, new: { ...next }, old: { ...old }, table, schema: 'public' };
  window.setTimeout(() => {
    for (const channel of channels) {
      for (const listener of channel.listeners) {
        if (listener.table !== table) continue;
        try {
          listener.callback(payload);
        } catch {
          /* a listener's own problem */
        }
      }
    }
  }, 120);
}

/* ----------------------------------------------------------- presence --- */

const presence = new Map<string, Row>();
const peers: Row[] = [
  { user_id: SAM, name: 'Sam Sample', where: 'tasks' },
  { user_id: ROBIN, name: 'Robin Test', where: 'hours-team' },
].filter((peer) => peer.user_id !== ME);

export function presenceState(topic: string): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const [key, meta] of presence) out[key] = [meta];
  if (topic === 'workspace') {
    for (const peer of peers) out[String(peer.user_id)] = [peer];
  }
  return out;
}

let simulated = false;

export function trackPresence(key: string, meta: Row): void {
  presence.set(key, meta);
  for (const channel of channels) channel.onPresence();

  // The first task somebody opens gets a visit and an edit from a colleague.
  const where = String(meta.where ?? '');
  const colleague = peers[0];
  if (!simulated && colleague && where.startsWith('task:')) {
    simulated = true;
    const taskId = where.slice(5);
    window.setTimeout(() => {
      colleague.where = where;
      for (const channel of channels) channel.onPresence();
    }, 2500);
    window.setTimeout(() => {
      const task = (db.tasks ?? []).find((row) => row.id === taskId);
      if (!task) return;
      const due = task.due ? new Date(`${task.due}T12:00:00`) : new Date();
      due.setDate(due.getDate() + 3);
      const next = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      update('tasks', task, { due: next }, String(colleague.user_id));
    }, 6000);
  }
}

export function untrackPresence(key: string): void {
  presence.delete(key);
  for (const channel of channels) channel.onPresence();
}
