/**
 * Plain queries for the screens outside a project: Today and People.
 *
 * None of these open a realtime channel. Home is the screen people leave open
 * all day, and a socket per open tab is the one thing that would push this
 * past the free tier, so it reads once and refreshes quietly when the tab
 * comes back.
 * Row level security does the filtering: a member only ever sees the projects
 * they belong to, so there is no "where am I a member" clause here.
 */
import { supabase } from './supabase';
import { timed } from './timing';
import { toAppError, logError, type AppError } from './errors';
import type {
  ActivityRow,
  GlobalRole,
  Invitation,
  Profile,
  Project,
  ProjectGrant,
  ProjectMember,
  ProjectRole,
  Report,
  Task,
} from './types';

/* ---------------------------------------------------------------- today --- */

/**
 * Today used to be one function that asked for the project list, waited, then
 * asked for tasks, members and activity together, waited, then asked for the
 * profiles: three round trips in a row before anything could be drawn, and
 * the whole thing ran twice because it depended on the profile's name. Each
 * round trip also waits on the session check inside the SDK, so on a
 * morning's first visit (token refresh first) the screen sat on skeletons for
 * several seconds.
 *
 * Now every part is its own request, all sent at once, and each section of
 * the screen draws as soon as its own part lands. Row level security already
 * limits every table to the reader's projects, so no request needs the
 * project ids from another. The project list itself comes from projects.ts,
 * which the shell has already loaded.
 */

/** Columns Today needs. Never the whole task row. */
const TASK_COLUMNS =
  'id,project_id,title,status,pri,horizon,due,owner,assignee,ws,sort,created_at,updated_at,updated_by';

const PROFILE_COLUMNS = 'id,full_name,email,title,role,last_seen_at,created_at';

/** Reports that still need work: not sent yet. */
const OPEN_REPORT_STATUSES = ['not_started', 'preparing'];

export interface TodayRequests {
  tasks: Promise<Task[]>;
  members: Promise<ProjectMember[]>;
  profiles: Promise<Profile[]>;
  activity: Promise<ActivityRow[]>;
  reports: Promise<Report[]>;
}

function rows<T>(label: string, query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  return timed(label, query).then(({ data, error }) => {
    if (error) throw error;
    return (data ?? []) as T[];
  });
}

/** Sends every request Today needs, at once. Each resolves on its own. */
export function loadToday(): TodayRequests {
  return {
    tasks: rows<Task>('today.tasks', supabase.from('tasks').select(TASK_COLUMNS).neq('status', 'done')),
    members: rows<ProjectMember>('today.members', supabase.from('project_members').select('project_id,user_id,role')),
    profiles: rows<Profile>('today.profiles', supabase.from('profiles').select(PROFILE_COLUMNS)),
    activity: rows<ActivityRow>(
      'today.activity',
      supabase.from('activity').select('*').order('id', { ascending: false }).limit(40)
    ),
    reports: rows<Report>(
      'today.reports',
      supabase
        .from('reports')
        .select('id,project_id,period,due,covers,kind,status,checks,amount')
        .in('status', OPEN_REPORT_STATUSES)
        .order('due')
        .limit(20)
    ),
  };
}

/* ------------------------------------------------------------- projects --- */

export interface NewProjectInput {
  slug: string;
  name: string;
  kind: 'grant' | 'general';
  track: 'med' | 'tech' | 'org';
  summary: string;
  config: Record<string, unknown>;
}

export async function createProject(
  input: NewProjectInput
): Promise<{ ok: boolean; project?: Project; error?: AppError }> {
  try {
    const { data, error } = await supabase.from('projects').insert(input).select('*').single();
    if (error) throw error;
    return { ok: true, project: data as Project };
  } catch (error) {
    logError('createProject', error);
    return { ok: false, error: toAppError(error, 'project') };
  }
}

export async function setProjectStatus(
  projectId: string,
  status: 'active' | 'archived'
): Promise<{ ok: boolean; error?: AppError }> {
  try {
    const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    logError('setProjectStatus', error);
    return { ok: false, error: toAppError(error) };
  }
}

/* --------------------------------------------------------------- people --- */

export interface PeopleData {
  profiles: Profile[];
  /** How many projects each person is on. */
  projectCounts: Record<string, number>;
  projects: Project[];
  invitations: Invitation[];
  error: AppError | null;
}

export async function loadPeople(): Promise<PeopleData> {
  try {
    const [profileResult, memberResult, projectResult, inviteResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('project_members').select('project_id,user_id'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
    ]);
    for (const result of [profileResult, memberResult, projectResult, inviteResult]) {
      if (result.error) throw result.error;
    }

    const counts: Record<string, number> = {};
    for (const row of (memberResult.data ?? []) as Array<{ user_id: string }>) {
      counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
    }

    return {
      profiles: (profileResult.data ?? []) as Profile[],
      projectCounts: counts,
      projects: (projectResult.data ?? []) as Project[],
      invitations: (inviteResult.data ?? []) as Invitation[],
      error: null,
    };
  } catch (error) {
    logError('loadPeople', error);
    return {
      profiles: [],
      projectCounts: {},
      projects: [],
      invitations: [],
      error: toAppError(error),
    };
  }
}

export interface NewInvitation {
  email: string | null;
  role: GlobalRole;
  project_grants: ProjectGrant[];
  note: string | null;
  /** Days from now. */
  days: number;
}

export async function createInvitation(
  input: NewInvitation
): Promise<{ ok: boolean; invitation?: Invitation; error?: AppError }> {
  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + input.days);
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email: input.email,
        role: input.role,
        project_grants: input.project_grants,
        note: input.note,
        expires_at: expires.toISOString(),
      })
      .select('*')
      .single();
    if (error) throw error;
    return { ok: true, invitation: data as Invitation };
  } catch (error) {
    logError('createInvitation', error);
    return { ok: false, error: toAppError(error, 'invitation') };
  }
}

export async function revokeInvitation(id: string): Promise<{ ok: boolean; error?: AppError }> {
  try {
    const { error } = await supabase
      .from('invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    logError('revokeInvitation', error);
    return { ok: false, error: toAppError(error) };
  }
}

/** Only an owner may do this; the database checks again. */
export async function setGlobalRole(
  userId: string,
  role: GlobalRole
): Promise<{ ok: boolean; error?: AppError }> {
  try {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    logError('setGlobalRole', error);
    return { ok: false, error: toAppError(error) };
  }
}

/** Everyone who could be added to a project, for the Members dialog. */
export async function loadAllProfiles(): Promise<Profile[]> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) throw error;
    return (data ?? []) as Profile[];
  } catch (error) {
    logError('loadAllProfiles', error);
    return [];
  }
}

export const PROJECT_ROLE_ORDER: ProjectRole[] = ['manager', 'editor', 'viewer'];
