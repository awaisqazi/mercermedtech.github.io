/**
 * Turns whatever Supabase, PostgREST or Postgres hands back into one plain
 * sentence a colleague can act on, and tells the caller when the problem is a
 * permission one (so the view can flip to read-only instead of retrying).
 *
 * The database may not be migrated yet while the portal is being built, so the
 * "table does not exist" and "function does not exist" cases get their own
 * wording rather than a generic failure.
 */

export interface AppError {
  /** One sentence, no jargon, safe to show in a toast. */
  message: string;
  /** True when the user simply is not allowed to do this. */
  permission: boolean;
  /** True when the database has not been set up yet. */
  missingSchema: boolean;
  /** True when the browser could not reach Supabase at all. */
  offline: boolean;
  /** The original, for the console. Never shown. */
  cause?: unknown;
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  error_description?: string;
  name?: string;
}

const PERMISSION_CODES = new Set([
  '42501', // insufficient_privilege — an RLS policy said no
  'PGRST301', // JWT expired / not authorised
  'PGRST116', // no rows returned where one was required (often RLS hiding it)
]);

const MISSING_SCHEMA_CODES = new Set([
  '42P01', // undefined_table
  '42883', // undefined_function
  '42703', // undefined_column
  'PGRST202', // function not found in the schema cache
  'PGRST205', // table not found in the schema cache
]);

function asError(input: unknown): SupabaseLikeError {
  if (!input || typeof input !== 'object') return { message: String(input ?? '') };
  return input as SupabaseLikeError;
}

/** Normalises anything thrown or returned into an AppError. */
export function toAppError(input: unknown, context?: string): AppError {
  const error = asError(input);
  const raw = (error.message || error.error_description || '').trim();
  const code = error.code || '';
  const lower = raw.toLowerCase();

  /*
   * A stall and a refusal look different to a browser but identical to a
   * reader: nothing came back. Safari in particular leaves suspended requests
   * hanging rather than failing them, so the deadline in `supabase.ts` and the
   * one in `deadline.ts` both land here.
   */
  const timedOut =
    error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    (input as { timeout?: boolean } | null)?.timeout === true ||
    lower.includes('did not answer within') ||
    lower.includes('taking longer than');

  if (timedOut) {
    return {
      message: 'The server did not answer. The connection may have stalled. Try again.',
      permission: false,
      missingSchema: false,
      offline: true,
      cause: input,
    };
  }

  const offline =
    error.name === 'TypeError' ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed');

  if (offline) {
    return {
      message: 'Cannot reach the server. Check the connection and try again.',
      permission: false,
      missingSchema: false,
      offline: true,
      cause: input,
    };
  }

  const missingSchema =
    MISSING_SCHEMA_CODES.has(code) ||
    lower.includes('does not exist') ||
    lower.includes('could not find the table') ||
    lower.includes('schema cache');

  if (missingSchema) {
    return {
      message:
        'This part of the database has not been set up yet. An administrator needs to run the migration.',
      permission: false,
      missingSchema: true,
      offline: false,
      cause: input,
    };
  }

  const permission =
    PERMISSION_CODES.has(code) ||
    error.status === 401 ||
    error.status === 403 ||
    lower.includes('row-level security') ||
    lower.includes('row level security') ||
    lower.includes('permission denied') ||
    lower.includes('violates row-level');

  if (permission) {
    return {
      message: 'Your role does not allow that. Ask an administrator if you need it.',
      permission: true,
      missingSchema: false,
      offline: false,
      cause: input,
    };
  }

  return {
    message: plainMessage(raw, code, context),
    permission: false,
    missingSchema: false,
    offline: false,
    cause: input,
  };
}

function plainMessage(raw: string, code: string, context?: string): string {
  const lower = raw.toLowerCase();

  // Auth
  if (lower.includes('invalid login credentials')) {
    return 'That email and password do not match. Try again, or use "Forgot password".';
  }
  if (lower.includes('email not confirmed')) {
    return 'That account still needs to be confirmed. Ask an administrator.';
  }
  if (lower.includes('user already registered') || code === '23505') {
    if (lower.includes('already registered') || lower.includes('users_email')) {
      return 'There is already an account for that email address. Sign in instead.';
    }
    return duplicateMessage(raw, context);
  }
  if (lower.includes('password should be') || lower.includes('password is too short')) {
    return 'That password is too short. Use at least 10 characters.';
  }
  if (lower.includes('same_password') || lower.includes('should be different from the old')) {
    return 'The new password has to be different from the old one.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('over_email_send')) {
    return 'Too many attempts just now. Wait a few minutes and try again.';
  }
  if (lower.includes('token has expired') || lower.includes('invalid token') || lower.includes('otp_expired')) {
    return 'That link has expired. Ask for a new one.';
  }
  if (lower.includes('session') && lower.includes('missing')) {
    return 'The sign-in session ended. Sign in again.';
  }

  // The signup trigger's own messages, raised by the invitation check.
  if (lower.includes('invitation')) {
    if (lower.includes('email')) return "This invitation isn't valid for that email address.";
    return 'This invitation is not valid any more. Ask an administrator for a new link.';
  }

  // Constraints
  if (code === '23503') return 'That refers to something that no longer exists. Reload and try again.';
  if (code === '23514') return 'One of those values is not allowed. Check the form and try again.';
  if (code === '22P02') return 'One of those values is in the wrong format.';
  if (code === '23502') return 'Something required was left blank.';

  if (!raw) return context ? `${context} did not work. Try again.` : 'That did not work. Try again.';
  // Last resort: show the server's own sentence, capitalised.
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function duplicateMessage(raw: string, context?: string): string {
  if (raw.includes('projects_code')) return 'A project already uses that code. Pick another.';
  if (raw.includes('roles_key')) return 'A role already uses that short name. Pick another.';
  if (raw.includes('hours_months')) return 'That month is already closed.';
  return context ? `That ${context} already exists.` : 'That already exists.';
}

/** Convenience for `if (error) throw ...` call sites. */
export function errorMessage(input: unknown, context?: string): string {
  return toAppError(input, context).message;
}

export function isPermissionError(input: unknown): boolean {
  return toAppError(input).permission;
}

export function isMissingSchemaError(input: unknown): boolean {
  return toAppError(input).missingSchema;
}

/**
 * PostgREST refusing a token whose "issued at" is a moment ahead of its own
 * clock (PGRST303). It happens right after a refresh when Supabase's auth and
 * API nodes disagree by a second; the same request a moment later goes through.
 */
export function isClockSkewError(input: unknown): boolean {
  const error = asError(input);
  return error.code === 'PGRST303' || (error.message || '').toLowerCase().includes('issued at future');
}

/** Logs the original for a developer without ever showing it to the user. */
export function logError(where: string, input: unknown): void {
  if (typeof console !== 'undefined') console.error(`[workbench] ${where}`, input);
}
