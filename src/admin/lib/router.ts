/**
 * Hash routing.
 *
 * GitHub Pages serves static files and cannot rewrite unknown paths onto one
 * app shell, so the whole portal lives at /admin/ and the route is in the hash:
 *
 *   #/                     Home
 *   #/tasks                Tasks. Query: view=list|board, scope=mine|all,
 *                          project=<id>, person=<id>, status=<s>, q=<text>;
 *                          task=<id> opens the drawer, new=1 the new-task form
 *   #/hours                My hours, one week. Query: week=YYYY-MM-DD (the
 *                          Monday), log=1 opens Log hours, entry=<id> edits one
 *   #/hours/team           Everyone's hours. Query: month=YYYY-MM, person=<id>,
 *                          project=<id>
 *   #/inbox                the public forms' responses. Query: item=<id>
 *                          opens the drawer; status=, source= filter
 *   #/people               the directory, and invitations
 *   #/people/<id>          one person
 *   #/activity             everything that changed
 *   #/settings             Projects tab; #/settings/roles the Roles tab
 *   #/account              your own settings
 *   #/login  #/join/<token>  #/reset
 *   #/demo/...             any of the above against the in-memory fixture
 *                          (src/admin/demo), for review without an account
 *
 * The v1 addresses (#/today, #/p/<slug>/..., #/projects) are recognised and
 * sent to #/ so an old bookmark lands somewhere useful instead of a 404.
 *
 * Supabase also puts its own recovery parameters in the hash
 * (`#access_token=...&type=recovery`). Anything that does not start with `#/`
 * is therefore treated as "no route yet" rather than a 404, and auth.ts sends
 * the user to #/reset once the SDK has consumed it.
 */
import { observable, useObservable } from './observable';
import { DEMO, DEMO_PREFIX } from '../demo/mode';

export type RouteName =
  | 'home'
  | 'tasks'
  | 'hours'
  | 'hours-team'
  | 'inbox'
  | 'people'
  | 'person'
  | 'activity'
  | 'settings'
  | 'account'
  | 'login'
  | 'join'
  | 'reset'
  /** A v1 address: AdminApp replaces it with #/. */
  | 'legacy'
  | 'unknown';

export interface Route {
  /** The normalised path, always starting with a slash: "/p/acme/tasks". */
  path: string;
  segments: string[];
  name: RouteName;
  params: Record<string, string>;
  query: Record<string, string>;
  /** The raw hash, minus the leading "#". */
  raw: string;
}

const EMPTY: Record<string, string> = {};

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Reads a hash string (with or without the "#") into a Route. */
export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '');

  // Supabase's own hash payload, or an empty hash. Both mean "go home".
  if (!raw || !raw.startsWith('/')) {
    return { path: '/', segments: [], name: 'home', params: EMPTY, query: EMPTY, raw };
  }

  const [rawPath, queryPart = ''] = raw.split('?');
  // The demo carries its prefix in every address; the app never sees it.
  const pathPart = stripDemo(rawPath ?? '/');
  const path = `/${(pathPart || '/').replace(/^\/+|\/+$/g, '')}`;
  const segments = path.split('/').filter(Boolean).map(decode);

  const query: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      if (!pair) continue;
      const index = pair.indexOf('=');
      const key = decode(index === -1 ? pair : pair.slice(0, index));
      const value = index === -1 ? '' : decode(pair.slice(index + 1).replace(/\+/g, ' '));
      if (key) query[key] = value;
    }
  }

  const params: Record<string, string> = {};
  let name: RouteName = 'unknown';

  switch (segments[0]) {
    case undefined:
      name = 'home';
      break;
    case 'tasks':
      if (!segments[1]) name = 'tasks';
      break;
    case 'hours':
      if (!segments[1]) name = 'hours';
      else if (segments[1] === 'team' && !segments[2]) name = 'hours-team';
      break;
    case 'inbox':
      if (!segments[1]) name = 'inbox';
      break;
    case 'people':
      if (!segments[1]) name = 'people';
      else if (!segments[2]) {
        name = 'person';
        params.id = segments[1];
      }
      break;
    case 'activity':
      if (!segments[1]) name = 'activity';
      break;
    case 'settings':
      if (!segments[1] || segments[1] === 'projects' || segments[1] === 'roles') {
        name = 'settings';
        params.tab = segments[1] === 'roles' ? 'roles' : 'projects';
      }
      break;
    case 'account':
      name = 'account';
      break;
    case 'login':
      name = 'login';
      break;
    case 'reset':
      name = 'reset';
      break;
    case 'join':
      if (segments[1]) {
        name = 'join';
        params.token = segments[1];
      }
      break;
    case 'today':
    case 'projects':
    case 'p':
      name = 'legacy';
      break;
    default:
      name = 'unknown';
  }

  return { path, segments, name, params, query, raw };
}

function stripDemo(path: string): string {
  if (path === DEMO_PREFIX) return '/';
  return path.startsWith(`${DEMO_PREFIX}/`) ? path.slice(DEMO_PREFIX.length) : path;
}

const isDemoHash = (hash: string) => /^#\/demo(?:[/?]|$)/.test(hash);

function currentHash(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hash;
}

const store = observable<Route>(parseRoute(currentHash()));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    // Crossing between the demo and the real portal needs a different
    // Supabase client, and the client is made once per page: reload.
    if (isDemoHash(window.location.hash) !== DEMO) {
      window.location.reload();
      return;
    }
    store.set(parseRoute(window.location.hash));
  });
}

/** The current route, outside a component. */
export function getRoute(): Route {
  return store.get();
}

/** The current route, inside a component. Re-renders on every change. */
export function useRoute(): Route {
  return useObservable(store);
}

export interface NavigateOptions {
  /** Replaces the history entry instead of pushing one. */
  replace?: boolean;
  /** Query parameters to append. `null`/`undefined` values are dropped. */
  query?: Record<string, string | number | null | undefined>;
}

/** Builds a hash href, for `<a href={href('/tasks', { view: 'board' })}>`. */
export function href(path: string, query?: NavigateOptions['query']): string {
  const bare = path.startsWith('/') ? path : `/${path}`;
  const clean = DEMO ? `${DEMO_PREFIX}${bare === '/' ? '' : bare}` : bare;
  const pairs = Object.entries(query ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `#${clean}${pairs.length ? `?${pairs.join('&')}` : ''}`;
}

/** Goes to a route. Safe to call during render-triggered effects. */
export function navigate(path: string, options: NavigateOptions = {}): void {
  if (typeof window === 'undefined') return;
  const target = href(path, options.query);
  if (window.location.hash === target) {
    // Same address: nothing to push, but make sure listeners are in step.
    store.set(parseRoute(target));
    return;
  }
  if (options.replace) {
    const url = `${window.location.pathname}${window.location.search}${target}`;
    window.history.replaceState(null, '', url);
    store.set(parseRoute(target));
  } else {
    window.location.hash = target;
  }
}

/** Replaces only the query part of the current route. */
export function setQuery(query: NavigateOptions['query']): void {
  const route = getRoute();
  navigate(route.path, { query, replace: true });
}

/**
 * Changes some query keys and keeps the rest: `patchQuery({ task: id })` opens
 * a drawer without losing the filters, `patchQuery({ task: null })` closes it.
 * A drawer or dialog opened this way is pushed (Back closes it); a filter
 * change passes `replace` so Back does not walk through every chip click.
 */
export function patchQuery(
  patch: Record<string, string | number | null | undefined>,
  options: { replace?: boolean } = {}
): void {
  const route = getRoute();
  const query: Record<string, string | number | null | undefined> = { ...route.query, ...patch };
  navigate(route.path, { query, replace: options.replace });
}

/** Where to send someone after they sign in, remembered across the redirect. */
let pendingDestination: string | null = null;

export function rememberDestination(path: string): void {
  if (path === '/login' || path === '/reset' || path.startsWith('/join')) return;
  pendingDestination = path;
}

export function takeDestination(): string {
  const destination = pendingDestination ?? '/';
  pendingDestination = null;
  return destination;
}
