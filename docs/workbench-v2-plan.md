# MMT Workbench v2: the staff collaboration workspace

Plan of record for replacing the grant-centred portal at `/admin/` with a
workspace the whole MMT team uses every day: log hours, say what got done,
hand each other tasks, watch progress, and run the people and roles behind it.
Supabase stays the backend. The repository is public, so this plan, like the
code, carries no staff names, grant figures or business data.

Sections 1 to 9 are the design. Section 10 is the work, cut into chunks that
agents build in parallel. Section 11 is how it gets checked.

---

## 1. What it is for

Five kinds of people share it: the instructor, the administrator, the
technology lead, the course designer and finance. More roles will come, each
with its own permissions, and the owner adds them from inside the tool.

Every day the workspace answers four questions:

1. What should I do next? (my tasks, soonest first)
2. What did everyone do? (hours logged, with a one-line summary each)
3. Where does each task stand? (status, checklist progress, comments)
4. Who is on the team, and what may they do? (people, roles)

Principles, in order:

- **Simple.** Five places to go: Home, Tasks, Hours, People, Settings. Every
  screen does one thing. Rich detail lives in a drawer or dialog, never on the
  surface.
- **Intuitive.** Logging hours takes four fields and ten seconds. Assigning a
  task is a picker on the task. Progress is visible without opening anything.
- **On brand.** The "Two paths" visual language of the public site (paper and
  ink, Fraunces headlines, Plus Jakarta Sans text, thin rules, the bracket as
  the one motif, Med teal and Tech indigo as structure not decoration). No
  AI-template tells: no accent-border callouts, no icon pills, no glass, no
  gradient blobs, no cards inside cards.
- **Honest.** Everything is enforced in the database (row level security) and
  merely reflected in the interface. Hiding a button is never the security.

## 2. What goes, what stays

**Removed** (the grant portal): projects as the organising unit, the Plan /
Reports / Partners / Numbers tabs, project docs, report checklists, budget and
outcome numbers, partner pipeline, project membership roles, the JSON
import/export, the About panel and Rulebook. The data is not deleted: see
section 6.

**Kept and reused** (it works and is tested): invite-only sign-up through the
`auth.users` trigger, the Supabase client with its Safari-safe fetch deadline,
the auth store, hash router, observable store pattern, toasts, theme switch,
the generic components (Button, Field, Select, Dialog, Modal, Menu, Popover,
Avatar, Chip, Tabs, Skeleton, EmptyState, ConfirmDialog, CopyField), the
`#/demo` in-memory client, the WebKit smoke test, and the keep-alive workflow.

**New**: roles with editable permissions, time entries, a month close for
finance, tasks with checklists and progress, a workspace-wide realtime channel,
and five rebuilt screens.

The name stays **MMT Workbench**, the address stays `/admin/`.

## 3. Roles and permissions

A role is a named set of permissions. Permissions are a fixed catalogue in the
database (a `check` constraint) and in `types.ts`; roles are rows anyone with
`roles.manage` can create, rename and edit. Every signed-in person has exactly
one role.

Everyone with an active account can, without any permission: see tasks,
projects, the people directory and the activity feed; comment on tasks; see
their own hours; edit their own name, title and password.

| Key | Lets you |
| --- | --- |
| `tasks.create` | Create tasks (you may always edit tasks you created or are assigned to) |
| `tasks.assign` | Assign tasks to other people (anyone may take an unassigned task themselves) |
| `tasks.edit_any` | Edit, move and close anyone's task |
| `tasks.delete` | Delete any task (without it: only tasks you created) |
| `hours.log` | Log your own hours |
| `hours.view_all` | See everyone's hours and the team views |
| `hours.edit_any` | Edit or delete anyone's entries |
| `hours.close` | Close a month (freezes its entries) and reopen it |
| `hours.export` | Download hours as CSV |
| `projects.manage` | Create, edit and archive projects |
| `people.manage` | Invite people, change their role, deactivate accounts |
| `roles.manage` | Create roles and change what they allow |

Seeded roles (`roles.key`), all editable later except `owner`:

| Key | Name | Permissions |
| --- | --- | --- |
| `owner` | Owner | all; `is_system = true`; cannot be edited or deleted; there is always at least one active owner |
| `administrator` | Administrator | all |
| `technology_lead` | Technology lead | tasks.create, tasks.assign, tasks.edit_any, tasks.delete, hours.log, hours.view_all, projects.manage |
| `instructor` | Instructor | tasks.create, tasks.assign, hours.log |
| `course_designer` | Course designer | tasks.create, tasks.assign, hours.log |
| `finance` | Finance | tasks.create, tasks.assign, hours.log, hours.view_all, hours.edit_any, hours.close, hours.export |
| `member` | Team member | tasks.create, hours.log (the default for a new invitation) |

Old global roles map on migration: owner → owner, admin → administrator,
member → member.

Rules enforced in SQL regardless of role:

- Only an owner may give or take the `owner` role; nobody may invite an owner.
- A person cannot change their own role or deactivate themselves.
- The last active owner cannot be deactivated, demoted or deleted.
- A `is_system` role's permissions and key cannot change; a role in use cannot
  be deleted (reassign people first).

## 4. Data model

All in `public`. Every table: RLS enabled **and forced**; `anon` has no table
grants; `authenticated` gets DML and the policies decide. Audit columns are
stamped by the existing `set_audit()` trigger pattern. `uuid` keys come from
`gen_random_uuid()`. Timestamps are `timestamptz`.

```
roles
  id uuid pk
  key text unique not null          -- 'owner', 'instructor', ... ; snake_case, immutable once is_system
  name text not null
  description text not null default ''
  permissions text[] not null default '{}'   -- each element checked against the catalogue
  is_system boolean not null default false
  sort integer not null default 100
  created_at, updated_at timestamptz

profiles   (existing table, altered)
  id uuid pk -> auth.users
  email text
  full_name text
  title text
  role_id uuid not null -> roles           -- replaces the old `role` enum column (dropped after backfill)
  active boolean not null default true
  created_at, last_seen_at timestamptz

invitations   (existing table, altered)
  id uuid pk, token text unique
  email text null
  role_id uuid not null -> roles           -- replaces `role` + `project_grants`
  note text
  invited_by uuid -> profiles
  created_at, expires_at (default now()+14 days), accepted_at, accepted_by, revoked_at

projects
  id uuid pk
  name text not null
  code text unique not null         -- short label shown in lists: 'DLT', 'WEB', 'FIN' (2..6 chars, upper)
  track text not null check in ('med','tech','org') default 'org'
  summary text not null default ''
  status text not null check in ('active','archived') default 'active'
  lead_id uuid null -> profiles
  sort integer not null default 100
  created_by, updated_by, created_at, updated_at

tasks
  id uuid pk
  project_id uuid null -> projects (on delete set null)
  title text not null check (length between 1 and 200)
  description text not null default ''
  status text not null check in ('todo','doing','blocked','done') default 'todo'
  priority text not null check in ('normal','high','urgent') default 'normal'
  assignee_id uuid null -> profiles
  due date null
  progress smallint not null default 0 check 0..100   -- manual; overwritten from the checklist when one exists
  done_at timestamptz null                            -- set by trigger when status becomes 'done'
  sort integer not null default 0                     -- board/list order; max(sort)+10, never Date.now()
  created_by, updated_by, created_at, updated_at

task_items          -- the checklist
  id uuid pk
  task_id uuid not null -> tasks (on delete cascade)
  text text not null
  done boolean not null default false
  sort integer not null default 0
  created_by, updated_by, created_at, updated_at

task_comments       -- immutable; delete your own
  id uuid pk
  task_id uuid not null -> tasks (on delete cascade)
  user_id uuid not null -> profiles   (stamped by trigger, never trusted from the client)
  body text not null check (length between 1 and 4000)
  created_at

time_entries
  id uuid pk
  user_id uuid not null -> profiles   (must equal current_uid() on insert unless hours.edit_any)
  work_date date not null
  hours numeric(5,2) not null check (hours > 0 and hours <= 24 and hours*4 = floor(hours*4))  -- quarter hours
  project_id uuid null -> projects (on delete set null)
  task_id uuid null -> tasks (on delete set null)
  summary text not null check (length between 1 and 1000)   -- what was done
  created_by, updated_by, created_at, updated_at
  -- trigger: a person's total for one work_date may not exceed 24
  -- trigger: writes refused when the month is closed, unless hours.close

hours_months        -- a row means the month is closed
  month date pk check (extract(day from month) = 1)
  closed_by uuid -> profiles
  closed_at timestamptz default now()
  note text not null default ''

activity            -- written only by SECURITY DEFINER triggers; self-prunes to the newest 3000 rows
  id bigint identity pk
  actor_id uuid null -> profiles
  entity text not null              -- 'task' | 'task_item' | 'comment' | 'time_entry' | 'project' | 'profile' | 'role' | 'invitation' | 'month'
  entity_id uuid null
  task_id uuid null                 -- set for task, task_item and comment rows, so a task's history is one query
  subject_id uuid null -> profiles  -- the person a row is about: the entry's user_id on time_entry rows, else null.
                                    -- activity_select hides time_entry rows about other people unless hours.view_all
  action text not null check in ('created','updated','deleted','commented','closed','reopened')
  summary text not null             -- one human line: 'Status: To do → In progress', 'Logged 2.5 h on DLT'
  created_at
```

Indexes: `tasks(status, due)`, `tasks(assignee_id) where status <> 'done'`,
`tasks(project_id)`, `task_items(task_id, sort)`, `task_comments(task_id,
created_at)`, `time_entries(user_id, work_date desc)`,
`time_entries(project_id, work_date)`, `time_entries(task_id)`,
`activity(created_at desc)`, `activity(task_id, created_at desc)`,
`profiles(role_id)`, `invitations(token) where accepted_at is null and
revoked_at is null`.

### Helpers (SECURITY DEFINER, `stable`, `set search_path = ''`, owned by postgres)

```
current_uid()            auth.uid()
has_profile()            an active profiles row exists for current_uid()
my_role_key()            roles.key for the caller, null if none
has_perm(p text)         has_profile() and p = any(permissions of the caller's role)
is_owner()               my_role_key() = 'owner'
task_is_mine(task_id)    created_by = me or assignee_id = me
month_is_closed(d date)  exists hours_months where month = date_trunc('month', d)
topic_is_workspace()     realtime topic = 'workspace'
```

`has_perm` is the only thing policies need to know about roles. `anon` can
execute nothing except `invite_preview(text)` and `ping()`.

### RLS, per table (authenticated role; `with check` mirrors `using` unless stated)

- **roles**: select `has_profile()`; insert/update/delete `has_perm('roles.manage')`; trigger refuses changes to `is_system` rows and deletion of a role in use.
- **profiles**: select `has_profile()`; update: own row (`full_name`, `title`, `last_seen_at` only) or `has_perm('people.manage')` (`role_id`, `active`, `title`, `full_name`); trigger: owner-role changes need `is_owner()`, no self role change, no self deactivation, last-owner guard; no insert policy (signup trigger only); delete `has_perm('people.manage')` with the same guards.
- **invitations**: all four verbs `has_perm('people.manage')`; trigger: `role_id` may never be the owner role.
- **projects**: select `has_profile()`; insert/update/delete `has_perm('projects.manage')`.
- **tasks**: select `has_profile()`; insert `has_perm('tasks.create')` and `created_by = current_uid()`; update `has_perm('tasks.edit_any') or task_is_mine(id)`; delete `has_perm('tasks.delete') or created_by = current_uid()`. Trigger on update: changing `assignee_id` to someone other than yourself (or from someone else) requires `has_perm('tasks.assign')`; a task with no assignee may be taken by anyone.
- **task_items**: select `has_profile()`; insert/update/delete: same rule as updating the parent task.
- **task_comments**: select `has_profile()`; insert `has_profile()` (user_id stamped); delete own or `has_perm('tasks.edit_any')`; no update.
- **time_entries**: select `user_id = current_uid() or has_perm('hours.view_all')`; insert `has_perm('hours.log') and user_id = current_uid()` or `has_perm('hours.edit_any')`; update/delete own or `has_perm('hours.edit_any')`; trigger refuses any write in a closed month unless `has_perm('hours.close')`.
- **hours_months**: select `has_profile()`; insert/delete `has_perm('hours.close')`; no update.
- **activity**: select `has_profile()`; no client writes.
- **realtime.messages**: one private channel, topic `workspace`; read and write need `has_profile()`.

### Realtime

Publication `supabase_realtime` carries: `profiles`, `roles`, `projects`,
`tasks`, `task_items`, `task_comments`, `time_entries`, `hours_months`,
`activity`. `replica identity full` on `tasks`, `task_items`,
`task_comments`, `time_entries`. Postgres changes are filtered by RLS, so a
person without `hours.view_all` never receives another person's time entry.

## 5. Signup, invitations, bootstrap

Unchanged in spirit from v1. `handle_new_user()` reads `invite_token` from the
user metadata, validates it against `invitations`, creates the profile with
the invitation's `role_id` and `active = true`, marks the invitation accepted.
Any failure raises with the same message. `invite_preview(token)` returns
`{valid, email, role_name, inviter, expires_at}` or `{valid:false}`.

The existing accounts keep working: their profiles are backfilled with a
`role_id`, so the first sign-in after migration lands them on the new Home.
There is no new bootstrap token unless the database has no owner.

## 6. Migration strategy (what happens to the old data)

One migration, `supabase/migrations/0002_workspace.sql`, applied with
`supabase db push` (the CLI is linked to project `olqhfdpaoqvwompkqtdz`) or by
pasting into the SQL editor. It runs in one transaction and is safe to re-run.

1. Drop the v1 policies, triggers and helper functions that reference the old
   content tables (`is_member`, `can_edit`, `can_manage`, `log_activity`,
   `add_project_creator`, `topic_project_id`, the realtime policies).
2. Rename the old content tables, keeping every row: `projects →
   legacy_projects`, `project_members → legacy_project_members`, `tasks →
   legacy_tasks`, `reports → legacy_reports`, `partners → legacy_partners`,
   `project_state → legacy_project_state`, `project_docs →
   legacy_project_docs`, `comments → legacy_comments`, `activity →
   legacy_activity`. They stay RLS-forced with no policies, so nothing can read
   them through the API, and they leave the realtime publication.
3. Create `roles` and seed the seven roles. Add `profiles.role_id` and
   `profiles.active`, backfill from the old `role` column, then drop `role`.
   Rework `invitations` the same way (open invitations are mapped; accepted
   ones are kept as history).
4. Create the new tables, helpers, policies, triggers, publication entries and
   the `workspace` channel policies.
5. **Carry the work over.** Each `legacy_projects` row becomes a `projects` row
   (name, summary, track; `code` derived from the slug's first letters, made
   unique). Each `legacy_tasks` row becomes a `tasks` row: title, notes +
   why + done_when folded into `description` under small headings, status
   mapped 1:1, `pri` critical→urgent / high→high / normal→normal, `due`,
   `assignee`, `sort`, audit columns. Legacy comments on tasks become
   `task_comments`. Reports, partners, docs and numbers are not carried (they
   have no home in v2) but stay in the legacy tables.
6. `supabase/scripts/drop_legacy.sql` (not in `migrations/`, so `db push`
   never runs it) removes the legacy tables once the owner is satisfied.

Dashboard settings do not change. The keep-alive workflow does not change.

## 7. App architecture

Preact + TypeScript island inside the Astro site, `client:only`, hash routed,
English only, noindex. Same page (`src/pages/admin/index.astro`), same entry
(`src/admin/AdminApp.tsx`).

```
src/admin/
  AdminApp.tsx                 routes → screens; auth gate (unchanged shape)
  lib/
    config.ts                  + PERMISSIONS catalogue lives in types.ts, not here
    supabase.ts  auth.ts  observable.ts  router.ts  errors.ts  deadline.ts
    format.ts  toasts.ts  theme.ts  timing.ts  ui.ts            (kept)
    types.ts                   rewritten for the v2 tables; labels; catalogues
    perms.ts                   can(permission) / useCan(); reads auth.profile + roles
    workspace.ts               THE store (replaces store.ts/projects.ts/queries.ts)
    hours.ts                   week/month maths, CSV builder (pure functions)
  components/                  generic pieces (kept) + Drawer, StatusDot, PersonPicker,
                               ProjectMark, Progress, DateInput, HoursInput, PageHeader
  features/
    home/      Home.tsx
    tasks/     Tasks.tsx TaskList.tsx TaskBoard.tsx TaskDrawer.tsx TaskForm.tsx Checklist.tsx Comments.tsx History.tsx filters.ts
    hours/     Hours.tsx MyWeek.tsx LogDialog.tsx EntryRow.tsx TeamHours.tsx MonthClose.tsx
    people/    People.tsx Person.tsx InviteDialog.tsx
    settings/  Settings.tsx Projects.tsx ProjectDialog.tsx Roles.tsx RoleEditor.tsx
    activity/  Activity.tsx
  screens/     Login.tsx Join.tsx Reset.tsx Account.tsx   (kept, restyled)
  demo/        client.ts db.ts (kept engine) · fixture.ts (rewritten) · mode.ts types.ts
  styles/
    workbench.css              tokens, primitives, controls, shell, surfaces, overlays
    features.css               one section per feature, in the same file order as features/
```

### Routes

```
#/                     Home
#/tasks                Tasks. query: view=list|board · scope=mine|all · project=<id> · person=<id> · status=<s> · q=<text>
                       ?task=<id> opens the drawer; ?new=1 opens the new-task form
#/hours                My hours, one week. query: week=YYYY-MM-DD (the Monday) · ?log=1 opens Log hours · ?entry=<id> edits one
#/hours/team           Everyone's hours (hours.view_all). query: month=YYYY-MM · person=<id> · project=<id>
#/people               Directory; invitations for people.manage
#/people/<id>          One person: role, open tasks, recent hours (own, or hours.view_all)
#/activity             Everything that changed
#/settings             Projects and Roles (tabs); only for projects.manage / roles.manage
#/account              Your name, title, password, theme
#/login  #/join/<token>  #/reset  #/demo/...                                  (unchanged)
```

Old v1 addresses (`#/today`, `#/p/...`, `#/projects`) redirect to `#/`.

### The workspace store (`lib/workspace.ts`)

One store for the signed-in session, opened after the profile loads and closed
on sign-out.

- Loads once: `roles`, `profiles` (all, including inactive, flagged), `projects`,
  `tasks` where `status <> 'done' or done_at > now() - 90 days`,
  `hours_months`, the newest 50 `activity` rows. `loadOlderTasks()` and
  `loadMoreActivity()` extend.
- Time entries are **windowed**: `useTimeEntries({from, to, userId?,
  projectId?})` fetches the range once and keeps it fresh from realtime; the
  My-week and Team-month screens each ask for their own window.
- One private channel `workspace`: postgres_changes on all nine tables merged
  into the store, plus presence (`{user_id, name, where}`) for the "who is
  here" dots on Home and People.
- Mutations are optimistic with rollback, echo-suppressed, exactly as v1
  (`insertRow`, `updateRow`, `deleteRow`), plus typed helpers:
  `createTask`, `assignTask`, `setTaskStatus`, `toggleItem`, `addComment`,
  `logHours`, `closeMonth`, `reopenMonth`, `createInvite`, `setRole`,
  `setActive`, `saveRole`, `saveProject`.
- Derived selectors: `useMyTasks()`, `useTaskProgress(id)` (checklist
  fraction, else `progress`), `useHoursOnTask(id)`, `useWeekTotals(...)`.
- `status: 'loading' | 'ready' | 'denied' | 'missing' | 'error'` and the
  12-second deadline with "Try again", as today. `missing` means the v2
  tables are not there yet: the screen says the database needs the
  migration, with the file name.

### Permissions in the UI (`lib/perms.ts`)

`can('tasks.assign')` reads the cached role. Controls a person cannot use are
not rendered (not disabled), except where that would hide the existence of a
feature a reader should know about (the Team hours tab shows a one-line "Ask
an administrator for access" instead). The database is the enforcement; a
refused write rolls back and toasts the server's message.

## 8. Screens

Shell: a left rail on desktop (logo mark; Home · Tasks · Hours · People ·
Settings; at the bottom: you, theme, sign out), 232px, collapsible to icons.
On phones: a top bar (logo, page title, one action) and a bottom bar (Home ·
Tasks · Hours · More). The split hairline (Med teal then Tech indigo, hard
stop) runs along the very top of the shell and of the sign-in frame: that and
the logo are the whole brand presence.

**Home.** "Good morning, {first name}." Two columns on desktop, one on phone.
Left: *My tasks* (open, assigned to me, soonest due first, overdue in red
words, 7 rows then "All my tasks"), *Due this week* (anyone's). Right: *This
week* (my hours as a Mon–Sun strip of numerals with the total in Fraunces, and
the Log hours button), *Today on the team* (each person's entries today: name,
hours, summary), *Recently* (last 10 activity lines). Nothing on Home needs a
click to be read.

**Tasks.** Header: title, count, search, filter chips (Mine / All; project;
person; status), List / Board toggle, New task. *List* groups by status (To do,
In progress, Blocked, Done this week); each row: title, project mark, assignee
avatar, due wording, progress (a thin bar or "3 of 5"), priority only when
high or urgent (a word). *Board*: four columns, same cards, drag between
columns on desktop, status menu on phones. Opening a row slides in the
**drawer** (right on desktop, full-screen on phones): editable title, status,
assignee, project, priority, due, description (plain text, `**bold**` only),
checklist (add, tick, reorder, delete), hours logged against it, comments
(newest last, a composer at the bottom), history (collapsed). Changes save on
blur or on choice, with the "Updated by Sam" field hint from v1.

**Hours.** Default: *My week*. A week switcher (← This week →), seven day
columns, each day's entries (hours, project code, summary) and day total; the
week total in Fraunces; "Log hours" opens the dialog. **Log hours dialog**:
date (defaults to today; yesterday/today shortcuts), hours (quarter-hour
stepper, 0.25 to 24), project (optional), task (optional, filtered by project,
searchable), summary ("What did you work on?", required). Entries in a closed
month show a lock word and cannot be edited. *Team* tab (hours.view_all): a
month picker; table of people × weeks with totals, a project breakdown, filter
by person or project, every entry's summary readable in an expandable row,
"Download CSV" (hours.export) and "Close month" / "Reopen" (hours.close).

**People.** Directory: avatar, name, title, role, "here now" dot, last seen,
open task count. With people.manage: Invite (dialog: role, optional email,
note, expiry; shows the copyable join link), change role, deactivate /
reactivate; a list of open invitations with revoke. Person page: their open
tasks, their recent hours when permitted.

**Settings.** *Projects*: list with code, name, track (Med / Tech / Org), lead,
status; add and edit in a dialog; archive. *Roles*: a role list and an editor:
name, description, and the permission catalogue as a plain checklist with the
sentence from section 3 next to each key; the owner role is shown read-only;
"used by N people".

**Activity.** The feed, newest first, filter by person and kind; "Since you
were here" divider.

**Account**, **Login**, **Join**, **Reset**: as v1, restyled.

Every screen has an empty state written in the house voice ("No tasks are
assigned to you. Take one from the list, or make one."), a loading skeleton,
and the slow / stalled notices from v1.

## 9. Visual language for the portal

Scoped under `.wb`. Light by default, dark as a preference (the switch stays).

- **Surfaces.** Page `--paper #f6f3ee`; panels and inputs `#ffffff`; rules
  `#d6cfc3` (1px) with a 2px ink rule for the one heavy divider per screen;
  radius 8px on controls, 12px on panels and the drawer; shadow only on things
  that float (menu, dialog, toast, drawer).
- **Ink.** Text `#161a21`; muted `#4d5a67`; labels `#5d6874`. Dark theme:
  paper → `#161a21`, panels `#1f242c`, rules `#333a45`, text `#e9e6e0`.
- **Colour as structure.** Med teal (`#0b5f5a` deep, `#006b64` text) and Tech
  indigo (`#243b9e` deep, `#2b44a8` text) appear only as a project's mark (a
  10px square or 3px rule beside the code) and in the split hairline. Org
  projects use ink. Semantic colours are always paired with a word: done
  `#1a7f52`, blocked / overdue `#b3261e`, due soon `#9a6207`.
- **Type.** Fraunces (self-hosted, `src/styles/fonts.css`) at 600 for the page
  title, the greeting and big numerals (week total, task count). Plus Jakarta
  Sans for everything else: 15px body, 13px meta, 600 for labels. No
  uppercase letter-spacing anywhere. The Google Fonts link for Outfit is
  removed; the admin page preloads the two WOFF2 files like BaseLayout does.
- **Buttons.** Sentence case. Primary = ink background, paper text. Secondary =
  paper with a 1px rule. Quiet = text only. One primary per screen.
- **The bracket.** CSS-only corner brackets, once per screen at most: the
  sign-in panel, the empty state illustration, the week total on Hours.
- **Status.** A 7px dot plus the word, never a filled pill. Priority is the
  word "High" or "Urgent" in ink, nothing for normal.
- **Motion.** One scale: 160ms ease-out for menus and the drawer; the
  reduced-motion query disables all of it.
- **Phone first.** Every screen is laid out at 375px first; the 16px gutter;
  no horizontal scroll; the drawer becomes a full-screen sheet; tables become
  stacked rows.

## 10. The work, in chunks

Branch `workbench-v2` (this worktree). Agents share the checkout; each chunk
owns the files listed and touches nothing else. The build runs only from the
orchestrator; agents verify with `npx astro check` filtered to their own
files, and `npx tsc --noEmit` is not configured, so do not add it.

Order: A, B and H2 run in parallel (they share only this document). C, D, E,
F and H1 start when B has landed. Then QA. Section 13 (added 2026-11-07)
extends A and B and defines H1 and H2.

### A. Database (Opus)

Owns `supabase/migrations/0002_workspace.sql`, `supabase/scripts/drop_legacy.sql`,
`supabase/tests/rls_smoke_v2.sql`, `supabase/README.md`.

Done when: the migration implements sections 3 to 6 exactly (names, checks,
helpers, policies, triggers, publication, channel policies, seed roles, carry-over);
is idempotent; runs clean on a fresh local database (`supabase start`, `supabase
db reset`) when Docker is available, else is reviewed statement by statement;
the smoke test fabricates an owner, a finance person and a member through the
real signup path and asserts: the member cannot read another person's hours,
cannot assign a task to someone else, can take an unassigned task, can edit
a task assigned to them; finance can close a month and then the member's
insert into it fails; a non-owner cannot grant the owner role; the last owner
cannot be deactivated; `anon` can execute only `invite_preview` and `ping`.
README rewritten for v2 (what the migration sets up, how to apply with the
CLI, dashboard settings unchanged, legacy tables and how to drop them).

### B. App foundation (Opus)

Owns everything under `src/admin/` except `features/*` bodies, plus
`src/pages/admin/index.astro`, `scripts/webkit-smoke.mjs`.

Done when: old modules, screens and styles are deleted; `types.ts`, `perms.ts`,
`workspace.ts`, `hours.ts` implement section 7; `router.ts` has the section 7
routes with redirects; `AppShell` is the section 8 shell in the section 9
style (`workbench.css`, fonts self-hosted, Outfit gone); `Login`, `Join`,
`Reset`, `Account` work against the v2 profile; the new shared components
exist (Drawer, StatusDot, PersonPicker, ProjectMark, Progress, DateInput,
HoursInput, PageHeader); `features/*/index.ts` exports a placeholder screen
per feature that renders the PageHeader and an EmptyState, so the app builds
and every route resolves; `demo/fixture.ts` is rewritten for the v2 schema
(three invented people with different roles, two projects, ~25 tasks with
checklists and comments, three weeks of time entries, one closed month) and
`demo/db.ts` logs activity for the v2 tables; `npm run build` and `npm run
check:all` pass; `#/demo` renders every route.

### C. Tasks (Opus)

Owns `src/admin/features/tasks/*` and the "Tasks" section of `features.css`.

Done when: list and board, filters in the query string, drawer with every
field, checklist with progress, comments, history, hours-on-task, assignment
respecting `can('tasks.assign')`, keyboard: Esc closes the drawer, `n` on the
list opens New task; works on `#/demo/tasks` at 375px and 1280px with no
console errors.

### D. Hours (Sonnet)

Owns `src/admin/features/hours/*` and the "Hours" section of `features.css`.

Done when: My week, Log hours dialog, edit/delete own entries, closed-month
lock state, Team month view with totals and project breakdown, CSV download
(`hours.ts` builds it), Close / Reopen month; `#/demo/hours` and
`#/demo/hours/team` at both widths with no console errors.

### E. Home and Activity (Sonnet)

Owns `src/admin/features/home/*`, `src/admin/features/activity/*` and their
sections of `features.css`.

Done when: Home shows the six blocks of section 8 from the store with no
extra requests beyond the time window for this week; Activity lists, filters
and loads more; both at both widths with no console errors.

### F. People and Settings (Sonnet)

Owns `src/admin/features/people/*`, `src/admin/features/settings/*` and their
sections of `features.css`.

Done when: directory, invite dialog with the join link, role change,
deactivate / reactivate, open invitations with revoke, person page; Settings
with Projects (add, edit, archive) and Roles (list, editor with the permission
checklist, owner read-only, "used by N"); all gated by `can(...)`; both widths,
no console errors.

### G. QA and polish (Fable, with Opus / Sonnet fix agents)

Build, `check:all`, `astro check` on `src/admin`, the WebKit smoke test;
walk every route on `#/demo` at 375px and 1280px in the in-app browser,
light and dark; console clean; keyboard and screen-reader basics (labels,
focus order, Esc); the house voice on every string; section 9 rules on every
screen. Each round produces a findings list; fixes go to a Sonnet agent for
small items and Opus for structural ones; repeat until a round finds nothing
worth a fix. Then, with the owner signed in to the real portal after the
migration is pushed: invite flow, role change, a task assigned to another
person, hours logged and seen on Team, month close.

## 11. Checks that must pass before the PR

- `npm run build`, `npm run check:all`, `npx astro check` clean for `src/admin`.
- `node scripts/webkit-smoke.mjs` passes against `#/demo`.
- Migration applied to the live project with `supabase db push`; `rls_smoke_v2.sql`
  passes there (it rolls itself back).
- Screenshots at 375px and 1280px of Home, Tasks (list, board, drawer), Hours
  (week, log dialog, team), People, Settings/Roles, in the PR description.
- No staff name, grant figure or business string anywhere in the diff.

## 12. Decisions taken in this plan (the owner can overturn any of them)

- Projects are a light grouping with no membership: everyone sees every
  project, permissions come from the role alone.
- Hours are self-reported in quarter hours with one required summary line;
  there is no approval step, only a month close by finance.
- Task progress is the checklist fraction when a checklist exists, otherwise a
  manual percentage; status is separate from progress.
- Old reports, partners, numbers and docs are kept in legacy tables, not
  shown; the owner drops them when ready.
- The portal stays English only.

---

## 13. Inquiries: the public forms' responses in the portal

Owner decision (2026-11-07): Google Forms stay the system of record for the
three public forms (the contact inquiry form, the Digital Literacy sign-up,
the Digital Literacy interest form). Every response is ALSO copied into the
portal, where it is an inbox item: new, contacted, enrolled or closed,
assignable, with notes and a one-click task. The contact inquiry form, which
today posts straight to Google from the page, moves behind the same
Cloudflare Worker as the other two and gets the Turnstile check. The four
unlisted staff forms (IEP, loaner, orientation, attendance) are NOT copied.

### 13.1 Database (extends chunk A, in 0002)

```
inquiries
  id uuid pk
  source text not null check in ('inquiry','dlt_signup','dlt_interest')
  received_at timestamptz not null default now()
  lang text not null default 'en' check in ('en','es')
  page text not null default ''            -- the page path the form was on
  name text not null default ''
  contact text not null default ''         -- phone and/or email on one line
  fields jsonb not null default '[]'       -- ordered [{"k":"Program","v":"..."}, ...]; immutable after insert
  status text not null check in ('new','contacted','enrolled','closed') default 'new'
  assignee_id uuid null -> profiles (on delete set null)
  notes text not null default ''
  task_id uuid null -> tasks (on delete set null)
  updated_by uuid null, updated_at timestamptz

ingest_secrets      -- RLS forced, no policies, NO grants to anon or authenticated: only the definer function reads it
  name text pk
  secret text not null
  created_at timestamptz default now()
```

Functions:

- `ingest_form_response(p_secret text, p_source text, p_lang text, p_page text,
  p_name text, p_contact text, p_fields jsonb) returns uuid`. SECURITY DEFINER,
  volatile, `set search_path = ''`, executable by `anon` and `authenticated`.
  Refuses (one generic message, 'not accepted') when no secret is stored or
  `p_secret` differs from `ingest_secrets.secret where name = 'worker'`;
  validates `p_source` and `p_lang` against the checks; caps lengths (name
  200, contact 300, page 200; fields at most 60 items, each `k` ≤ 100 and `v` ≤
  2000 characters, anything longer is cut, not refused); inserts; writes one
  activity row (`entity 'inquiry'`, `action 'created'`, summary like "New
  inquiry from the interest form"); returns the id.
- `set_ingest_secret(p_secret text)`: upserts the `worker` row. Executable by
  nobody but `postgres` (revoke from PUBLIC, anon, authenticated). The
  orchestrator sets it with `supabase db query --linked`; the same value goes
  into the Worker as the secret `INGEST_SECRET`. It never enters the repo.

Permissions: two more keys in the catalogue (14 in all):

| Key | Lets you |
| --- | --- |
| `inquiries.view` | See the inbox, including the person's name and contact details |
| `inquiries.manage` | Change an inquiry's status, assign it, write notes, make a task from it |

Seeded: owner, administrator and technology_lead get both; instructor and
course_designer get `inquiries.view`; finance and member get neither.

RLS: select `has_perm('inquiries.view')`; update `has_perm('inquiries.manage')`
with a trigger that keeps `source, received_at, lang, page, name, contact,
fields` immutable; delete `has_perm('inquiries.manage')`; no insert policy
(the definer function inserts). Activity rows on status, assignee and task
changes ("Status: New → Contacted", "Assigned to Sam"). In the publication,
`replica identity full`.

Smoke test additions: `anon` can execute `ingest_form_response` and a wrong
secret raises while the right one inserts; the member (no `inquiries.view`)
reads zero inquiries; nobody but postgres can read `ingest_secrets` or
execute `set_ingest_secret`.

### 13.2 App foundation (extends chunk B)

- Route `#/inbox` (query `?item=<id>` opens the drawer; `?status=` and
  `?source=` filter). Old `#/inquiries` is not needed.
- Rail: Home · Tasks · Hours · **Inbox** · People · Settings; the Inbox item
  shows the count of `new` inquiries as a small numeral when it is not zero.
  Phone More sheet lists Inbox too. Inbox is only in the navigation when
  `can('inquiries.view')`.
- `features/inquiries/index.ts` exports a placeholder `Inbox`.
- `types.ts`: `Inquiry`, `InquirySource`, `InquiryStatus`, the two labels
  maps (`INQUIRY_SOURCE_LABEL`: inquiry "Contact form", dlt_signup "DLT
  sign-up", dlt_interest "DLT interest"; `INQUIRY_STATUS_LABEL`), the two new
  permission keys with their sentences.
- `workspace.ts`: loads `inquiries` (newest 200, `loadOlderInquiries()`) when
  `can('inquiries.view')`, keeps them live, and exposes `useInquiries()`,
  `useNewInquiryCount()`, `setInquiryStatus`, `assignInquiry`,
  `saveInquiryNotes`, `linkInquiryTask`.
- Demo fixture: about eight invented inquiries across the three sources and
  four statuses, two assigned, one linked to a task.
- Styles: instead of one `features.css`, one file per feature under
  `src/admin/styles/features/` (`home.css`, `tasks.css`, `hours.css`,
  `people.css`, `settings.css`, `activity.css`, `inquiries.css`), each imported
  by `src/pages/admin/index.astro`, so parallel agents never edit one file.

### 13.3 Chunk H2: Worker and the contact form (Opus; runs in parallel with A and B)

Owns `workers/mmt-signup/*`, `src/components/ContactForm.astro`,
`src/styles/components/contact.css`, `scripts/check-form-contract.mjs`,
`docs/inquiry-form.md` (new), and the contact-form strings in
`src/i18n/en.ts` / `es.ts` if any are needed (both languages, always).

Worker:
- New route `POST /inquiry-submit`, binding `FORM_ACTION_INQUIRY`, the same
  rules as `/interest-submit` (origins including the local dev server,
  Turnstile hostname check, honeypot `website`, only a Google 200 counts).
- After Google has accepted a post on `/` (sign-up), `/interest-submit` and
  `/inquiry-submit`, the Worker copies the response to the portal with
  `ctx.waitUntil(...)` (the handler signature becomes `fetch(request, env,
  ctx)`): `POST https://olqhfdpaoqvwompkqtdz.supabase.co/rest/v1/rpc/ingest_form_response`
  with headers `apikey` and `Authorization: Bearer` both set to the
  publishable key `sb_publishable_N3L_0PXlx5urFzkObblWIA_7qrVgq8M` (public by
  design; it is already in the site bundle) and `Content-Type:
  application/json`; body `{p_secret: env.INGEST_SECRET, p_source, p_lang,
  p_page, p_name, p_contact, p_fields}`. A failed copy is logged with
  `console.error` and never changes the reader's response: Google is the
  record. If `INGEST_SECRET` is unset the copy is skipped silently.
- A label map per form (entry id → question label, in question order) lives
  in the Worker so `fields` reads as `[{k:"Program", v:"..."}]`; `p_name` and
  `p_contact` are picked from the name, phone and email entries; `p_lang` is
  `es` when the `Referer` path starts with `/es/`, else `en`; `p_page` is the
  Referer pathname (empty when absent). The maps for the three forms come from
  `ContactForm.astro`, `scripts/check-form-contract.mjs` (SIGNUP_FIELDS) and
  `docs/dlt-interest-form.md`. Unknown entry ids are kept with `k` set to the
  entry id. Checkbox questions that repeat a name join their values with
  ", ".
- `wrangler.toml` comments and the README list the new binding and secret.
  Deploy stays `npx wrangler deploy --keep-vars` from the school account, or
  through the dashboard; the orchestrator deploys.

Site:
- `ContactForm.astro` works like `DltInterestForm.astro`: the Turnstile widget
  (site key `0x4AAAAAAFABG_uSmI7QN2sd`), a honeypot `website` field, a fetch
  POST of the form-encoded `entry.*` fields plus `cf-turnstile-response` to
  `https://mmt-signup.mercermedtech.workers.dev/inquiry-submit`; the hidden
  iframe and the Google action URL go; the in-page success and error states,
  the `?program=` preselect and the consent checkbox stay; a failed post shows
  the existing error wording and re-enables the button. Read
  `DltInterestForm.astro` first and reuse its approach and its Turnstile
  loading code rather than inventing a second one.
- `scripts/check-form-contract.mjs` section 1: the contact form must post to
  the Worker route; the inquiry Google Form id
  `1FAIpQLSdlbJCiaAE1h2VVLcF0mUPG_6SKAs34IR0Ipu_DHATetEX-lg` must appear on no
  built page; the entry ids and option values are still checked.
- `docs/inquiry-form.md` in the style of `docs/dlt-interest-form.md`.
- `npm run build && npm run check:all` pass.

### 13.4 Chunk H1: the Inbox screen (Sonnet; after B, in parallel with C to F)

Owns `src/admin/features/inquiries/*` and `src/admin/styles/features/inquiries.css`.

Inbox: newest first; sections New, Contacted, Enrolled, Closed (the last two
folded by default); each row: name, source as a word, received ("2 h ago",
"Tue"), contact, assignee avatar; filters by source, status, assignee, and a
search over name and contact; the drawer shows every field as a label and
value in form order, the status choice, the assignee picker, notes (saved on
blur), "Make a task" (creates a task titled "Follow up with {name}", the
fields as the description, assigned to the current assignee, and links it;
afterwards the row shows the task and its status), and the activity for this
item. `can('inquiries.manage')` gates every control. Phone and desktop, no
console errors on `#/demo/inbox`.
