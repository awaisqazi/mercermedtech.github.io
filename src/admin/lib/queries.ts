/**
 * Plain queries for the screens outside a project: Home, Projects and People.
 *
 * None of these open a realtime channel. Home is the screen people leave open
 * all day, and a socket per open tab is the one thing that would push this
 * past the free tier, so it reads once and refreshes when the tab comes back.
 * Row level security does the filtering: a member only ever sees the projects
 * they belong to, so there is no "where am I a member" clause here.
 */
import { supabase } from './supabase';
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
  Task,
} from './types';

export interface ProjectSummary {
  project: Project;
  total: number;
  open: number;
  done: number;
  overdue: number;
  critical: number;
  /** The soonest due date among the open tasks. */
  nextDue: string | null;
  members: ProjectMember[];
}

export interface HomeData {
  projects: ProjectSummary[];
  profiles: Record<string, Profile>;
  /** Not-done tasks assigned to me, or whose owner label carries my first name. */
  mine: Task[];
  attention: Task[];
  activity: ActivityRow[];
  error: AppError | null;
}

/** Columns Home and Projects need. Never the whole task row. */
const TASK_COLUMNS =
  'id,project_id,title,status,pri,horizon,due,owner,assignee,ws,sort,created_at,updated_at';

export async function loadHome(userId: string | null, myName: string): Promise<HomeData> {
  const empty: HomeData = {
    projects: [],
    profiles: {},
    mine: [],
    attention: [],
    activity: [],
    error: null,
  };

  try {
    const projectResult = await supabase
      .from('projects')
      .select('*')
      .order('status')
      .order('name');
    if (projectResult.error) throw projectResult.error;
    const projects = (projectResult.data ?? []) as Project[];
    if (!projects.length) return empty;

    const ids = projects.map((project) => project.id);

    const [taskResult, memberResult, activityResult] = await Promise.all([
      supabase.from('tasks').select(TASK_COLUMNS).in('project_id', ids),
      supabase.from('project_members').select('*').in('project_id', ids),
      supabase
        .from('activity')
        .select('*')
        .in('project_id', ids)
        .order('id', { ascending: false })
        .limit(15),
    ]);
    for (const result of [taskResult, memberResult, activityResult]) {
      if (result.error) throw result.error;
    }

    const tasks = (taskResult.data ?? []) as Task[];
    const members = (memberResult.data ?? []) as ProjectMember[];
    const activity = (activityResult.data ?? []) as ActivityRow[];

    const profileIds = new Set<string>();
    for (const member of members) profileIds.add(member.user_id);
    for (const row of activity) if (row.user_id) profileIds.add(row.user_id);

    const profiles: Record<string, Profile> = {};
    if (profileIds.size) {
      const profileResult = await supabase.from('profiles').select('*').in('id', [...profileIds]);
      if (profileResult.error) throw profileResult.error;
      for (const row of (profileResult.data ?? []) as Profile[]) profiles[row.id] = row;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const summaries: ProjectSummary[] = projects.map((project) => {
      const own = tasks.filter((task) => task.project_id === project.id);
      const open = own.filter((task) => task.status !== 'done');
      const overdue = open.filter((task) => task.due && task.due < todayIso);
      const dues = open
        .map((task) => task.due)
        .filter((due): due is string => Boolean(due))
        .sort();
      return {
        project,
        total: own.length,
        open: open.length,
        done: own.length - open.length,
        overdue: overdue.length,
        critical: open.filter((task) => task.pri === 'critical').length,
        nextDue: dues[0] ?? null,
        members: members.filter((member) => member.project_id === project.id),
      };
    });

    const first = (myName || '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const mine = tasks.filter((task) => {
      if (task.status === 'done') return false;
      if (userId && task.assignee === userId) return true;
      return Boolean(first) && task.owner.toLowerCase().includes(first);
    });

    const attention = tasks
      .filter(
        (task) =>
          task.status !== 'done' &&
          (task.pri === 'critical' || task.status === 'blocked' || (task.due && task.due < todayIso))
      )
      .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
      .slice(0, 8);

    return { projects: summaries, profiles, mine, attention, activity, error: null };
  } catch (error) {
    logError('loadHome', error);
    return { ...empty, error: toAppError(error) };
  }
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
