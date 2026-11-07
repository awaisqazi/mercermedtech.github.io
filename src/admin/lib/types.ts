/**
 * Row shapes for the v2 workspace tables, the permission catalogue, and the
 * label maps every screen shares.
 *
 * Column names follow `docs/workbench-v2-plan.md` section 4 word for word,
 * which is also what `supabase/migrations/0002_workspace.sql` creates. When the
 * two disagree, the migration is the truth and this file is the bug.
 *
 * Nothing here describes real people or real work: the repository is public.
 */

/* ------------------------------------------------------------------ enums */

export type Track = 'med' | 'tech' | 'org';
export type ProjectStatus = 'active' | 'archived';
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done';
export type TaskPriority = 'normal' | 'high' | 'urgent';

export type ActivityEntity =
  | 'task'
  | 'task_item'
  | 'comment'
  | 'time_entry'
  | 'project'
  | 'profile'
  | 'role'
  | 'invitation'
  | 'month'
  | 'inquiry';

export type ActivityAction = 'created' | 'updated' | 'deleted' | 'commented' | 'closed' | 'reopened';

/** The nine tables the workspace store loads and the realtime channel carries. */
export type WorkspaceTable =
  | 'roles'
  | 'profiles'
  | 'projects'
  | 'tasks'
  | 'task_items'
  | 'task_comments'
  | 'time_entries'
  | 'hours_months'
  | 'activity';

/* ---------------------------------------------------------- permissions */

/**
 * The fixed permission catalogue. The database holds the same list in a
 * `check` constraint on `roles.permissions`; adding a key means changing both.
 */
export const PERMISSION_KEYS = [
  'tasks.create',
  'tasks.assign',
  'tasks.edit_any',
  'tasks.delete',
  'hours.log',
  'hours.view_all',
  'hours.edit_any',
  'hours.close',
  'hours.export',
  'projects.manage',
  'people.manage',
  'roles.manage',
  'inquiries.view',
  'inquiries.manage',
] as const;

export type Permission = (typeof PERMISSION_KEYS)[number];

export interface PermissionInfo {
  key: Permission;
  /** The group heading in the role editor. */
  group: 'Tasks' | 'Hours' | 'Inbox' | 'Workspace';
  /** One sentence, read beside the checkbox: "Lets you ..." is implied. */
  sentence: string;
}

/** Section 3 of the plan, in catalogue order. */
export const PERMISSIONS: readonly PermissionInfo[] = [
  {
    key: 'tasks.create',
    group: 'Tasks',
    sentence: 'Create tasks (you may always edit tasks you created or are assigned to)',
  },
  {
    key: 'tasks.assign',
    group: 'Tasks',
    sentence: 'Assign tasks to other people (anyone may take an unassigned task themselves)',
  },
  { key: 'tasks.edit_any', group: 'Tasks', sentence: "Edit, move and close anyone's task" },
  { key: 'tasks.delete', group: 'Tasks', sentence: 'Delete any task (without it: only tasks you created)' },
  { key: 'hours.log', group: 'Hours', sentence: 'Log your own hours' },
  { key: 'hours.view_all', group: 'Hours', sentence: "See everyone's hours and the team views" },
  { key: 'hours.edit_any', group: 'Hours', sentence: "Edit or delete anyone's entries" },
  { key: 'hours.close', group: 'Hours', sentence: 'Close a month (freezes its entries) and reopen it' },
  { key: 'hours.export', group: 'Hours', sentence: 'Download hours as CSV' },
  { key: 'projects.manage', group: 'Workspace', sentence: 'Create, edit and archive projects' },
  { key: 'people.manage', group: 'Workspace', sentence: 'Invite people, change their role, deactivate accounts' },
  { key: 'roles.manage', group: 'Workspace', sentence: 'Create roles and change what they allow' },
  {
    key: 'inquiries.view',
    group: 'Inbox',
    sentence: "See the inbox, including the person's name and contact details",
  },
  {
    key: 'inquiries.manage',
    group: 'Inbox',
    sentence: "Change an inquiry's status, assign it, write notes, make a task from it",
  },
];

/** The seven roles the migration seeds (`roles.key`). Only `owner` is a system role. */
export const SEEDED_ROLE_KEYS = [
  'owner',
  'administrator',
  'technology_lead',
  'instructor',
  'course_designer',
  'finance',
  'member',
] as const;

export type SeededRoleKey = (typeof SEEDED_ROLE_KEYS)[number];

/** What a new invitation offers unless someone picks otherwise. */
export const DEFAULT_ROLE_KEY: SeededRoleKey = 'member';
export const OWNER_ROLE_KEY: SeededRoleKey = 'owner';

/* ------------------------------------------------------------------- rows */

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  is_system: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  title: string | null;
  role_id: string;
  active: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export interface Invitation {
  id: string;
  token: string;
  email: string | null;
  role_id: string;
  note: string | null;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
}

/** What `invite_preview(token)` returns to a visitor who is not signed in. */
export interface InvitePreview {
  valid: boolean;
  email: string | null;
  role_name: string | null;
  inviter: string | null;
  expires_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  /** 2 to 6 capitals: 'DLT', 'WEB'. Shown in lists instead of the name. */
  code: string;
  track: Track;
  summary: string;
  status: ProjectStatus;
  lead_id: string | null;
  sort: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  /** Plain text; `**bold**` is the only markup. */
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  /** A calendar date, `YYYY-MM-DD`. */
  due: string | null;
  /** 0 to 100, manual. The checklist fraction wins when there is a checklist. */
  progress: number;
  done_at: string | null;
  sort: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskItem {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  sort: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  /** `YYYY-MM-DD`. */
  work_date: string;
  /** Quarter hours: 0.25 to 24. */
  hours: number;
  project_id: string | null;
  task_id: string | null;
  summary: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A row means the month is closed. `month` is the first of the month. */
export interface HoursMonth {
  month: string;
  closed_by: string | null;
  closed_at: string;
  note: string;
}

export interface ActivityRow {
  id: number;
  actor_id: string | null;
  entity: ActivityEntity;
  entity_id: string | null;
  task_id: string | null;
  /**
   * The person a row is about: the entry's user on time_entry rows, null
   * elsewhere. The database hides other people's hours activity from anyone
   * without hours.view_all, so the client never filters on it.
   */
  subject_id: string | null;
  action: ActivityAction;
  summary: string;
  created_at: string;
}

/** Where an inquiry came from: one of the three public forms. */
export type InquirySource = 'inquiry' | 'dlt_signup' | 'dlt_interest';
export type InquiryStatus = 'new' | 'contacted' | 'enrolled' | 'closed';

/**
 * A copy of one public form response (Google Forms stays the record). The
 * Worker inserts it through `ingest_form_response`; everything from `source`
 * to `fields` is immutable afterwards.
 */
export interface Inquiry {
  id: string;
  source: InquirySource;
  received_at: string;
  lang: 'en' | 'es';
  /** The page path the form was on. */
  page: string;
  name: string;
  /** Phone and/or email on one line. */
  contact: string;
  /** Every answer, in form order. */
  fields: Array<{ k: string; v: string }>;
  status: InquiryStatus;
  assignee_id: string | null;
  notes: string;
  task_id: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

/* ----------------------------------------------------------------- labels */

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'blocked', 'done'];
export const TASK_PRIORITIES: readonly TaskPriority[] = ['normal', 'high', 'urgent'];
export const TRACKS: readonly Track[] = ['med', 'tech', 'org'];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const TRACK_LABEL: Record<Track, string> = {
  med: 'Med',
  tech: 'Tech',
  org: 'Org',
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  archived: 'Archived',
};

export const ACTIVITY_ENTITY_LABEL: Record<ActivityEntity, string> = {
  task: 'Task',
  task_item: 'Checklist',
  comment: 'Comment',
  time_entry: 'Hours',
  project: 'Project',
  profile: 'Person',
  role: 'Role',
  invitation: 'Invitation',
  month: 'Month close',
  inquiry: 'Inquiry',
};

export const INQUIRY_SOURCES: readonly InquirySource[] = ['inquiry', 'dlt_signup', 'dlt_interest'];
export const INQUIRY_STATUSES: readonly InquiryStatus[] = ['new', 'contacted', 'enrolled', 'closed'];

export const INQUIRY_SOURCE_LABEL: Record<InquirySource, string> = {
  inquiry: 'Contact form',
  dlt_signup: 'DLT sign-up',
  dlt_interest: 'DLT interest',
};

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  enrolled: 'Enrolled',
  closed: 'Closed',
};
