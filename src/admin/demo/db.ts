/**
 * The demo's in-memory database: runs the queries `client.ts` records against
 * the fixture, writes the changes back into it, logs activity the way the
 * database trigger does, and replays every change to any open realtime
 * channel. A reload starts again from the fixture.
 *
 * Two other people are "here" in the primary project, so presence shows up,
 * and the first time you open a task one of them changes its due date a few
 * seconds later, so the "someone else changed this" toast can be seen too.
 */
import { buildFixture, ME, PRIMARY_ID, SAM, ROBIN } from './fixture';
import type { DemoFilter, DemoQuery } from './types';

type Row = Record<string, unknown>;

const db = buildFixture() as unknown as Record<string, Row[]>;

/** Pretend to be a network: short enough to feel instant, long enough to be async. */
const LATENCY_MS = 60;
const wait = (ms = LATENCY_MS) => new Promise((done) => window.setTimeout(done, ms));

let nextActivityId = 6000;
let nextId = 1;
const newId = (table: string) => `demo-${table}-new-${nextId++}`;
const nowIso = () => new Date().toISOString();

/* --------------------------------------------------------------- auth --- */

export function demoSession() {
  const now = Math.floor(Date.now() / 1000);
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
      email: 'pat@example.invalid',
      app_metadata: {},
      user_metadata: { full_name: 'Pat Example' },
      created_at: nowIso(),
    },
  };
}

export async function rpc(name: string, _args?: Record<string, unknown>) {
  await wait();
  if (name === 'invite_preview') {
    return { data: { valid: false }, error: null, status: 200 };
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

export async function execute(query: DemoQuery) {
  await wait();
  const table = db[query.table] ?? (db[query.table] = []);
  const hits = () => table.filter((row) => query.filters.every((filter) => matches(row, filter)));

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
      db[query.table] = table.filter((row) => !gone.includes(row));
      for (const row of gone) {
        logActivity(query.table, 'deleted', row, null);
        emit(query.table, 'DELETE', {}, { id: row.id, project_id: row.project_id });
      }
      return { data: null, error: null, status: 204 };
    }

    default:
      return { data: null, error: { message: 'Not supported in the demo.' }, status: 400 };
  }
}

const AUDITED = new Set(['tasks', 'reports', 'partners', 'project_state', 'project_docs', 'projects']);

function insert(tableName: string, values: Row): Row {
  const now = nowIso();
  const row: Row = { ...defaultsFor(tableName), ...values };
  if (tableName !== 'project_state' && tableName !== 'project_members' && row.id === undefined) {
    row.id = tableName === 'activity' ? nextActivityId++ : newId(tableName);
  }
  row.created_at = row.created_at ?? now;
  if (AUDITED.has(tableName)) {
    row.updated_at = now;
    row.created_by = ME;
    row.updated_by = ME;
  }
  if (tableName === 'comments') row.user_id = ME;
  (db[tableName] ?? (db[tableName] = [])).push(row);
  logActivity(tableName, tableName === 'comments' ? 'commented' : 'created', null, row);
  emit(tableName, 'INSERT', row, {});
  return row;
}

function update(tableName: string, row: Row, patch: Row, by: string = ME): Row {
  const before = { ...row };
  Object.assign(row, patch);
  if (AUDITED.has(tableName)) {
    row.updated_at = nowIso();
    row.updated_by = by;
  }
  logActivity(tableName, 'updated', before, row, by);
  emit(tableName, 'UPDATE', row, before);
  return row;
}

function defaultsFor(tableName: string): Row {
  switch (tableName) {
    case 'tasks':
      return {
        ws: '',
        status: 'todo',
        pri: 'normal',
        horizon: 'now',
        due: null,
        owner: '',
        assignee: null,
        why: '',
        done_when: '',
        notes: '',
        recurring: '',
        sources: [],
        sort: 0,
      };
    case 'partners':
      return { county: '', kind: '', stage: 'not_contacted', contact: '', next_step: '', notes: '', referrals: 0, sort: 0 };
    case 'reports':
      return { covers: '', kind: 'monthly', status: 'not_started', checks: {}, amount: null, submitted_on: null, notes: '', sources: [] };
    case 'projects':
      return { summary: '', status: 'active', config: {}, kind: 'general', track: 'org' };
    default:
      return {};
  }
}

/* ----------------------------------------------------------- activity --- */

const LABEL: Record<string, string> = {
  todo: 'To do',
  doing: 'Doing',
  blocked: 'Blocked',
  done: 'Done',
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  now: 'Now',
  next: 'Next',
  later: 'Later',
  not_started: 'Not started',
  preparing: 'Preparing',
  submitted: 'Submitted',
  returned: 'Returned',
  approved: 'Approved',
  paid: 'Paid',
  not_contacted: 'Not contacted',
  contacted: 'Contacted',
  meeting_held: 'Meeting held',
  referring: 'Referring',
  paused: 'Paused',
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

const ENTITY: Record<string, string> = {
  tasks: 'task',
  reports: 'report',
  partners: 'partner',
  project_state: 'state',
  comments: 'comment',
  project_docs: 'doc',
};

function nameOf(id: unknown): string {
  const profile = (db.profiles ?? []).find((row) => row.id === id);
  return String(profile?.full_name ?? 'someone');
}

function logActivity(tableName: string, action: string, before: Row | null, after: Row | null, by: string = ME): void {
  const entity = ENTITY[tableName];
  if (!entity) return;
  const row = after ?? before!;
  const projectId = row.project_id as string | undefined;
  if (!projectId) return;

  let summary = '';
  if (action === 'created') {
    summary =
      tableName === 'tasks'
        ? `Added "${row.title}"`
        : tableName === 'partners'
          ? `Added partner ${row.name}`
          : tableName === 'reports'
            ? `Added report ${row.period}`
            : 'Added';
  } else if (action === 'deleted') {
    summary = tableName === 'tasks' ? `Removed "${row.title}"` : `Removed ${String(row.name ?? row.period ?? row.title ?? '')}`;
  } else if (action === 'commented') {
    summary = 'Commented';
  } else if (before && after) {
    const changed = Object.keys(after).filter(
      (key) =>
        !['updated_at', 'updated_by', 'created_at', 'created_by', 'sort'].includes(key) &&
        JSON.stringify(before[key]) !== JSON.stringify(after[key])
    );
    if (!changed.length) return;
    const parts: string[] = [];
    for (const key of changed) {
      if (key === 'title') parts.push(`Renamed to "${after.title}"`);
      else if (['status', 'pri', 'horizon', 'stage'].includes(key)) {
        const name = { status: 'Status', pri: 'Priority', horizon: 'Horizon', stage: 'Stage' }[key];
        parts.push(`${name}: ${label(before[key])} → ${label(after[key])}`);
      } else if (key === 'due' || key === 'submitted_on') {
        parts.push(`${key === 'due' ? 'Due' : 'Submitted'}: ${fmtDay(before[key])} → ${fmtDay(after[key])}`);
      } else if (key === 'assignee') {
        parts.push(after.assignee ? `Assigned to ${nameOf(after.assignee)}` : 'Unassigned');
      } else if (key === 'referrals') parts.push(`Referrals: ${before.referrals} → ${after.referrals}`);
      else if (key === 'checks') parts.push('Updated the checklist');
      else if (key === 'amount') parts.push('Changed the amount');
      else if (key === 'data') parts.push(after.key === 'budget' ? 'Updated what has been billed' : 'Updated the outcome numbers');
      else if (key === 'notes') parts.push('Edited notes');
      else if (key === 'sources') parts.push('Edited sources');
      else parts.push('Edited details');
    }
    summary = [...new Set(parts)].join(' · ');
  }
  if (!summary) return;

  const entry: Row = {
    id: nextActivityId++,
    project_id: projectId,
    user_id: by,
    entity,
    entity_id: tableName === 'project_state' ? projectId : (row.id ?? null),
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
  const payload = { eventType, new: { ...next }, old: { ...old }, table, schema: 'public' };
  const projectId = String(next.project_id ?? old.project_id ?? '');
  window.setTimeout(() => {
    for (const channel of channels) {
      for (const listener of channel.listeners) {
        if (listener.table !== table) continue;
        if (listener.filter && listener.filter !== `project_id=eq.${projectId}`) continue;
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
  { user_id: SAM, name: 'Sam Sample', tab: 'plan', editing: '' },
  { user_id: ROBIN, name: 'Robin Test', tab: 'reports', editing: '' },
];

export function presenceState(topic: string): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const [key, meta] of presence) out[key] = [meta];
  if (topic === `project:${PRIMARY_ID}`) {
    for (const peer of peers) out[String(peer.user_id)] = [peer];
  }
  return out;
}

let simulated = false;

export function trackPresence(key: string, meta: Row): void {
  presence.set(key, meta);
  for (const channel of channels) channel.onPresence();

  // The first task somebody opens gets a visit and an edit from a colleague.
  const editing = String(meta.editing ?? '');
  if (!simulated && editing.startsWith('task:')) {
    simulated = true;
    const taskId = editing.slice(5);
    window.setTimeout(() => {
      peers[0]!.editing = editing;
      for (const channel of channels) channel.onPresence();
    }, 2500);
    window.setTimeout(() => {
      const task = (db.tasks ?? []).find((row) => row.id === taskId);
      if (!task) return;
      const due = task.due ? new Date(`${task.due}T12:00:00`) : new Date();
      due.setDate(due.getDate() + 3);
      const next = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      update('tasks', task, { due: next }, SAM);
    }, 6000);
  }
}

export function untrackPresence(key: string): void {
  presence.delete(key);
  for (const channel of channels) channel.onPresence();
}
