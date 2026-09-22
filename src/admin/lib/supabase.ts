/**
 * The one Supabase client the whole portal shares.
 *
 * Creating a second client would mean a second auth listener and a second
 * realtime socket, so everything imports this module instead.
 *
 * ------------------------------------------ why there is a deadline on fetch
 * Every authenticated request the portal makes runs through
 * `supabase.auth.getSession()`, and `getSession()` waits on the SDK's
 * `initializePromise`, which in turn waits on a `/auth/v1/token` refresh with
 * no deadline of its own. One request that is neither answered nor refused is
 * therefore enough to wedge the whole portal: no error, no retry, just a
 * loading skeleton that never resolves and — the tell — no further requests in
 * the network panel, because they are all queued behind the session.
 *
 * Safari is where this bites. It suspends in-flight connections when a tab is
 * backgrounded, when the page is restored from the back-forward cache, and
 * when the laptop wakes, and those requests are left hanging rather than
 * failed. Chromium fails them quickly, which is why the same build felt fine
 * there. The wrapper below gives every request an upper bound, so a stalled
 * connection becomes an ordinary error the screens already know how to show.
 *
 * ------------------------------------------------------ why there is no lock
 * auth-js 2.116 coordinates session refreshes itself (a single-flight promise
 * plus a commit guard) and does NOT touch `navigator.locks`; `lock` is
 * deprecated there and passing one re-enables the old `_acquireLock` path and
 * logs a deprecation warning. So the Safari "Web Locks left held across a
 * reload" deadlock cannot happen on this version, and the fix is to leave the
 * option alone. `scripts/webkit-smoke.mjs` holds `lock:wb.auth` for the life
 * of the page and the portal still signs in, which is the proof.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, REQUEST_TIMEOUT_MS } from './config';

/**
 * `fetch` with an upper bound. An abort surfaces as a plain error, which
 * `toAppError` turns into the "cannot reach the server" wording, so a stall
 * ends up on screen looking like every other connection problem.
 */
function fetchWithDeadline(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // A caller's own signal still has to work; aborting ours covers both.
  const caller = init.signal;
  if (caller) {
    if (caller.aborted) controller.abort();
    else caller.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal })
    .catch((error) => {
      // Ours fired, not the caller's: say so in words a screen can show.
      if (controller.signal.aborted && !caller?.aborted) {
        throw new Error(
          `The server did not answer within ${Math.round(REQUEST_TIMEOUT_MS / 1000)} seconds.`
        );
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
}

/**
 * localStorage, but it can never throw.
 *
 * Safari refuses storage outright in some private-browsing and
 * intelligent-tracking-prevention states, and a throw from the storage adapter
 * takes the SDK's whole init chain with it. Falling back to memory means the
 * session lasts until the tab closes instead of taking the portal down.
 */
function safeStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } {
  const memory = new Map<string, string>();
  const usable = (() => {
    try {
      const probe = '__wb.probe';
      window.localStorage.setItem(probe, probe);
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  })();

  return {
    getItem(key) {
      if (usable) {
        try {
          return window.localStorage.getItem(key);
        } catch {
          /* fall through to memory */
        }
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      if (!usable) return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* quota or a blocked origin: memory already has it */
      }
    },
    removeItem(key) {
      memory.delete(key);
      if (!usable) return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* nothing to do */
      }
    },
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The password-reset link arrives with the recovery token in the URL hash.
    // The app's own routes all start with `#/`, which the SDK ignores, so hash
    // routing and session detection do not fight over the fragment.
    detectSessionInUrl: true,
    storageKey: 'wb.auth',
    flowType: 'implicit',
    storage: typeof window === 'undefined' ? undefined : safeStorage(),
  },
  realtime: {
    // One project channel at a time; a small cap keeps us well inside the
    // free tier's message budget even with a room full of people.
    params: { eventsPerSecond: 8 },
  },
  global: {
    headers: { 'x-client-info': 'mmt-workbench' },
    fetch: fetchWithDeadline,
  },
});
