/**
 * Who is signed in, and everything that changes that.
 *
 * One store holds the Supabase session plus the matching `profiles` row. It is
 * created once, listens to `onAuthStateChange` for the life of the page, and
 * every screen reads it through `useAuth()`.
 *
 * There are no sign-up forms: an account can only be created by following an
 * invitation link, and the database trigger on `auth.users` rejects a signup
 * whose `invite_token` does not match a live invitation.
 */
import { supabase } from './supabase';
import { LAST_SEEN_INTERVAL_MS, MIN_PASSWORD, resetRedirect } from './config';
import { observable, useObservable } from './observable';
import { toAppError, logError, type AppError } from './errors';
import type { GlobalRole, InvitePreview, Profile } from './types';

export interface AuthState {
  /** false until the SDK has told us whether there is a stored session. */
  ready: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  /** Set when the profile could not be loaded (for example before migration). */
  profileError: AppError | null;
  /** True while a recovery link is being turned into a password change. */
  recovery: boolean;
}

const initial: AuthState = {
  ready: false,
  userId: null,
  email: null,
  profile: null,
  profileError: null,
  recovery: false,
};

const store = observable<AuthState>(initial);

export function getAuth(): AuthState {
  return store.get();
}

export function useAuth(): AuthState {
  return useObservable(store);
}

/* ---------------------------------------------------------------- helpers */

export function isAdmin(state: AuthState = store.get()): boolean {
  const role = state.profile?.role;
  return role === 'admin' || role === 'owner';
}

export function isOwner(state: AuthState = store.get()): boolean {
  return state.profile?.role === 'owner';
}

export function displayName(state: AuthState = store.get()): string {
  return state.profile?.full_name?.trim() || state.email || 'Signed in';
}

/* -------------------------------------------------------- profile loading */

let profileRequest: Promise<void> | null = null;

async function loadProfile(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logError('loadProfile', error);
    store.update((state) => ({ ...state, profileError: toAppError(error) }));
    return;
  }
  store.update((state) => ({
    ...state,
    profile: (data as Profile | null) ?? null,
    profileError: null,
  }));
}

/** Re-reads the signed-in user's own profile row. */
export async function refreshProfile(): Promise<void> {
  const { userId } = store.get();
  if (!userId) return;
  await loadProfile(userId);
}

/* ------------------------------------------------------------- last seen */

let lastTouch = 0;

/**
 * Records that the user is around, at most once every ten minutes. Failures
 * are swallowed: this is a nicety, not something worth a toast.
 */
export async function touchLastSeen(): Promise<void> {
  const { userId } = store.get();
  if (!userId) return;
  const now = Date.now();
  if (now - lastTouch < LAST_SEEN_INTERVAL_MS) return;
  lastTouch = now;
  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) logError('touchLastSeen', error);
}

/* ------------------------------------------------------------ the listener */

let started = false;

/** Called once by AdminApp. Safe to call again. */
export function startAuth(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user ?? null;
    const previousId = store.get().userId;

    store.update((state) => ({
      ...state,
      ready: true,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      profile: user?.id === previousId ? state.profile : null,
      profileError: null,
      recovery: event === 'PASSWORD_RECOVERY' ? true : state.recovery,
    }));

    if (user && user.id !== previousId) {
      profileRequest = loadProfile(user.id);
      void profileRequest;
      lastTouch = 0;
      void touchLastSeen();
    }
    if (!user) {
      lastTouch = 0;
    }
  });

  // getSession resolves from storage immediately and also settles `ready` when
  // there is no stored session at all (onAuthStateChange fires INITIAL_SESSION
  // in current SDKs, but this keeps the screen from hanging on older ones).
  void supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) logError('getSession', error);
      const user = data.session?.user ?? null;
      store.update((state) => ({
        ...state,
        ready: true,
        userId: state.userId ?? user?.id ?? null,
        email: state.email ?? user?.email ?? null,
      }));
      if (user && !store.get().profile) void loadProfile(user.id);
    })
    .catch((error) => {
      logError('getSession', error);
      store.update((state) => ({ ...state, ready: true }));
    });
}

/** Waits for the profile fetch that a sign-in kicked off, if there is one. */
export async function settleProfile(): Promise<void> {
  if (profileRequest) await profileRequest.catch(() => undefined);
}

/* ------------------------------------------------------------- the actions */

export interface Result {
  ok: boolean;
  error?: AppError;
}

const ok: Result = { ok: true };
const fail = (input: unknown, context?: string): Result => ({
  ok: false,
  error: toAppError(input, context),
});

export async function signIn(email: string, password: string): Promise<Result> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return fail(error);
    await settleProfile();
    return ok;
  } catch (error) {
    return fail(error);
  }
}

export async function signOut(scope: 'local' | 'global' = 'local'): Promise<Result> {
  try {
    const { error } = await supabase.auth.signOut({ scope });
    if (error) return fail(error);
    store.set({ ...initial, ready: true });
    return ok;
  } catch (error) {
    return fail(error);
  }
}

/** Reads an invitation without being signed in. Never throws. */
export async function previewInvite(token: string): Promise<InvitePreview> {
  try {
    const { data, error } = await supabase.rpc('invite_preview', { p_token: token });
    if (error) {
      logError('invite_preview', error);
      return { valid: false, email: null, role: null, inviter: null, expires_at: null };
    }
    // The function returns a single row; PostgREST may hand it back as one.
    const row = (Array.isArray(data) ? data[0] : data) as Partial<InvitePreview> | null;
    return {
      valid: Boolean(row?.valid),
      email: row?.email ?? null,
      role: (row?.role as GlobalRole | null) ?? null,
      inviter: row?.inviter ?? null,
      expires_at: row?.expires_at ?? null,
    };
  } catch (error) {
    logError('invite_preview', error);
    return { valid: false, email: null, role: null, inviter: null, expires_at: null };
  }
}

export interface JoinInput {
  token: string;
  email: string;
  password: string;
  fullName: string;
}

/**
 * Creates the account. The `invite_token` in the user metadata is what the
 * database trigger checks; if it does not match a live invitation the whole
 * signup is rolled back and the error comes back here.
 */
export async function joinWithInvite(input: JoinInput): Promise<Result> {
  if (input.password.length < MIN_PASSWORD) {
    return {
      ok: false,
      error: toAppError({ message: `Password should be at least ${MIN_PASSWORD} characters.` }),
    };
  }
  try {
    const { error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          invite_token: input.token,
          full_name: input.fullName.trim(),
        },
      },
    });
    if (error) return fail(error);
    await settleProfile();
    return ok;
  } catch (error) {
    return fail(error);
  }
}

/** Sends the one email the portal ever sends. */
export async function requestPasswordReset(email: string): Promise<Result> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetRedirect(),
    });
    if (error) return fail(error);
    return ok;
  } catch (error) {
    return fail(error);
  }
}

/** Used both by the reset screen and by Account. */
export async function changePassword(password: string): Promise<Result> {
  if (password.length < MIN_PASSWORD) {
    return {
      ok: false,
      error: toAppError({ message: `Password should be at least ${MIN_PASSWORD} characters.` }),
    };
  }
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return fail(error);
    store.update((state) => ({ ...state, recovery: false }));
    return ok;
  } catch (error) {
    return fail(error);
  }
}

/** Saves the parts of your own profile you are allowed to change. */
export async function updateOwnProfile(patch: {
  full_name?: string;
  title?: string;
}): Promise<Result> {
  const { userId } = store.get();
  if (!userId) return fail({ message: 'Session missing.' });
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (error) return fail(error);
    if (data) store.update((state) => ({ ...state, profile: data as Profile }));
    return ok;
  } catch (error) {
    return fail(error);
  }
}

/** Clears the "you arrived here from a recovery link" flag. */
export function clearRecovery(): void {
  store.update((state) => ({ ...state, recovery: false }));
}
