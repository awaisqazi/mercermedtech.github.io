/**
 * A stand-in for the Supabase client, for the review demo only.
 *
 * It implements the small part of the SDK the portal actually uses: the
 * PostgREST query builder (`from().select().eq()...`), `rpc`, a handful of
 * `auth` calls, and a realtime channel with postgres changes and presence.
 * Every query is recorded here and executed by `db.ts` against the fixture,
 * which is only downloaded when the first query runs, so none of the demo
 * data ever reaches a real visitor's browser.
 *
 * It never opens a socket or makes a request.
 */
import type { DemoQuery, DemoFilter } from './types';

type Result = { data: unknown; error: unknown; count?: number | null; status: number };

let engine: Promise<typeof import('./db')> | null = null;

/** The engine, loaded once. Exposed for the channel and auth shims too. */
export function demoDb(): Promise<typeof import('./db')> {
  if (!engine) {
    engine = import('./db').catch((error) => {
      // A download cut short (a reload, a dropped connection) can be tried again.
      engine = null;
      throw error;
    });
  }
  return engine;
}

class Query implements PromiseLike<Result> {
  private q: DemoQuery;

  constructor(table: string) {
    this.q = {
      table,
      action: 'select',
      columns: '*',
      filters: [],
      orders: [],
      limit: null,
      single: null,
      returning: false,
      values: null,
      onConflict: null,
    };
  }

  select(columns = '*'): this {
    if (this.q.action === 'select') this.q.columns = columns;
    else this.q.returning = true;
    return this;
  }

  insert(values: unknown): this {
    this.q.action = 'insert';
    this.q.values = values;
    return this;
  }

  upsert(values: unknown, options?: { onConflict?: string }): this {
    this.q.action = 'upsert';
    this.q.values = values;
    this.q.onConflict = options?.onConflict ?? null;
    return this;
  }

  update(values: unknown): this {
    this.q.action = 'update';
    this.q.values = values;
    return this;
  }

  delete(): this {
    this.q.action = 'delete';
    return this;
  }

  private add(column: string, op: DemoFilter['op'], value: unknown): this {
    this.q.filters.push({ column, op, value });
    return this;
  }

  eq(column: string, value: unknown) {
    return this.add(column, 'eq', value);
  }
  neq(column: string, value: unknown) {
    return this.add(column, 'neq', value);
  }
  in(column: string, value: unknown[]) {
    return this.add(column, 'in', value);
  }
  lt(column: string, value: unknown) {
    return this.add(column, 'lt', value);
  }
  lte(column: string, value: unknown) {
    return this.add(column, 'lte', value);
  }
  gt(column: string, value: unknown) {
    return this.add(column, 'gt', value);
  }
  gte(column: string, value: unknown) {
    return this.add(column, 'gte', value);
  }
  is(column: string, value: unknown) {
    return this.add(column, 'is', value);
  }
  not(column: string, op: string, value: unknown) {
    return this.add(column, op === 'in' ? 'notin' : op === 'is' ? 'notis' : 'neq', value);
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.q.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.q.limit = count;
    return this;
  }

  single(): this {
    this.q.single = 'single';
    return this;
  }

  maybeSingle(): this {
    this.q.single = 'maybe';
    return this;
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): Promise<A | B> {
    const query = this.q;
    return demoDb()
      .then((db) => db.execute(query))
      .then(onFulfilled, onRejected);
  }
}

type Listener = { table: string; filter: string; callback: (payload: unknown) => void };

/** A realtime channel that listens to the in-memory tables. */
class Channel {
  readonly topic: string;
  private listeners: Listener[] = [];
  private presenceListeners: Array<() => void> = [];
  private detach: (() => void) | null = null;
  private presenceKey: string;

  constructor(topic: string, options?: { config?: { presence?: { key?: string } } }) {
    this.topic = topic;
    this.presenceKey = options?.config?.presence?.key ?? 'me';
  }

  on(type: string, filter: Record<string, unknown>, callback: (payload: unknown) => void): this {
    if (type === 'postgres_changes') {
      this.listeners.push({
        table: String(filter.table ?? ''),
        filter: String(filter.filter ?? ''),
        callback,
      });
    } else if (type === 'presence') {
      this.presenceListeners.push(callback as () => void);
    }
    return this;
  }

  subscribe(callback?: (status: string, error?: unknown) => void): this {
    void demoDb().then((db) => {
      this.detach = db.attachChannel({
        topic: this.topic,
        listeners: this.listeners,
        onPresence: () => {
          for (const listener of this.presenceListeners) listener();
        },
      });
      window.setTimeout(() => callback?.('SUBSCRIBED'), 40);
    });
    return this;
  }

  async track(meta: Record<string, unknown>): Promise<'ok'> {
    const db = await demoDb();
    db.trackPresence(this.presenceKey, meta);
    return 'ok';
  }

  async untrack(): Promise<'ok'> {
    const db = await demoDb();
    db.untrackPresence(this.presenceKey);
    return 'ok';
  }

  presenceState<T>(): Record<string, T[]> {
    return (engineSync?.presenceState(this.topic) ?? {}) as Record<string, T[]>;
  }

  unsubscribe(): Promise<'ok'> {
    this.detach?.();
    this.detach = null;
    return Promise.resolve('ok');
  }
}

/** Set once the engine has loaded, for the one synchronous call (presenceState). */
let engineSync: typeof import('./db') | null = null;

type AuthCallback = (event: string, session: unknown) => void;

function authShim() {
  const callbacks = new Set<AuthCallback>();
  let signedIn = true;

  const session = async () => ((await demoDb()).demoSession());
  const emit = async (event: string) => {
    const current = signedIn ? await session() : null;
    for (const callback of callbacks) callback(event, current);
  };

  return {
    onAuthStateChange(callback: AuthCallback) {
      callbacks.add(callback);
      window.setTimeout(() => void emit('INITIAL_SESSION'), 0);
      return { data: { subscription: { unsubscribe: () => callbacks.delete(callback) } } };
    },
    async getSession() {
      return { data: { session: signedIn ? await session() : null }, error: null };
    },
    async signInWithPassword() {
      signedIn = true;
      await emit('SIGNED_IN');
      return { data: {}, error: null };
    },
    async signOut() {
      signedIn = false;
      await emit('SIGNED_OUT');
      return { error: null };
    },
    async signUp() {
      return { data: {}, error: { message: 'Invitations do not work in the demo.' } };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async updateUser() {
      return { data: {}, error: null };
    },
  };
}

/** The whole stand-in. Shaped like the part of `SupabaseClient` we call. */
export function createDemoClient() {
  void demoDb().then((db) => {
    engineSync = db;
  });
  return {
    from: (table: string) => new Query(table),
    rpc: async (name: string, args?: Record<string, unknown>) => (await demoDb()).rpc(name, args),
    channel: (topic: string, options?: { config?: { presence?: { key?: string } } }) =>
      new Channel(topic, options),
    removeChannel: (channel: Channel) => channel.unsubscribe(),
    realtime: { setAuth: () => Promise.resolve() },
    auth: authShim(),
  };
}
