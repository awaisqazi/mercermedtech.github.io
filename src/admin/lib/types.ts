/**
 * Row shapes for every table in the `public` schema, plus the JSON payloads
 * stored inside them. These mirror `supabase/migrations/0001_admin_portal.sql`
 * (written by another engineer) and ARCHITECTURE.md. Nothing project-specific
 * belongs here: `ProjectConfig` describes the *shape* of a grant's settings,
 * never the values of any actual grant.
 */

/* ------------------------------------------------------------------ enums */

export type GlobalRole = 'owner' | 'admin' | 'member';
export type ProjectRole = 'manager' | 'editor' | 'viewer';
export type ProjectKind = 'grant' | 'general';
export type Track = 'med' | 'tech' | 'org';
export type ProjectStatus = 'active' | 'archived';

export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done';
export type TaskPriority = 'critical' | 'high' | 'normal';
export type Horizon = 'now' | 'next' | 'later';

export type ReportKind = 'monthly' | 'closeout';
export type ReportStatus =
  | 'not_started'
  | 'preparing'
  | 'submitted'
  | 'returned'
  | 'approved'
  | 'paid';

export type PartnerStage =
  | 'not_contacted'
  | 'contacted'
  | 'meeting_held'
  | 'referring'
  | 'paused';

export type CommentEntity = 'task' | 'report' | 'partner' | 'doc';
export type ActivityAction = 'created' | 'updated' | 'deleted' | 'commented';

/** Tables the project store keeps in memory and subscribes to. */
export type ContentTable =
  | 'tasks'
  | 'reports'
  | 'partners'
  | 'project_state'
  | 'project_docs'
  | 'comments'
  | 'activity';

/* ------------------------------------------------------- shared JSON bits */

export type SourceKind = 'onedrive' | 'gdrive' | 'gmail' | 'web' | 'other';

/**
 * A pointer to where an original document lives. The portal never hosts files;
 * it only remembers where to look.
 */
export interface Source {
  kind: SourceKind;
  name: string;
  where: string;
  note?: string;
}

/** A block of a document body. Text is plain; `**bold**` is the only markup. */
export type DocBlock =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'kv'; rows: Array<[string, string]> }
  | { t: 'note'; text: string };

export type DocBlockType = DocBlock['t'];

/* ------------------------------------------------------------------- rows */

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  title: string | null;
  role: GlobalRole;
  created_at: string;
  last_seen_at: string | null;
}

/** One project grant carried on an invitation. */
export interface ProjectGrant {
  project_id: string;
  role: ProjectRole;
}

export interface Invitation {
  id: string;
  token: string;
  email: string | null;
  role: GlobalRole;
  project_grants: ProjectGrant[];
  note: string | null;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
}

/** What `invite_preview(token)` returns to an anonymous visitor. */
export interface InvitePreview {
  valid: boolean;
  email: string | null;
  role: GlobalRole | null;
  inviter: string | null;
  expires_at: string | null;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  kind: ProjectKind;
  track: Track;
  summary: string | null;
  status: ProjectStatus;
  config: ProjectConfig;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  added_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  ws: string;
  status: TaskStatus;
  pri: TaskPriority;
  horizon: Horizon;
  due: string | null;
  /** Free-text owner label, kept alongside the linked assignee. */
  owner: string;
  assignee: string | null;
  why: string;
  done_when: string;
  notes: string;
  recurring: string;
  sources: Source[];
  sort: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  project_id: string;
  /** The month the report is DUE, as `YYYY-MM`. */
  period: string;
  due: string | null;
  covers: string | null;
  kind: ReportKind;
  status: ReportStatus;
  /** Keyed by `config.report_checks[].key`. */
  checks: Record<string, boolean>;
  amount: number | null;
  submitted_on: string | null;
  notes: string;
  sources: Source[];
  updated_by: string | null;
  updated_at: string;
}

export interface Partner {
  id: string;
  project_id: string;
  name: string;
  county: string;
  kind: string;
  stage: PartnerStage;
  contact: string;
  next_step: string;
  notes: string;
  referrals: number;
  sort: number;
  updated_by: string | null;
  updated_at: string;
}

/** A free-form bag of numbers per project, keyed (`metrics`, `budget`, …). */
export interface ProjectStateRow {
  project_id: string;
  key: string;
  data: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
}

export interface ProjectDoc {
  id: string;
  project_id: string;
  /** `about` · `rulebook` · `notes` · `notes:<tab>` */
  section: string;
  slug: string;
  title: string;
  body: DocBlock[];
  sources: Source[];
  sort: number;
  updated_by: string | null;
  updated_at: string;
}

export interface Comment {
  id: string;
  project_id: string;
  entity: CommentEntity;
  entity_id: string;
  body: string;
  user_id: string;
  created_at: string;
}

export interface ActivityRow {
  id: number;
  project_id: string;
  user_id: string | null;
  entity: string;
  entity_id: string | null;
  action: ActivityAction;
  summary: string;
  created_at: string;
}

/* ------------------------------------------------- project configuration */

export interface WorkstreamDef {
  key: string;
  label: string;
}

export interface ReportCheckDef {
  key: string;
  label: string;
}

export interface BudgetLineDef {
  id: string;
  label: string;
  category: string;
  amount: number;
}

export interface BudgetCategoryDef {
  name: string;
  total: number;
  rule: 'flex' | 'decrease_only';
}

export interface FunnelStepDef {
  key: string;
  label: string;
}

/**
 * Everything the grant views need, so that nothing about any particular grant
 * is hardcoded in this public repo. Every field is optional: a project may be
 * set up gradually, and a `general` project carries almost none of it.
 */
export interface ProjectConfig {
  funder?: string;
  contract_no?: string;
  award?: number;
  /** `YYYY-MM-DD` */
  term_start?: string;
  term_end?: string;
  targets?: Record<string, number>;
  milestones?: Record<string, string>;
  workstreams?: WorkstreamDef[];
  counties?: string[];
  partner_kinds?: string[];
  report_checks?: ReportCheckDef[];
  budget_lines?: BudgetLineDef[];
  budget_categories?: BudgetCategoryDef[];
  funnel?: FunnelStepDef[];
  [key: string]: unknown;
}

/* ------------------------------------------------------- import / export */

/** A row as it appears in an import file: no ids, no audit columns. */
export type TaskImport = Partial<
  Pick<
    Task,
    | 'title'
    | 'ws'
    | 'status'
    | 'pri'
    | 'horizon'
    | 'due'
    | 'owner'
    | 'why'
    | 'done_when'
    | 'notes'
    | 'recurring'
    | 'sources'
    | 'sort'
  >
>;

export type ReportImport = Partial<
  Pick<
    Report,
    | 'period'
    | 'due'
    | 'covers'
    | 'kind'
    | 'status'
    | 'checks'
    | 'amount'
    | 'submitted_on'
    | 'notes'
    | 'sources'
  >
>;

export type PartnerImport = Partial<
  Pick<
    Partner,
    | 'name'
    | 'county'
    | 'kind'
    | 'stage'
    | 'contact'
    | 'next_step'
    | 'notes'
    | 'referrals'
    | 'sort'
  >
>;

export type DocImport = Partial<
  Pick<ProjectDoc, 'section' | 'slug' | 'title' | 'body' | 'sources' | 'sort'>
>;

export interface ProjectFileHeader {
  slug: string;
  name: string;
  kind: ProjectKind;
  track?: Track;
  summary?: string;
  config?: ProjectConfig;
}

/** The `mmt-project/1` interchange file, used by both import and export. */
export interface ProjectFile {
  format: 'mmt-project/1';
  project: ProjectFileHeader;
  tasks?: TaskImport[];
  reports?: ReportImport[];
  partners?: PartnerImport[];
  state?: Record<string, Record<string, unknown>>;
  docs?: DocImport[];
}

export const PROJECT_FILE_FORMAT = 'mmt-project/1';

/* --------------------------------------------------------- display names */

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
};

export const HORIZON_LABEL: Record<Horizon, string> = {
  now: 'Now',
  next: 'Next',
  later: 'Later',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  not_started: 'Not started',
  preparing: 'Preparing',
  submitted: 'Submitted',
  returned: 'Returned',
  approved: 'Approved',
  paid: 'Paid',
};

export const PARTNER_STAGE_LABEL: Record<PartnerStage, string> = {
  not_contacted: 'Not contacted',
  contacted: 'Contacted',
  meeting_held: 'Meeting held',
  referring: 'Referring',
  paused: 'Paused',
};

export const GLOBAL_ROLE_LABEL: Record<GlobalRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  member: 'Member',
};

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  manager: 'Manager',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  onedrive: 'OneDrive',
  gdrive: 'Google Drive',
  gmail: 'Email',
  web: 'Web',
  other: 'Other',
};

export const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'blocked', 'done'];
export const TASK_PRIORITIES: TaskPriority[] = ['critical', 'high', 'normal'];
export const HORIZONS: Horizon[] = ['now', 'next', 'later'];
export const REPORT_STATUSES: ReportStatus[] = [
  'not_started',
  'preparing',
  'submitted',
  'returned',
  'approved',
  'paid',
];
export const PARTNER_STAGES: PartnerStage[] = [
  'not_contacted',
  'contacted',
  'meeting_held',
  'referring',
  'paused',
];
export const SOURCE_KINDS: SourceKind[] = ['onedrive', 'gdrive', 'gmail', 'web', 'other'];
