-- =============================================================================
-- MMT Admin Portal — initial schema
-- =============================================================================
-- Target      : a brand-new, EMPTY Supabase project.
-- How to run  : paste the whole file into the Supabase SQL Editor and run it.
--               The editor connects as the `postgres` role, which is what this
--               script assumes (every object it creates ends up owned by
--               `postgres`, and `postgres` has BYPASSRLS so the SECURITY
--               DEFINER helpers below never recurse through RLS).
-- Idempotency : as close as practical — `create table if not exists`,
--               `create or replace function`, `drop policy if exists`,
--               `drop trigger if exists`, `create index if not exists`, and
--               guarded publication membership. Re-running on an already
--               migrated database is safe; it will not, however, retro-fit
--               column changes onto tables that already exist.
-- Contents    : no project-specific content, names or e-mail addresses. All of
--               that lives in the database, not in this (public) repository.
--
--   1. Extensions
--   2. Tables
--   3. Indexes
--   4. RLS helper functions (SECURITY DEFINER)
--   5. Public RPCs (invite_preview, ping)
--   6. Row Level Security: enable + force
--   7. Policies
--   8. Grants and revokes
--   9. Signup trigger on auth.users (invitation gate)
--  10. Audit + activity triggers
--  11. Guard triggers (profile protection, invitation roles, project creator)
--  12. Privileges for trigger/internal functions
--  13. Realtime: publication membership + replica identity
--  14. Realtime: private `project:<uuid>` channel policies
--  15. Bootstrap owner invitation (+ final SELECT that prints its token)
-- =============================================================================


-- =============================================================================
-- 1. Extensions
-- =============================================================================
-- On Supabase, extensions live in the dedicated `extensions` schema. pgcrypto
-- is what gives us `gen_random_bytes` for invitation tokens; it must always be
-- called schema-qualified because every function below runs with an empty
-- search_path. `gen_random_uuid()` is core Postgres (13+) and lives in
-- pg_catalog, which is always implicitly searched.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Fail fast and legibly rather than three hundred lines further down.
do $do$
begin
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception
      'pgcrypto must be installed in schema "extensions" (Database → Extensions → pgcrypto)';
  end if;
end;
$do$;


-- =============================================================================
-- 2. Tables
-- =============================================================================

-- --- profiles ---------------------------------------------------------------
-- One row per signed-up user, created by the auth.users trigger in section 9.
-- Clients never INSERT here; the trigger does.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text check (char_length(full_name) <= 120),
  title        text check (char_length(title) <= 120),
  role         text not null default 'member'
               check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- --- invitations ------------------------------------------------------------
-- The only way in. A token is handed to a person out-of-band (text, chat,
-- e-mail) as /admin/#/join/<token>; the auth.users trigger validates it.
create table if not exists public.invitations (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique
                 default encode(extensions.gen_random_bytes(24), 'hex'),
  email          text,                       -- null = usable by any address
  role           text not null default 'member'
                 check (role in ('owner', 'admin', 'member')),
  -- [{"project_id": "<uuid>", "role": "manager|editor|viewer"}, ...]
  project_grants jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(project_grants) = 'array'),
  note           text check (char_length(note) <= 500),
  invited_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '14 days'),
  accepted_at    timestamptz,
  accepted_by    uuid references public.profiles (id) on delete set null,
  revoked_at     timestamptz
);

-- --- projects ---------------------------------------------------------------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name       text not null check (char_length(name) between 1 and 200),
  kind       text not null default 'general' check (kind in ('grant', 'general')),
  track      text not null default 'org' check (track in ('med', 'tech', 'org')),
  summary    text not null default '',
  status     text not null default 'active' check (status in ('active', 'archived')),
  config     jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- --- project_members --------------------------------------------------------
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('manager', 'editor', 'viewer')),
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- --- tasks ------------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 300),
  ws         text not null default '',          -- workstream key
  status     text not null default 'todo'
             check (status in ('todo', 'doing', 'blocked', 'done')),
  pri        text not null default 'normal'
             check (pri in ('critical', 'high', 'normal')),
  horizon    text not null default 'now'
             check (horizon in ('now', 'next', 'later')),
  due        date,
  owner      text not null default '',          -- free-text label
  assignee   uuid references public.profiles (id) on delete set null,
  why        text not null default '',
  done_when  text not null default '',
  notes      text not null default '',
  recurring  text not null default '',
  sources    jsonb not null default '[]'::jsonb
             check (jsonb_typeof(sources) = 'array'),
  sort       integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- --- reports ----------------------------------------------------------------
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  period       text not null check (char_length(period) between 1 and 20), -- e.g. '2026-09' = month DUE
  due          date,
  covers       text not null default '',
  kind         text not null default 'monthly' check (kind in ('monthly', 'closeout')),
  status       text not null default 'not_started'
               check (status in ('not_started', 'preparing', 'submitted',
                                 'returned', 'approved', 'paid')),
  -- keys come from projects.config -> report_checks
  checks       jsonb not null default '{}'::jsonb
               check (jsonb_typeof(checks) = 'object'),
  amount       numeric(12, 2),
  submitted_on date,
  notes        text not null default '',
  sources      jsonb not null default '[]'::jsonb
               check (jsonb_typeof(sources) = 'array'),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (project_id, period)
);

-- --- partners ---------------------------------------------------------------
create table if not exists public.partners (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 200),
  county     text not null default '',
  kind       text not null default '',
  stage      text not null default 'not_contacted'
             check (stage in ('not_contacted', 'contacted', 'meeting_held',
                              'referring', 'paused')),
  contact    text not null default '',
  next_step  text not null default '',
  notes      text not null default '',
  referrals  integer not null default 0 check (referrals >= 0),
  sort       integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- --- project_state ----------------------------------------------------------
-- Free-form per-project blobs: 'metrics', 'budget', and whatever comes later.
create table if not exists public.project_state (
  project_id uuid not null references public.projects (id) on delete cascade,
  key        text not null check (char_length(key) between 1 and 40),
  data       jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (project_id, key)
);

-- --- project_docs -----------------------------------------------------------
-- body is an array of blocks: {t:"p"|"h"|"ul"|"kv"|"note", ...}
create table if not exists public.project_docs (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  section    text not null check (char_length(section) between 1 and 60),
  slug       text not null check (char_length(slug) between 1 and 80),
  title      text not null default '',
  body       jsonb not null default '[]'::jsonb
             check (jsonb_typeof(body) = 'array'),
  sources    jsonb not null default '[]'::jsonb
             check (jsonb_typeof(sources) = 'array'),
  sort       integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (project_id, section, slug)
);

-- --- comments ---------------------------------------------------------------
-- Polymorphic by (entity, entity_id); no FK, because the target table varies.
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  entity     text not null check (entity in ('task', 'report', 'partner', 'doc')),
  entity_id  uuid not null,
  body       text not null check (char_length(body) between 1 and 4000),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- --- activity ---------------------------------------------------------------
-- Written exclusively by the SECURITY DEFINER trigger in section 10.
create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  entity     text not null,
  entity_id  uuid,
  action     text not null
             check (action in ('created', 'updated', 'deleted', 'commented')),
  summary    text not null check (char_length(summary) <= 300),
  created_at timestamptz not null default now()
);


-- =============================================================================
-- 3. Indexes
-- =============================================================================
-- Every project_id lookup is indexed. Where a primary key or unique constraint
-- already begins with project_id, that b-tree serves as the project_id index
-- and no duplicate is created:
--   * project_members  pk (project_id, user_id)
--   * project_state    pk (project_id, key)
--   * reports          unique (project_id, period)
--   * project_docs     unique (project_id, section, slug)
--   * tasks            covered by tasks_project_status_idx below
--   * invitations      unique (token) is the token index
-- Redundant single-column indexes are pure write overhead, so they are omitted
-- on purpose rather than by oversight.

create index if not exists tasks_project_status_idx
  on public.tasks (project_id, status);
create index if not exists tasks_assignee_idx
  on public.tasks (assignee) where assignee is not null;
create index if not exists tasks_project_board_idx
  on public.tasks (project_id, horizon, sort);

create index if not exists partners_project_idx
  on public.partners (project_id, sort);

create index if not exists comments_project_idx
  on public.comments (project_id, created_at desc);
create index if not exists comments_entity_idx
  on public.comments (entity, entity_id);

create index if not exists activity_project_idx
  on public.activity (project_id, id desc);

create index if not exists project_members_user_idx
  on public.project_members (user_id);

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists invitations_open_idx
  on public.invitations (created_at desc)
  where accepted_at is null and revoked_at is null;


-- =============================================================================
-- 4. RLS helper functions
-- =============================================================================
-- All SECURITY DEFINER, owned by `postgres`, `stable`, `set search_path = ''`
-- and fully qualified. They read public.profiles / public.project_members with
-- definer rights; because `postgres` carries BYPASSRLS, those reads do not
-- re-enter the policies that call them, so there is no RLS recursion even with
-- FORCE ROW LEVEL SECURITY switched on in section 6.
--
-- Every *(pid uuid)* helper returns FALSE for a null pid. That matters: the
-- realtime channel policies in section 14 pass a possibly-null project id, and
-- a null must never fall through to the is_admin() short-circuit.

-- auth.uid() that can never raise (a malformed request.jwt.claims GUC would
-- otherwise abort the statement). Used by triggers; policies call auth.uid()
-- directly since real PostgREST requests always set well-formed claims.
create or replace function public.current_uid()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid;
begin
  begin
    v_uid := (select auth.uid());
  exception when others then
    v_uid := null;
  end;
  return v_uid;
end;
$fn$;

create or replace function public.has_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
  );
$fn$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.role = 'owner'
  );
$fn$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.role in ('owner', 'admin')
  );
$fn$;

create or replace function public.is_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when pid is null then false
    else public.is_admin() or exists (
      select 1 from public.project_members m
       where m.project_id = pid and m.user_id = (select auth.uid())
    )
  end;
$fn$;

create or replace function public.can_edit(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when pid is null then false
    else public.is_admin() or exists (
      select 1 from public.project_members m
       where m.project_id = pid
         and m.user_id = (select auth.uid())
         and m.role in ('manager', 'editor')
    )
  end;
$fn$;

create or replace function public.can_manage(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when pid is null then false
    else public.is_admin() or exists (
      select 1 from public.project_members m
       where m.project_id = pid
         and m.user_id = (select auth.uid())
         and m.role = 'manager'
    )
  end;
$fn$;

-- Project id embedded in a realtime topic of the form `project:<uuid>`.
-- Returns NULL (never raises) for a missing, foreign or malformed topic, so a
-- crafted channel name yields a denied policy instead of an error.
create or replace function public.topic_project_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_topic text;
  v_id    uuid;
begin
  begin
    v_topic := realtime.topic();
  exception when others then
    return null;
  end;

  if v_topic is null or split_part(v_topic, ':', 1) <> 'project' then
    return null;
  end if;

  begin
    v_id := split_part(v_topic, ':', 2)::uuid;
  exception when others then
    return null;
  end;

  return v_id;
end;
$fn$;

-- --- small presentation helpers (used only inside definer functions) --------

create or replace function public.activity_label(p_value text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select case p_value
    when 'todo'          then 'To do'
    when 'doing'         then 'Doing'
    when 'blocked'       then 'Blocked'
    when 'done'          then 'Done'
    when 'critical'      then 'Critical'
    when 'high'          then 'High'
    when 'normal'        then 'Normal'
    when 'now'           then 'Now'
    when 'next'          then 'Next'
    when 'later'         then 'Later'
    when 'not_started'   then 'Not started'
    when 'preparing'     then 'Preparing'
    when 'submitted'     then 'Submitted'
    when 'returned'      then 'Returned'
    when 'approved'      then 'Approved'
    when 'paid'          then 'Paid'
    when 'not_contacted' then 'Not contacted'
    when 'contacted'     then 'Contacted'
    when 'meeting_held'  then 'Meeting held'
    when 'referring'     then 'Referring'
    when 'paused'        then 'Paused'
    else coalesce(initcap(replace(p_value, '_', ' ')), 'none')
  end;
$fn$;

-- 'Sep 20' / 'none'. Takes text because callers read it out of to_jsonb(row).
create or replace function public.fmt_day(p_value text)
returns text
language sql
stable
set search_path = ''
as $fn$
  select case
    when p_value is null or p_value = '' then 'none'
    else to_char(p_value::date, 'Mon FMDD')
  end;
$fn$;

create or replace function public.fmt_money(p_value text)
returns text
language sql
stable
set search_path = ''
as $fn$
  select case
    when p_value is null or p_value = '' then 'none'
    else '$' || to_char(p_value::numeric, 'FM999,999,999,990.00')
  end;
$fn$;

create or replace function public.display_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
           nullif(btrim(p.full_name), ''),
           nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
           'someone')
    from public.profiles p
   where p.id = p_id;
$fn$;


-- =============================================================================
-- 5. Public RPCs
-- =============================================================================

-- invite_preview(token) — the only thing an unauthenticated visitor may learn.
-- Every invalid case (unknown, revoked, expired, already used, malformed)
-- returns the exact same payload, so a caller cannot probe for live tokens or
-- distinguish "revoked" from "never existed". `inviter` is a display name
-- only; no e-mail address of the inviter is ever revealed.
create or replace function public.invite_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_inv     public.invitations%rowtype;
  v_token   text;
  v_inviter text;
  -- The one and only "no" answer. Identical for unknown, revoked, expired,
  -- already-used and malformed tokens. The casts keep jsonb_build_object from
  -- having to resolve an unknown-typed NULL.
  v_deny    constant jsonb := jsonb_build_object(
    'valid',      false,
    'email',      null::text,
    'role',       null::text,
    'inviter',    null::text,
    'expires_at', null::timestamptz
  );
begin
  v_token := btrim(coalesce(p_token, ''));
  if char_length(v_token) < 8 or char_length(v_token) > 200 then
    return v_deny;
  end if;

  select * into v_inv from public.invitations i where i.token = v_token;

  if not found
     or v_inv.accepted_at is not null
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now()
  then
    return v_deny;
  end if;

  select public.display_name(v_inv.invited_by) into v_inviter;

  return jsonb_build_object(
    'valid',      true,
    'email',      v_inv.email,
    'role',       v_inv.role,
    'inviter',    coalesce(v_inviter, 'A teammate'),
    'expires_at', v_inv.expires_at
  );
end;
$fn$;

-- Keep-alive endpoint: POST /rest/v1/rpc/ping. Free-tier projects pause after
-- seven days without API traffic; the GitHub Action pings this twice a week.
create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = ''
as $fn$
  select now();
$fn$;


-- =============================================================================
-- 6. Row Level Security — enable + force on every table
-- =============================================================================
-- FORCE also subjects the table owner to the policies. `postgres` still
-- bypasses (BYPASSRLS), which is what lets the SQL Editor, the import path and
-- the SECURITY DEFINER triggers work.

do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'invitations', 'projects', 'project_members', 'tasks',
    'reports', 'partners', 'project_state', 'project_docs', 'comments',
    'activity'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
  end loop;
end;
$do$;


-- =============================================================================
-- 7. Policies
-- =============================================================================
-- Only the `authenticated` role gets policies; `anon` has no table grants at
-- all (section 8), so it cannot reach a policy in the first place.

-- --- profiles ---------------------------------------------------------------
-- Everyone with a profile can see the staff directory. A user may update their
-- own row; an owner may update anybody's. The BEFORE UPDATE trigger in
-- section 11 narrows that further (which columns, and the last-owner rule).
-- There is no INSERT policy: profiles are created by the signup trigger only.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.has_profile());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_owner())
  with check (id = (select auth.uid()) or public.is_owner());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_owner() and id <> (select auth.uid()));

-- --- invitations ------------------------------------------------------------
-- Admin-only in every direction. Which roles an admin may hand out is settled
-- by the guard trigger in section 11.
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select to authenticated
  using (public.is_admin());

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (public.is_admin());

-- --- projects ---------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.is_member(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.can_manage(id))
  with check (public.can_manage(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (public.is_owner());

-- --- project_members --------------------------------------------------------
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated
  using (public.is_member(project_id));

drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert on public.project_members
  for insert to authenticated
  with check (public.can_manage(project_id));

drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members
  for update to authenticated
  using (public.can_manage(project_id))
  with check (public.can_manage(project_id));

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members
  for delete to authenticated
  using (public.can_manage(project_id));

-- --- content tables: read = member, write = editor/manager/admin ------------
do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    'tasks', 'reports', 'partners', 'project_state', 'project_docs'
  ] loop
    execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_member(project_id))',
      v_table || '_select', v_table);

    execute format('drop policy if exists %I on public.%I', v_table || '_insert', v_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.can_edit(project_id))',
      v_table || '_insert', v_table);

    execute format('drop policy if exists %I on public.%I', v_table || '_update', v_table);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.can_edit(project_id)) with check (public.can_edit(project_id))',
      v_table || '_update', v_table);

    execute format('drop policy if exists %I on public.%I', v_table || '_delete', v_table);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.can_edit(project_id))',
      v_table || '_delete', v_table);
  end loop;
end;
$do$;

-- --- comments ---------------------------------------------------------------
-- Any member may comment (including viewers). Comments are immutable: there is
-- no UPDATE policy. You may delete your own; a project manager may delete any.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated
  using (public.is_member(project_id));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (public.is_member(project_id) and user_id = (select auth.uid()));

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.can_manage(project_id));

-- --- activity ---------------------------------------------------------------
-- Read-only for clients. Rows are written by the definer trigger in section 10.
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity
  for select to authenticated
  using (public.is_member(project_id));


-- =============================================================================
-- 8. Grants and revokes
-- =============================================================================
-- `anon` and PUBLIC get nothing on any table; the only thing an unauthenticated
-- caller may do is EXECUTE invite_preview() and ping(). `authenticated` gets
-- the four DML verbs on every table and RLS decides what actually happens.

grant usage on schema public to anon, authenticated, service_role;

do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'invitations', 'projects', 'project_members', 'tasks',
    'reports', 'partners', 'project_state', 'project_docs', 'comments',
    'activity'
  ] loop
    execute format('revoke all on public.%I from public', v_table);
    execute format('revoke all on public.%I from anon', v_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_table);
    execute format('grant all on public.%I to service_role', v_table);
  end loop;
end;
$do$;

-- --- function privileges ----------------------------------------------------
-- RLS policies are evaluated as the *querying* role, so `authenticated` must be
-- able to EXECUTE every helper a policy references. Everything else is locked
-- down to the owner.

revoke all on function public.has_profile()          from public;
revoke all on function public.is_owner()             from public;
revoke all on function public.is_admin()             from public;
revoke all on function public.is_member(uuid)        from public;
revoke all on function public.can_edit(uuid)         from public;
revoke all on function public.can_manage(uuid)       from public;
revoke all on function public.topic_project_id()     from public;
revoke all on function public.current_uid()          from public;
revoke all on function public.display_name(uuid)     from public;
revoke all on function public.activity_label(text)   from public;
revoke all on function public.fmt_day(text)          from public;
revoke all on function public.fmt_money(text)        from public;
revoke all on function public.invite_preview(text)   from public;
revoke all on function public.ping()                 from public;

grant execute on function public.has_profile()       to authenticated, service_role;
grant execute on function public.is_owner()          to authenticated, service_role;
grant execute on function public.is_admin()          to authenticated, service_role;
grant execute on function public.is_member(uuid)     to authenticated, service_role;
grant execute on function public.can_edit(uuid)      to authenticated, service_role;
grant execute on function public.can_manage(uuid)    to authenticated, service_role;
-- referenced by the realtime.messages policies, evaluated as `authenticated`
grant execute on function public.topic_project_id()  to authenticated, service_role;

-- The two public entry points.
grant execute on function public.invite_preview(text) to anon, authenticated, service_role;
grant execute on function public.ping()               to anon, authenticated, service_role;

-- display_name / activity_label / fmt_* / current_uid are called only from
-- inside SECURITY DEFINER functions (i.e. as `postgres`), so no role grant is
-- needed and none is given.


-- =============================================================================
-- 9. Signup trigger on auth.users — the invitation gate
-- =============================================================================
-- Runs AFTER INSERT on auth.users. Raising here aborts the whole GoTrue
-- transaction, so a bad or missing token means no auth user is created at all.
-- Every failure path returns the same message: it must not tell an attacker
-- whether a token exists, is expired, is revoked or is bound to another
-- address.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_token     text;
  v_inv       public.invitations%rowtype;
  v_role      text;
  v_name      text;
  v_email     text;
  v_has_owner boolean;
  v_grant     jsonb;
  v_pid       uuid;
  v_prole     text;
begin
  v_token := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'invite_token', '')), '');

  if v_token is null then
    raise exception 'Signups are by invitation only' using errcode = '42501';
  end if;

  -- Lock the row: two people racing the same single-use token must serialise.
  select * into v_inv
    from public.invitations i
   where i.token = v_token
     for update;

  if not found
     or v_inv.accepted_at is not null
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now()
     or (v_inv.email is not null
         and lower(v_inv.email) <> lower(coalesce(new.email, '')))
  then
    raise exception 'Signups are by invitation only' using errcode = '42501';
  end if;

  -- Global role. An `owner` invitation is honoured only while there is no
  -- owner yet (that is the bootstrap case); after that it degrades to `admin`.
  v_role := coalesce(v_inv.role, 'member');
  if v_role not in ('owner', 'admin', 'member') then
    v_role := 'member';
  end if;
  if v_role = 'owner' then
    select exists (select 1 from public.profiles p where p.role = 'owner')
      into v_has_owner;
    if v_has_owner then
      v_role := 'admin';
    end if;
  end if;

  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name',
                                  new.raw_user_meta_data ->> 'name',
                                  '')), '');
  if v_name is not null then
    v_name := left(v_name, 120);
  end if;

  v_email := nullif(lower(btrim(coalesce(new.email, ''))), '');

  insert into public.profiles as p (id, email, full_name, role)
  values (new.id, v_email, v_name, v_role)
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, p.full_name),
        role      = excluded.role;

  -- Per-project memberships carried by the invitation. Entries pointing at a
  -- project that no longer exists, or carrying an unknown role, are skipped
  -- silently rather than failing the signup.
  if jsonb_typeof(coalesce(v_inv.project_grants, '[]'::jsonb)) = 'array' then
    for v_grant in
      select e from jsonb_array_elements(v_inv.project_grants) as t(e)
    loop
      begin
        v_pid := nullif(v_grant ->> 'project_id', '')::uuid;
      exception when others then
        v_pid := null;
      end;

      v_prole := v_grant ->> 'role';

      if v_pid is not null
         and v_prole in ('manager', 'editor', 'viewer')
         and exists (select 1 from public.projects pr where pr.id = v_pid)
      then
        insert into public.project_members (project_id, user_id, role, added_by)
        values (v_pid, new.id, v_prole, v_inv.invited_by)
        on conflict (project_id, user_id) do update
          set role = excluded.role;
      end if;
    end loop;
  end if;

  -- Transaction-local marker so the invitation guard trigger knows this
  -- acceptance comes from the signup path and not from a client PATCH.
  perform set_config('mmt.signup', '1', true);

  update public.invitations
     set accepted_at = now(),
         accepted_by = new.id
   where id = v_inv.id;

  perform set_config('mmt.signup', '', true);

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 10. Audit + activity triggers
-- =============================================================================

-- --- set_audit --------------------------------------------------------------
-- Stamps updated_at/updated_by on every write and created_at/created_by on
-- insert, and pins created_* on update so a client cannot rewrite provenance.
-- auth.uid() being NULL (SQL Editor, JSON import, service role) is a normal
-- case, not an error: the columns are simply left null.
create or replace function public.set_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := public.current_uid();
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(new.created_by, v_uid);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;

  new.updated_at := now();
  new.updated_by := v_uid;

  return new;
end;
$fn$;

do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    'projects', 'tasks', 'reports', 'partners', 'project_state', 'project_docs'
  ] loop
    execute format('drop trigger if exists trg_set_audit on public.%I', v_table);
    execute format(
      'create trigger trg_set_audit before insert or update on public.%I
         for each row execute function public.set_audit()', v_table);
  end loop;
end;
$do$;

-- --- comment authorship -----------------------------------------------------
create or replace function public.set_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  new.user_id    := coalesce(public.current_uid(), new.user_id);
  new.created_at := now();
  return new;
end;
$fn$;

drop trigger if exists trg_set_comment_author on public.comments;
create trigger trg_set_comment_author
  before insert on public.comments
  for each row execute function public.set_comment_author();

-- --- log_activity -----------------------------------------------------------
-- Builds a human one-liner per change and appends it to public.activity.
--   * skips updates where nothing but updated_at / updated_by / created_at /
--     created_by / sort moved (re-ordering a board is not news);
--   * summaries are capped at 300 characters;
--   * with probability 2% per write it prunes the project's activity feed back
--     to its newest 1,000 rows, which keeps the free-tier 500 MB budget honest
--     without a cron job.
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_row     jsonb;          -- NEW for insert/update, OLD for delete
  v_pid     uuid;
  v_uid     uuid := public.current_uid();
  v_action  text;
  v_entity  text;
  v_eid     uuid;
  v_changed text[];
  v_parts   text[] := array[]::text[];
  v_summary text;
  v_target  text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_row := v_old;
    v_action := 'deleted';
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
    v_action := 'created';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
    v_action := 'updated';
  end if;

  v_pid := nullif(v_row ->> 'project_id', '')::uuid;
  if v_pid is null then
    return null;
  end if;

  -- Deleting a project cascades into these tables. Logging then would try to
  -- insert an activity row whose FK target has already gone, so: don't.
  if not exists (select 1 from public.projects pr where pr.id = v_pid) then
    return null;
  end if;

  -- Same idea for the actor: a profile being deleted cascades into comments.
  if v_uid is not null
     and not exists (select 1 from public.profiles p where p.id = v_uid) then
    v_uid := null;
  end if;

  v_entity := case tg_table_name
                when 'tasks'         then 'task'
                when 'reports'       then 'report'
                when 'partners'      then 'partner'
                when 'project_state' then 'state'
                when 'comments'      then 'comment'
                else tg_table_name
              end;

  -- jsonb_exists() rather than the `?` operator: some SQL clients treat a bare
  -- question mark as a bind placeholder.
  v_eid := case when jsonb_exists(v_row, 'id')
                then nullif(v_row ->> 'id', '')::uuid end;

  if tg_op = 'UPDATE' then
    select array_agg(k.kname)
      into v_changed
      from jsonb_object_keys(v_new) as k(kname)
     where (v_old -> k.kname) is distinct from (v_new -> k.kname)
       and k.kname <> all (array['updated_at', 'updated_by',
                                 'created_at', 'created_by', 'sort']);

    if v_changed is null or array_length(v_changed, 1) is null then
      return null;                     -- nothing worth a line in the feed
    end if;
  end if;

  -- ---------------------------------------------------------------- tasks --
  if tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then
      v_summary := 'Added "' || coalesce(v_new ->> 'title', 'untitled') || '"';
    elsif tg_op = 'DELETE' then
      v_summary := 'Removed "' || coalesce(v_old ->> 'title', 'untitled') || '"';
    else
      if 'title' = any (v_changed) then
        v_parts := v_parts || ('Renamed to "' || coalesce(v_new ->> 'title', '') || '"');
      end if;
      if 'status' = any (v_changed) then
        v_parts := v_parts || ('Status: ' || public.activity_label(v_old ->> 'status')
                               || ' → ' || public.activity_label(v_new ->> 'status'));
      end if;
      if 'pri' = any (v_changed) then
        v_parts := v_parts || ('Priority: ' || public.activity_label(v_old ->> 'pri')
                               || ' → ' || public.activity_label(v_new ->> 'pri'));
      end if;
      if 'horizon' = any (v_changed) then
        v_parts := v_parts || ('Horizon: ' || public.activity_label(v_old ->> 'horizon')
                               || ' → ' || public.activity_label(v_new ->> 'horizon'));
      end if;
      if 'due' = any (v_changed) then
        v_parts := v_parts || ('Due: ' || public.fmt_day(v_old ->> 'due')
                               || ' → ' || public.fmt_day(v_new ->> 'due'));
      end if;
      if 'assignee' = any (v_changed) then
        if v_new ->> 'assignee' is null then
          v_parts := v_parts || 'Unassigned'::text;
        else
          v_parts := v_parts || ('Assigned to ' ||
            coalesce(public.display_name((v_new ->> 'assignee')::uuid), 'someone'));
        end if;
      end if;
      if 'owner' = any (v_changed) then
        v_parts := v_parts || ('Owner: ' || coalesce(nullif(v_old ->> 'owner', ''), 'none')
                               || ' → ' || coalesce(nullif(v_new ->> 'owner', ''), 'none'));
      end if;
      if 'ws' = any (v_changed) then
        v_parts := v_parts || 'Changed workstream'::text;
      end if;
      if 'notes' = any (v_changed) then
        v_parts := v_parts || 'Edited notes'::text;
      end if;
      if 'sources' = any (v_changed) then
        v_parts := v_parts || 'Edited sources'::text;
      end if;
      if v_changed && array['why', 'done_when', 'recurring'] then
        v_parts := v_parts || 'Edited details'::text;
      end if;
      v_summary := nullif(array_to_string(v_parts, ' · '), '');
    end if;

  -- -------------------------------------------------------------- reports --
  elsif tg_table_name = 'reports' then
    if tg_op = 'INSERT' then
      v_summary := 'Added report ' || coalesce(v_new ->> 'period', '');
    elsif tg_op = 'DELETE' then
      v_summary := 'Removed report ' || coalesce(v_old ->> 'period', '');
    else
      if 'status' = any (v_changed) then
        v_parts := v_parts || ('Status: ' || public.activity_label(v_old ->> 'status')
                               || ' → ' || public.activity_label(v_new ->> 'status'));
      end if;
      if 'due' = any (v_changed) then
        v_parts := v_parts || ('Due: ' || public.fmt_day(v_old ->> 'due')
                               || ' → ' || public.fmt_day(v_new ->> 'due'));
      end if;
      if 'submitted_on' = any (v_changed) then
        v_parts := v_parts || ('Submitted ' || public.fmt_day(v_new ->> 'submitted_on'));
      end if;
      if 'amount' = any (v_changed) then
        v_parts := v_parts || ('Amount: ' || public.fmt_money(v_old ->> 'amount')
                               || ' → ' || public.fmt_money(v_new ->> 'amount'));
      end if;
      if 'checks' = any (v_changed) then
        v_parts := v_parts || 'Updated checklist'::text;
      end if;
      if 'notes' = any (v_changed) then
        v_parts := v_parts || 'Edited notes'::text;
      end if;
      if 'sources' = any (v_changed) then
        v_parts := v_parts || 'Edited sources'::text;
      end if;
      if v_changed && array['period', 'covers', 'kind'] then
        v_parts := v_parts || 'Edited details'::text;
      end if;
      v_summary := nullif(
        'Report ' || coalesce(v_new ->> 'period', '') || ' — '
        || nullif(array_to_string(v_parts, ' · '), ''), '');
    end if;

  -- ------------------------------------------------------------- partners --
  elsif tg_table_name = 'partners' then
    if tg_op = 'INSERT' then
      v_summary := 'Added partner "' || coalesce(v_new ->> 'name', 'unnamed') || '"';
    elsif tg_op = 'DELETE' then
      v_summary := 'Removed partner "' || coalesce(v_old ->> 'name', 'unnamed') || '"';
    else
      if 'name' = any (v_changed) then
        v_parts := v_parts || ('Renamed to "' || coalesce(v_new ->> 'name', '') || '"');
      end if;
      if 'stage' = any (v_changed) then
        v_parts := v_parts || ('Stage: ' || public.activity_label(v_old ->> 'stage')
                               || ' → ' || public.activity_label(v_new ->> 'stage'));
      end if;
      if 'referrals' = any (v_changed) then
        v_parts := v_parts || ('Referrals: ' || coalesce(v_old ->> 'referrals', '0')
                               || ' → ' || coalesce(v_new ->> 'referrals', '0'));
      end if;
      if 'next_step' = any (v_changed) then
        v_parts := v_parts || 'Edited next step'::text;
      end if;
      if 'contact' = any (v_changed) then
        v_parts := v_parts || 'Edited contact'::text;
      end if;
      if 'notes' = any (v_changed) then
        v_parts := v_parts || 'Edited notes'::text;
      end if;
      if v_changed && array['county', 'kind'] then
        v_parts := v_parts || 'Edited details'::text;
      end if;
      v_summary := nullif(
        '"' || coalesce(v_new ->> 'name', '') || '" — '
        || nullif(array_to_string(v_parts, ' · '), ''), '');
    end if;

  -- --------------------------------------------------------- project_state --
  elsif tg_table_name = 'project_state' then
    if tg_op = 'DELETE' then
      v_summary := 'Cleared ' || coalesce(v_old ->> 'key', 'project data');
    else
      v_summary := case v_row ->> 'key'
                     when 'metrics' then 'Updated outcomes numbers'
                     when 'budget'  then 'Updated budget figures'
                     else 'Updated ' || coalesce(v_row ->> 'key', 'project data')
                   end;
    end if;

  -- -------------------------------------------------------------- comments --
  elsif tg_table_name = 'comments' then
    v_target := case v_row ->> 'entity'
      when 'task'    then (select t.title
                             from public.tasks t
                            where t.id = nullif(v_row ->> 'entity_id', '')::uuid)
      when 'report'  then (select 'report ' || r.period
                             from public.reports r
                            where r.id = nullif(v_row ->> 'entity_id', '')::uuid)
      when 'partner' then (select pa.name
                             from public.partners pa
                            where pa.id = nullif(v_row ->> 'entity_id', '')::uuid)
      when 'doc'     then (select d.title
                             from public.project_docs d
                            where d.id = nullif(v_row ->> 'entity_id', '')::uuid)
    end;

    if tg_op = 'INSERT' then
      v_action  := 'commented';
      v_summary := 'Commented on "' || coalesce(nullif(v_target, ''), 'an item') || '"';
    elsif tg_op = 'DELETE' then
      v_summary := 'Deleted a comment on "' || coalesce(nullif(v_target, ''), 'an item') || '"';
    else
      v_summary := 'Edited a comment';
    end if;
  end if;

  -- Fallback so the feed never shows an empty line.
  if v_summary is null or btrim(v_summary) = '' then
    v_summary := case tg_op
                   when 'INSERT' then 'Added an item'
                   when 'DELETE' then 'Removed an item'
                   else 'Edited details'
                 end;
  end if;

  insert into public.activity (project_id, user_id, entity, entity_id, action, summary)
  values (v_pid, v_uid, v_entity, v_eid, v_action, left(v_summary, 300));

  -- Occasional, cheap pruning: keep the newest 1,000 rows per project.
  if random() < 0.02 then
    delete from public.activity a
     where a.project_id = v_pid
       and a.id < coalesce(
             (select min(keep.id)
                from (select a2.id
                        from public.activity a2
                       where a2.project_id = v_pid
                       order by a2.id desc
                       limit 1000) keep),
             0);
  end if;

  return null;   -- AFTER trigger: the return value is ignored
end;
$fn$;

do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    'tasks', 'reports', 'partners', 'project_state', 'comments'
  ] loop
    execute format('drop trigger if exists trg_log_activity on public.%I', v_table);
    execute format(
      'create trigger trg_log_activity after insert or update or delete on public.%I
         for each row execute function public.log_activity()', v_table);
  end loop;
end;
$do$;


-- =============================================================================
-- 11. Guard triggers
-- =============================================================================

-- --- profile protection (UPDATE) --------------------------------------------
-- A signed-in user may change only their own full_name / title / last_seen_at.
-- Only an owner may change anybody's role. id and email are immutable from the
-- client. And there is always at least one owner.
create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid         uuid := public.current_uid();
  v_is_owner    boolean;
  v_owner_count integer;
begin
  -- No JWT => postgres / service_role / the signup trigger. Let it through.
  if v_uid is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'A profile id cannot be changed' using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'A profile email cannot be changed here' using errcode = '42501';
  end if;

  new.created_at := old.created_at;

  if new.role is distinct from old.role then
    select (p.role = 'owner') into v_is_owner
      from public.profiles p where p.id = v_uid;

    if not coalesce(v_is_owner, false) then
      raise exception 'Only an owner may change roles' using errcode = '42501';
    end if;

    if old.role = 'owner' and new.role <> 'owner' then
      select count(*) into v_owner_count
        from public.profiles p where p.role = 'owner';
      if v_owner_count <= 1 then
        raise exception 'There must always be at least one owner' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Editing somebody else's profile: the role is the only thing allowed, and
  -- the owner check above has already vetted it.
  if v_uid <> old.id then
    if new.full_name    is distinct from old.full_name
       or new.title     is distinct from old.title
       or new.last_seen_at is distinct from old.last_seen_at then
      raise exception 'You may only edit your own profile' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile();

-- --- profile protection (DELETE) --------------------------------------------
-- Applies to everyone, including postgres, so the portal can never be left
-- ownerless. Drop the trigger first if you genuinely need to wipe the table.
create or replace function public.protect_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_owner_count integer;
begin
  if old.role = 'owner' then
    select count(*) into v_owner_count
      from public.profiles p where p.role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'There must always be at least one owner' using errcode = '42501';
    end if;
  end if;
  return old;
end;
$fn$;

drop trigger if exists trg_protect_profile_delete on public.profiles;
create trigger trg_protect_profile_delete
  before delete on public.profiles
  for each row execute function public.protect_profile_delete();

-- --- invitation role guard --------------------------------------------------
-- `owner` invitations are never creatable from the portal (only the bootstrap
-- block at the end of this file makes one). `admin` invitations require an
-- owner. Acceptance fields are not client-editable.
create or replace function public.guard_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := public.current_uid();
begin
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.role  := coalesce(new.role, 'member');

  if tg_op = 'INSERT' then
    new.invited_by := coalesce(new.invited_by, v_uid);
    new.expires_at := coalesce(new.expires_at, now() + interval '14 days');
  end if;

  -- The signup trigger marking an invitation accepted, or postgres /
  -- service_role doing maintenance. Neither goes through the role rules.
  if coalesce(current_setting('mmt.signup', true), '') = '1' then
    return new;
  end if;

  if v_uid is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.token       is distinct from old.token
       or new.accepted_at is distinct from old.accepted_at
       or new.accepted_by is distinct from old.accepted_by then
      raise exception 'Invitation token and acceptance cannot be edited'
        using errcode = '42501';
    end if;

    -- Leaving the role untouched is always fine (that is how the bootstrap
    -- owner invitation gets revoked once it has served its purpose).
    if new.role is not distinct from old.role then
      return new;
    end if;
  end if;

  if new.role = 'owner' then
    raise exception 'Owner invitations cannot be created from the portal'
      using errcode = '42501';
  end if;

  if new.role = 'admin' and not public.is_owner() then
    raise exception 'Only an owner may invite an administrator'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_guard_invitation on public.invitations;
create trigger trg_guard_invitation
  before insert or update on public.invitations
  for each row execute function public.guard_invitation();

-- --- project creator becomes a manager --------------------------------------
create or replace function public.add_project_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := coalesce(public.current_uid(), new.created_by);
begin
  if v_uid is not null
     and exists (select 1 from public.profiles p where p.id = v_uid) then
    insert into public.project_members (project_id, user_id, role, added_by)
    values (new.id, v_uid, 'manager', v_uid)
    on conflict (project_id, user_id) do nothing;
  end if;
  return null;
end;
$fn$;

drop trigger if exists trg_add_project_creator on public.projects;
create trigger trg_add_project_creator
  after insert on public.projects
  for each row execute function public.add_project_creator();


-- =============================================================================
-- 12. Privileges for trigger / internal functions
-- =============================================================================
-- PostgreSQL checks EXECUTE on a trigger function when the trigger is created,
-- not when it fires, so revoking these from PUBLIC does not break anything.

revoke all on function public.handle_new_user()         from public;
revoke all on function public.set_audit()               from public;
revoke all on function public.set_comment_author()      from public;
revoke all on function public.log_activity()            from public;
revoke all on function public.protect_profile()         from public;
revoke all on function public.protect_profile_delete()  from public;
revoke all on function public.guard_invitation()        from public;
revoke all on function public.add_project_creator()     from public;

-- Supabase's default privileges grant EXECUTE on every new function in `public`
-- straight to `anon` and `authenticated`, so revoking from PUBLIC alone is not
-- enough. Internal helpers and trigger functions: nobody but the owner.
revoke all on function public.current_uid()             from anon, authenticated;
revoke all on function public.display_name(uuid)        from anon, authenticated;
revoke all on function public.activity_label(text)      from anon, authenticated;
revoke all on function public.fmt_day(text)             from anon, authenticated;
revoke all on function public.fmt_money(text)           from anon, authenticated;
revoke all on function public.handle_new_user()         from anon, authenticated;
revoke all on function public.set_audit()               from anon, authenticated;
revoke all on function public.set_comment_author()      from anon, authenticated;
revoke all on function public.log_activity()            from anon, authenticated;
revoke all on function public.protect_profile()         from anon, authenticated;
revoke all on function public.protect_profile_delete()  from anon, authenticated;
revoke all on function public.guard_invitation()        from anon, authenticated;
revoke all on function public.add_project_creator()     from anon, authenticated;
-- RLS helpers: `authenticated` needs them (policies run as the caller); `anon` never does.
revoke all on function public.has_profile()             from anon;
revoke all on function public.is_owner()                from anon;
revoke all on function public.is_admin()                from anon;
revoke all on function public.is_member(uuid)           from anon;
revoke all on function public.can_edit(uuid)            from anon;
revoke all on function public.can_manage(uuid)          from anon;
revoke all on function public.topic_project_id()        from anon;


-- =============================================================================
-- 13. Realtime — publication membership + replica identity
-- =============================================================================
-- Guarded so re-running the migration does not error with
-- "relation is already member of publication".

do $do$
declare
  v_table text;
begin
  if not exists (select 1 from pg_catalog.pg_publication
                  where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;

  foreach v_table in array array[
    'projects', 'project_members', 'tasks', 'reports', 'partners',
    'project_state', 'project_docs', 'comments', 'activity'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_publication_tables pt
       where pt.pubname = 'supabase_realtime'
         and pt.schemaname = 'public'
         and pt.tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$do$;

-- DELETE events only carry the replica identity. These tables have a plain
-- uuid primary key, so without FULL a delete would reach the client without a
-- project_id and could be neither RLS-filtered nor routed to the right channel.
-- project_members / project_state already lead their PK with project_id, and
-- activity is never deleted interactively, so those keep the default.
alter table public.tasks         replica identity full;
alter table public.reports       replica identity full;
alter table public.partners      replica identity full;
alter table public.comments      replica identity full;
alter table public.project_docs  replica identity full;


-- =============================================================================
-- 14. Realtime — private `project:<uuid>` channels
-- =============================================================================
-- Presence and broadcast run on private channels named `project:<uuid>`.
-- public.topic_project_id() returns NULL for anything that is not a well-formed
-- project topic, and public.is_member(null) is FALSE, so a malformed topic is
-- denied rather than raising an error mid-policy.
-- Wrapped in a guard so the script still runs against a database that has no
-- realtime schema (a plain Postgres, for instance).

do $do$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages not found — skipping private channel policies';
    return;
  end if;

  execute 'grant select, insert on realtime.messages to authenticated';

  execute 'drop policy if exists mmt_project_channel_read on realtime.messages';
  execute $p$
    create policy mmt_project_channel_read on realtime.messages
      for select to authenticated
      using (public.is_member(public.topic_project_id()))
  $p$;

  execute 'drop policy if exists mmt_project_channel_write on realtime.messages';
  execute $p$
    create policy mmt_project_channel_write on realtime.messages
      for insert to authenticated
      with check (public.is_member(public.topic_project_id()))
  $p$;
end;
$do$;


-- =============================================================================
-- 15. Bootstrap — one owner invitation
-- =============================================================================
-- Created only on a virgin database: no profiles and no owner invitation yet.
-- Hand the token to the site owner as https://www.mercermedtech.com/admin/#/join/<token>
-- Their signup becomes the first `owner`; every later account comes from an
-- invitation they issue in the portal. Revoke this row once it has been used —
-- it is single-use anyway, since signup stamps accepted_at.

do $do$
begin
  if not exists (select 1 from public.profiles)
     and not exists (select 1 from public.invitations i where i.role = 'owner')
  then
    insert into public.invitations (role, email, expires_at, note)
    values ('owner', null, now() + interval '30 days', 'Bootstrap owner invite');
  end if;
end;
$do$;

-- The SQL Editor shows the result of the last statement: that is the join token.
select token from public.invitations where role = 'owner' and accepted_at is null;
