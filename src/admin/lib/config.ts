/**
 * Connection details for the Workbench.
 *
 * The website repo is PUBLIC, so the only key that may ever appear here is the
 * Supabase **publishable** key. It is designed to be shipped to browsers: it
 * grants nothing on its own, because every table is protected by row level
 * security and every read happens as the signed-in user. A secret or
 * service-role key, a database password, or any project content must never be
 * added to this file.
 */

export const SUPABASE_URL = 'https://olqhfdpaoqvwompkqtdz.supabase.co';

/** Publishable (anon) key. Safe to ship; RLS does the real work. */
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_N3L_0PXlx5urFzkObblWIA_7qrVgq8M';

/** Shown in the shell and on the sign-in panel. */
export const APP_NAME = 'MMT Workbench';
export const APP_SUBTITLE = 'Mercer Med Tech · staff workspace';

/** Where the app lives, used to build invitation links. */
export const BASE_PATH = '/admin/';

/** Minimum password length the join and change-password forms enforce. */
export const MIN_PASSWORD = 10;

/** Rows per insert when importing a project file. Keeps requests small. */
export const IMPORT_CHUNK = 200;

/** How often a signed-in user's `last_seen_at` is refreshed. */
export const LAST_SEEN_INTERVAL_MS = 10 * 60 * 1000;

/** Activity feed page size. */
export const ACTIVITY_PAGE = 50;

/**
 * The hard upper bound on any single request to Supabase.
 *
 * Nothing the portal asks for takes anywhere near this long; the number exists
 * so that a connection Safari has quietly suspended turns into an error
 * somebody can act on instead of a skeleton that never resolves. See the note
 * at the top of `supabase.ts`.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/** How long a screen may spend loading before it gives up and offers Retry. */
export const LOAD_DEADLINE_MS = 12_000;

/** How long a load may take before the screen admits it is taking a while. */
export const SLOW_LOAD_MS = 4_000;

/** Absolute URL for an invitation, for the copy button on the People screen. */
export function joinLink(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${BASE_PATH}#/join/${token}`;
}

/** Absolute URL the password-reset email should come back to. */
export function resetRedirect(): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${BASE_PATH}#/reset`;
}
