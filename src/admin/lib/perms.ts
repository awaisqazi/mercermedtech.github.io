/**
 * What the signed-in person may do, as far as the interface is concerned.
 *
 * A role is a row with a `permissions` array; a person has one role. `can`
 * looks the person's role up in the workspace store (which realtime keeps
 * current, so a role change made by an administrator takes effect without a
 * reload) and falls back to the role auth.ts read at sign-in, so the shell can
 * decide what to show before the store has loaded.
 *
 * This is a mirror, not the lock. Every rule here is enforced again by row
 * level security; a control hidden by mistake is an inconvenience, a control
 * shown by mistake is refused by the database and rolled back.
 *
 *   can('tasks.assign')          outside components (event handlers, helpers)
 *   useCan('tasks.assign')       inside components; re-renders on role change
 *   useMyRole()                  the Role row, or null before it is known
 */
import { useAuth, getAuth, type AuthState } from './auth';
import { getWorkspace, useWorkspaceSlice, type WorkspaceState } from './workspace';
import { OWNER_ROLE_KEY, type Permission, type Role } from './types';

/** The role row for the signed-in person, from the freshest copy there is. */
export function myRole(state: WorkspaceState = getWorkspace(), auth: AuthState = getAuth()): Role | null {
  const me = auth.userId;
  if (!me) return null;
  const profile = state.profiles.find((row) => row.id === me) ?? auth.profile;
  if (!profile) return null;
  return state.roles.find((role) => role.id === profile.role_id) ?? auth.role ?? null;
}

/** True when a role allows a permission. The owner role allows everything. */
export function roleAllows(role: Role | null | undefined, key: Permission): boolean {
  if (!role) return false;
  if (role.key === OWNER_ROLE_KEY) return true;
  return Array.isArray(role.permissions) && role.permissions.includes(key);
}

export function can(key: Permission): boolean {
  return roleAllows(myRole(), key);
}

export function useMyRole(): Role | null {
  const auth = useAuth();
  return useWorkspaceSlice((state) => myRole(state, auth), [auth.userId, auth.profile, auth.role]);
}

export function useCan(key: Permission): boolean {
  return roleAllows(useMyRole(), key);
}

/** For a screen that needs any one of several (Settings: projects or roles). */
export function useCanAny(...keys: Permission[]): boolean {
  const role = useMyRole();
  return keys.some((key) => roleAllows(role, key));
}
