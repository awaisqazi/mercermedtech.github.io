-- =============================================================================
-- MMT Workbench v2: the staff workspace
-- =============================================================================
-- Applies on top of 0001_admin_portal.sql.
-- How to run  : `supabase db push` with the linked CLI, or paste the whole file
--               into the SQL Editor. Both run it as `postgres` and both run it
--               as one transaction, so a failure leaves nothing half done.
--               There is deliberately no BEGIN / COMMIT in this file: the CLI
--               supplies the transaction, and an explicit COMMIT here would end
--               it early.
-- Idempotency : safe to re-run. Every step either checks the shape it expects
--               (v1 tables are renamed only while they still look like v1) or
--               uses `if not exists`, `create or replace`, `drop ... if exists`
--               before `create`, and `on conflict do nothing`.
-- Contents    : no staff names, e-mail addresses, figures or business data.
--               The repository is public; the data lives in the database.
--
--   0. Preconditions
--   1. Detach the v1 portal (policies, triggers, helpers on the old tables)
--   2. Rename the nine v1 content tables to legacy_*
--   3. Roles: permission catalogue, table, seed
--   4. profiles and invitations: role_id replaces role / project_grants
--   5. New tables
--   6. Indexes
--   7. RLS helper functions
--   8. Presentation helpers (internal)
--   9. Public RPCs: invite_preview, ping
--  10. Row level security: enable and force
--  11. Policies
--  12. Table grants
--  13. Signup trigger on auth.users
--  14. Audit and guard triggers
--  15. Carry the v1 work over (projects, tasks, task comments)
--  16. Activity feed trigger
--  17. Function privileges
--  18. Realtime: publication and replica identity
--  19. Realtime: the private `workspace` channel
--  20. Inquiries: the public forms' responses copied into the portal
--  21. Bootstrap owner invitation, only if there is no owner
-- =============================================================================


-- =============================================================================
-- 0. Preconditions
-- =============================================================================

do $do$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.invitations') is null then
    raise exception 'Run 0001_admin_portal.sql first: public.profiles and public.invitations are missing';
  end if;
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception 'pgcrypto must be installed in schema "extensions"';
  end if;
end;
$do$;


-- =============================================================================
-- 1. Detach the v1 portal
-- =============================================================================
-- The realtime policies call is_member() / topic_project_id(); the profile and
-- invitation policies call is_owner() / is_admin(). All of them are dropped
-- here and the v2 versions are created further down. The profile and
-- invitation guard triggers are dropped too, so the backfill in section 4
-- cannot trip over v1 code that still reads the old `role` column.

do $do$
declare
  v_pol record;
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists mmt_project_channel_read on realtime.messages';
    execute 'drop policy if exists mmt_project_channel_write on realtime.messages';
  end if;

  for v_pol in
    select pol.tablename, pol.policyname
      from pg_catalog.pg_policies pol
     where pol.schemaname = 'public'
       and pol.tablename in ('profiles', 'invitations')
  loop
    execute format('drop policy %I on public.%I', v_pol.policyname, v_pol.tablename);
  end loop;
end;
$do$;

drop trigger if exists trg_protect_profile        on public.profiles;
drop trigger if exists trg_protect_profile_delete on public.profiles;
drop trigger if exists trg_guard_invitation       on public.invitations;


-- =============================================================================
-- 2. Rename the v1 content tables to legacy_*
-- =============================================================================
-- Every row is kept. A table is renamed only while it still has its v1 shape,
-- so a second run finds nothing to do. On the way out each table loses its
-- policies, triggers and publication membership, stays RLS enabled and forced
-- with no policies, and loses every grant to anon and authenticated: nothing
-- can read it through the API. Its indexes are renamed as well, so the new
-- tables can use the plain names (projects_pkey and so on).

do $do$
declare
  v_name   text;
  v_legacy text;
  v_is_v1  boolean;
  v_rel    regclass;
  v_row    record;
begin
  foreach v_name in array array[
    'projects', 'project_members', 'tasks', 'reports', 'partners',
    'project_state', 'project_docs', 'comments', 'activity'
  ] loop
    v_legacy := 'legacy_' || v_name;

    -- projects, tasks and activity are names v2 reuses, so check the shape.
    v_is_v1 := case v_name
      when 'projects' then exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = 'projects'
           and c.column_name = 'slug')
      when 'tasks' then exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = 'tasks'
           and c.column_name = 'pri')
      when 'activity' then exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = 'activity'
           and c.column_name = 'project_id')
      else to_regclass(format('public.%I', v_name)) is not null
    end;

    if v_is_v1 then
      if to_regclass(format('public.%I', v_legacy)) is not null then
        raise exception 'Both public.% and public.% exist. Move one aside by hand, then run this again.',
          v_name, v_legacy;
      end if;

      v_rel := format('public.%I', v_name)::regclass;

      for v_row in
        select pol.policyname from pg_catalog.pg_policies pol
         where pol.schemaname = 'public' and pol.tablename = v_name
      loop
        execute format('drop policy %I on public.%I', v_row.policyname, v_name);
      end loop;

      for v_row in
        select t.tgname from pg_catalog.pg_trigger t
         where t.tgrelid = v_rel and not t.tgisinternal
      loop
        execute format('drop trigger %I on public.%I', v_row.tgname, v_name);
      end loop;

      if exists (
        select 1 from pg_catalog.pg_publication_tables pt
         where pt.pubname = 'supabase_realtime'
           and pt.schemaname = 'public' and pt.tablename = v_name
      ) then
        execute format('alter publication supabase_realtime drop table public.%I', v_name);
      end if;

      execute format('alter table public.%I rename to %I', v_name, v_legacy);
      execute format(
        'comment on table public.%I is %L', v_legacy,
        'Workbench v1 data, kept read-only by 0002_workspace.sql. Not carried over yet.');
    end if;

    -- Applies on every run: the lock-down is cheap and keeps legacy_* sealed.
    if to_regclass(format('public.%I', v_legacy)) is not null then
      v_rel := format('public.%I', v_legacy)::regclass;

      execute format('alter table public.%I enable row level security', v_legacy);
      execute format('alter table public.%I force row level security', v_legacy);
      execute format('revoke all on public.%I from public, anon, authenticated', v_legacy);

      for v_row in
        select ic.relname
          from pg_catalog.pg_index i
          join pg_catalog.pg_class ic on ic.oid = i.indexrelid
         where i.indrelid = v_rel
           and ic.relname not like 'legacy\_%'
      loop
        -- Renaming a constraint's index renames the constraint with it.
        execute format('alter index public.%I rename to %I',
                       v_row.relname, left('legacy_' || v_row.relname, 63));
      end loop;
    end if;
  end loop;
end;
$do$;

-- v1 helpers and trigger functions that only make sense for the old tables.
-- is_admin() and fmt_money() go too: the first reads the dropped role column,
-- the second formatted grant figures.
drop function if exists public.is_member(uuid);
drop function if exists public.can_edit(uuid);
drop function if exists public.can_manage(uuid);
drop function if exists public.topic_project_id();
drop function if exists public.log_activity();
drop function if exists public.add_project_creator();
drop function if exists public.is_admin();
drop function if exists public.fmt_money(text);


-- =============================================================================
-- 3. Roles
-- =============================================================================

-- The fixed permission catalogue. Mirrored by PERMISSIONS in src/admin/lib/types.ts.
create or replace function public.permission_catalogue()
returns text[]
language sql
immutable
set search_path = ''
as $fn$
  select array[
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
    'inquiries.manage'
  ]::text[];
$fn$;

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique
              check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  permissions text[] not null default '{}'::text[],
  is_system   boolean not null default false,
  sort        integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint roles_permissions_check check (
    permissions <@ public.permission_catalogue()
    and array_position(permissions, null) is null
  )
);

-- Seed roles. `on conflict do nothing`: once seeded, a role belongs to whoever
-- edits it in the portal, and a re-run must not undo their changes.
insert into public.roles (key, name, description, permissions, is_system, sort) values
  ('owner', 'Owner',
   'Everything. Only an owner can give or take the owner role.',
   public.permission_catalogue(), true, 10),
  ('administrator', 'Administrator',
   'Everything except the owner role.',
   public.permission_catalogue(), false, 20),
  ('technology_lead', 'Technology lead',
   'Runs tasks and projects, and sees the team''s hours.',
   array['tasks.create', 'tasks.assign', 'tasks.edit_any', 'tasks.delete',
         'hours.log', 'hours.view_all', 'projects.manage',
         'inquiries.view', 'inquiries.manage']::text[], false, 30),
  ('instructor', 'Instructor',
   'Makes and assigns tasks, logs hours, and sees the inbox.',
   array['tasks.create', 'tasks.assign', 'hours.log', 'inquiries.view']::text[], false, 40),
  ('course_designer', 'Course designer',
   'Makes and assigns tasks, logs hours, and sees the inbox.',
   array['tasks.create', 'tasks.assign', 'hours.log', 'inquiries.view']::text[], false, 50),
  ('finance', 'Finance',
   'Sees, corrects, closes and exports the team''s hours.',
   array['tasks.create', 'tasks.assign', 'hours.log', 'hours.view_all',
         'hours.edit_any', 'hours.close', 'hours.export']::text[], false, 60),
  ('member', 'Team member',
   'Makes tasks and logs hours.',
   array['tasks.create', 'hours.log']::text[], false, 70)
on conflict (key) do nothing;

-- The owner role always carries the whole catalogue, and is always a system role.
update public.roles r
   set permissions = public.permission_catalogue(),
       is_system   = true
 where r.key = 'owner'
   and (r.permissions is distinct from public.permission_catalogue() or not r.is_system);


-- =============================================================================
-- 4. profiles and invitations: role_id
-- =============================================================================
-- Old global roles map: owner -> owner, admin -> administrator,
-- member -> member. Accepted and revoked invitations are kept as history and
-- mapped the same way.

alter table public.profiles
  add column if not exists role_id uuid references public.roles (id) on delete restrict;
alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.invitations
  add column if not exists role_id uuid references public.roles (id) on delete cascade;

do $do$
begin
  if exists (
    select 1 from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'role'
  ) then
    execute $q$
      update public.profiles p
         set role_id = r.id
        from public.roles r
       where p.role_id is null
         and r.key = case p.role
                       when 'owner' then 'owner'
                       when 'admin' then 'administrator'
                       else 'member'
                     end
    $q$;
  end if;

  if exists (
    select 1 from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'invitations' and c.column_name = 'role'
  ) then
    execute $q$
      update public.invitations i
         set role_id = r.id
        from public.roles r
       where i.role_id is null
         and r.key = case i.role
                       when 'owner' then 'owner'
                       when 'admin' then 'administrator'
                       else 'member'
                     end
    $q$;
  end if;

  update public.profiles p
     set role_id = (select r.id from public.roles r where r.key = 'member')
   where p.role_id is null;

  update public.invitations i
     set role_id = (select r.id from public.roles r where r.key = 'member')
   where i.role_id is null;
end;
$do$;

alter table public.profiles    alter column role_id set not null;
alter table public.invitations alter column role_id set not null;

alter table public.profiles    drop column if exists role;
alter table public.invitations drop column if exists role;
alter table public.invitations drop column if exists project_grants;


-- =============================================================================
-- 5. New tables
-- =============================================================================

-- --- projects: a light grouping, no membership -------------------------------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 200),
  code       text not null unique check (code ~ '^[A-Z0-9]{2,6}$'),
  track      text not null default 'org' check (track in ('med', 'tech', 'org')),
  summary    text not null default '' check (char_length(summary) <= 2000),
  status     text not null default 'active' check (status in ('active', 'archived')),
  lead_id    uuid references public.profiles (id) on delete set null,
  sort       integer not null default 100,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- tasks -------------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 10000),
  status      text not null default 'todo'
              check (status in ('todo', 'doing', 'blocked', 'done')),
  priority    text not null default 'normal'
              check (priority in ('normal', 'high', 'urgent')),
  assignee_id uuid references public.profiles (id) on delete set null,
  due         date,
  progress    smallint not null default 0 check (progress between 0 and 100),
  done_at     timestamptz,
  sort        integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --- task_items: the checklist -----------------------------------------------
create table if not exists public.task_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 500),
  done       boolean not null default false,
  sort       integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- task_comments: immutable; delete your own -------------------------------
create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- --- time_entries ------------------------------------------------------------
-- user_id is ON DELETE RESTRICT on purpose: hours are a record, so a person
-- who has logged hours is deactivated rather than deleted.
create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references public.profiles (id) on delete restrict,
  work_date  date not null,
  hours      numeric(5, 2) not null
             check (hours > 0 and hours <= 24 and hours * 4 = floor(hours * 4)),
  project_id uuid references public.projects (id) on delete set null,
  task_id    uuid references public.tasks (id) on delete set null,
  summary    text not null check (char_length(summary) between 1 and 1000),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- hours_months: a row means the month is closed ---------------------------
create table if not exists public.hours_months (
  month     date primary key check (extract(day from month) = 1),
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz not null default now(),
  note      text not null default '' check (char_length(note) <= 500)
);

-- --- activity: written only by the trigger in section 16 ---------------------
-- entity_id and task_id carry no foreign key: a deleted task keeps its history
-- until the feed prunes it.
create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  entity     text not null
             check (entity in ('task', 'task_item', 'comment', 'time_entry', 'project',
                               'profile', 'role', 'invitation', 'month', 'inquiry')),
  entity_id  uuid,
  task_id    uuid,
  action     text not null
             check (action in ('created', 'updated', 'deleted', 'commented',
                               'closed', 'reopened')),
  summary    text not null check (char_length(summary) between 1 and 300),
  created_at timestamptz not null default now()
);


-- =============================================================================
-- 6. Indexes
-- =============================================================================

create index if not exists tasks_status_due_idx
  on public.tasks (status, due);
create index if not exists tasks_open_assignee_idx
  on public.tasks (assignee_id) where status <> 'done';
create index if not exists tasks_project_idx
  on public.tasks (project_id);

create index if not exists task_items_task_sort_idx
  on public.task_items (task_id, sort);

create index if not exists task_comments_task_created_idx
  on public.task_comments (task_id, created_at);

create index if not exists time_entries_user_date_idx
  on public.time_entries (user_id, work_date desc);
create index if not exists time_entries_project_date_idx
  on public.time_entries (project_id, work_date);
create index if not exists time_entries_task_idx
  on public.time_entries (task_id);

create index if not exists activity_created_idx
  on public.activity (created_at desc);
create index if not exists activity_task_created_idx
  on public.activity (task_id, created_at desc);

create index if not exists profiles_role_id_idx
  on public.profiles (role_id);

create index if not exists invitations_open_token_idx
  on public.invitations (token)
  where accepted_at is null and revoked_at is null;


-- =============================================================================
-- 7. RLS helper functions
-- =============================================================================
-- SECURITY DEFINER, owned by postgres, stable, empty search_path, fully
-- qualified. postgres has BYPASSRLS, so reading profiles or roles here never
-- re-enters the policies that call these helpers. Policies wrap them in
-- (select ...) so Postgres evaluates them once per statement, not per row.
-- An inactive account counts as no account: every helper checks `active`.

-- auth.uid() that can never raise. Used by triggers.
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
    select 1 from public.profiles pr
     where pr.id = (select auth.uid()) and pr.active
  );
$fn$;

create or replace function public.my_role_key()
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  select r.key
    from public.profiles pr
    join public.roles r on r.id = pr.role_id
   where pr.id = (select auth.uid()) and pr.active;
$fn$;

create or replace function public.has_perm(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.profiles pr
      join public.roles r on r.id = pr.role_id
     where pr.id = (select auth.uid())
       and pr.active
       and has_perm.p = any (r.permissions)
  );
$fn$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(public.my_role_key() = 'owner', false);
$fn$;

-- Created by me or assigned to me (and my account is active).
create or replace function public.task_is_mine(task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select public.has_profile() and exists (
    select 1 from public.tasks t
     where t.id = task_is_mine.task_id
       and (t.created_by = (select auth.uid()) or t.assignee_id = (select auth.uid()))
  );
$fn$;

create or replace function public.month_is_closed(d date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.hours_months m
     where m.month = date_trunc('month', month_is_closed.d::timestamp)::date
  );
$fn$;

-- True only inside the private realtime channel named `workspace`. Never
-- raises, so a malformed topic is a denied policy, not an error.
create or replace function public.topic_is_workspace()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_topic text;
begin
  begin
    v_topic := realtime.topic();
  exception when others then
    return false;
  end;
  return coalesce(v_topic = 'workspace', false);
end;
$fn$;


-- =============================================================================
-- 8. Presentation helpers (internal, used only inside definer functions)
-- =============================================================================

create or replace function public.activity_label(p_value text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select case p_value
    when 'todo'     then 'To do'
    when 'doing'    then 'In progress'
    when 'blocked'  then 'Blocked'
    when 'done'     then 'Done'
    when 'normal'   then 'Normal'
    when 'high'     then 'High'
    when 'urgent'   then 'Urgent'
    when 'active'   then 'Active'
    when 'archived' then 'Archived'
    when 'new'       then 'New'
    when 'contacted' then 'Contacted'
    when 'enrolled'  then 'Enrolled'
    when 'closed'    then 'Closed'
    else coalesce(initcap(replace(p_value, '_', ' ')), 'none')
  end;
$fn$;

-- 'Nov 7' or 'none'. Takes text because callers read it out of to_jsonb(row).
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
-- 9. Public RPCs
-- =============================================================================

-- invite_preview(token): the only thing a visitor without an account may
-- learn. Every invalid case returns the same payload, so the endpoint cannot
-- be used to probe for live tokens. `inviter` is a display name only.
create or replace function public.invite_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_inv       public.invitations%rowtype;
  v_token     text;
  v_inviter   text;
  v_role_key  text;
  v_role_name text;
  v_deny      constant jsonb := jsonb_build_object(
    'valid',      false,
    'email',      null::text,
    'role_name',  null::text,
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

  select r.key, r.name into v_role_key, v_role_name
    from public.roles r where r.id = v_inv.role_id;

  -- Mirror handle_new_user(): an owner invitation used while an owner exists
  -- becomes an administrator account.
  if v_role_key = 'owner' and exists (
    select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
     where r.key = 'owner' and p.active
  ) then
    select r.name into v_role_name from public.roles r where r.key = 'administrator';
  end if;

  select public.display_name(v_inv.invited_by) into v_inviter;

  return jsonb_build_object(
    'valid',      true,
    'email',      v_inv.email,
    'role_name',  v_role_name,
    'inviter',    coalesce(v_inviter, 'A teammate'),
    'expires_at', v_inv.expires_at
  );
end;
$fn$;

-- Keep-alive endpoint: POST /rest/v1/rpc/ping.
create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = ''
as $fn$
  select now();
$fn$;


-- =============================================================================
-- 10. Row level security: enable and force on every v2 table
-- =============================================================================

do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    'roles', 'profiles', 'invitations', 'projects', 'tasks', 'task_items',
    'task_comments', 'time_entries', 'hours_months', 'activity'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
  end loop;
end;
$do$;


-- =============================================================================
-- 11. Policies (authenticated only; anon has no table grants)
-- =============================================================================

-- --- roles -------------------------------------------------------------------
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using ((select public.has_profile()));

drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles
  for insert to authenticated
  with check ((select public.has_perm('roles.manage')));

drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles
  for update to authenticated
  using ((select public.has_perm('roles.manage')))
  with check ((select public.has_perm('roles.manage')));

drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles
  for delete to authenticated
  using ((select public.has_perm('roles.manage')));

-- --- profiles ----------------------------------------------------------------
-- Which columns each side may change is settled by protect_profile().
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select public.has_profile()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (
    (id = (select auth.uid()) and (select public.has_profile()))
    or (select public.has_perm('people.manage'))
  )
  with check (
    (id = (select auth.uid()) and (select public.has_profile()))
    or (select public.has_perm('people.manage'))
  );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using ((select public.has_perm('people.manage')) and id <> (select auth.uid()));

-- --- invitations -------------------------------------------------------------
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select to authenticated
  using ((select public.has_perm('people.manage')));

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check ((select public.has_perm('people.manage')));

drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations
  for update to authenticated
  using ((select public.has_perm('people.manage')))
  with check ((select public.has_perm('people.manage')));

drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations
  for delete to authenticated
  using ((select public.has_perm('people.manage')));

-- --- projects ----------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using ((select public.has_profile()));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check ((select public.has_perm('projects.manage')));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using ((select public.has_perm('projects.manage')))
  with check ((select public.has_perm('projects.manage')));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using ((select public.has_perm('projects.manage')));

-- --- tasks -------------------------------------------------------------------
-- Update: anyone with an active account may reach an unassigned task, but
-- guard_task() lets them change only one thing on it: the assignee, to
-- themselves. WITH CHECK reads the row as it was before the update through
-- task_is_mine(id), so an assignee may still hand a task on (given
-- tasks.assign), and `assignee_id = me` covers taking one.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using ((select public.has_profile()));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    (select public.has_perm('tasks.create'))
    and created_by = (select auth.uid())
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    (select public.has_perm('tasks.edit_any'))
    or (
      (select public.has_profile())
      and (created_by = (select auth.uid())
           or assignee_id = (select auth.uid())
           or assignee_id is null)
    )
  )
  with check (
    (select public.has_perm('tasks.edit_any'))
    or public.task_is_mine(id)
    or (assignee_id = (select auth.uid()) and (select public.has_profile()))
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (
    (select public.has_perm('tasks.delete'))
    or (created_by = (select auth.uid()) and (select public.has_profile()))
  );

-- --- task_items: the same rule as updating the parent task -------------------
drop policy if exists task_items_select on public.task_items;
create policy task_items_select on public.task_items
  for select to authenticated
  using ((select public.has_profile()));

drop policy if exists task_items_insert on public.task_items;
create policy task_items_insert on public.task_items
  for insert to authenticated
  with check ((select public.has_perm('tasks.edit_any')) or public.task_is_mine(task_id));

drop policy if exists task_items_update on public.task_items;
create policy task_items_update on public.task_items
  for update to authenticated
  using ((select public.has_perm('tasks.edit_any')) or public.task_is_mine(task_id))
  with check ((select public.has_perm('tasks.edit_any')) or public.task_is_mine(task_id));

drop policy if exists task_items_delete on public.task_items;
create policy task_items_delete on public.task_items
  for delete to authenticated
  using ((select public.has_perm('tasks.edit_any')) or public.task_is_mine(task_id));

-- --- task_comments: no update policy, comments are immutable ------------------
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
  for select to authenticated
  using ((select public.has_profile()));

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check ((select public.has_profile()) and user_id = (select auth.uid()));

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.has_profile()))
    or (select public.has_perm('tasks.edit_any'))
  );

-- --- time_entries ------------------------------------------------------------
-- The closed-month rule and the 24-hour day live in guard_time_entry().
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.has_profile()))
    or (select public.has_perm('hours.view_all'))
  );

drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    ((select public.has_perm('hours.log')) and user_id = (select auth.uid()))
    or (select public.has_perm('hours.edit_any'))
  );

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.has_profile()))
    or (select public.has_perm('hours.edit_any'))
  )
  with check (
    (user_id = (select auth.uid()) and (select public.has_profile()))
    or (select public.has_perm('hours.edit_any'))
  );

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.has_profile()))
    or (select public.has_perm('hours.edit_any'))
  );

-- --- hours_months: no update policy ------------------------------------------
drop policy if exists hours_months_select on public.hours_months;
create policy hours_months_select on public.hours_months
  for select to authenticated
  using ((select public.has_profile()));

drop policy if exists hours_months_insert on public.hours_months;
create policy hours_months_insert on public.hours_months
  for insert to authenticated
  with check ((select public.has_perm('hours.close')));

drop policy if exists hours_months_delete on public.hours_months;
create policy hours_months_delete on public.hours_months
  for delete to authenticated
  using ((select public.has_perm('hours.close')));

-- --- activity: read-only for clients -----------------------------------------
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity
  for select to authenticated
  using ((select public.has_profile()));


-- =============================================================================
-- 12. Table grants
-- =============================================================================
-- anon and PUBLIC: nothing. authenticated: the verbs each table has policies
-- for, so a verb with no policy fails loudly instead of matching zero rows.

grant usage on schema public to anon, authenticated, service_role;

do $do$
declare
  v_spec text[];
begin
  foreach v_spec slice 1 in array array[
    array['roles',         'select, insert, update, delete'],
    array['profiles',      'select, update, delete'],
    array['invitations',   'select, insert, update, delete'],
    array['projects',      'select, insert, update, delete'],
    array['tasks',         'select, insert, update, delete'],
    array['task_items',    'select, insert, update, delete'],
    array['task_comments', 'select, insert, delete'],
    array['time_entries',  'select, insert, update, delete'],
    array['hours_months',  'select, insert, delete'],
    array['activity',      'select']
  ] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v_spec[1]);
    execute format('grant %s on public.%I to authenticated', v_spec[2], v_spec[1]);
    execute format('grant all on public.%I to service_role', v_spec[1]);
  end loop;
end;
$do$;


-- =============================================================================
-- 13. Signup trigger on auth.users: the invitation gate
-- =============================================================================
-- Raising here aborts the whole GoTrue transaction, so a bad token means no
-- auth user at all. Every failure path raises the same message.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_token    text;
  v_inv      public.invitations%rowtype;
  v_role_id  uuid;
  v_role_key text;
  v_name     text;
  v_email    text;
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

  select r.id, r.key into v_role_id, v_role_key
    from public.roles r where r.id = v_inv.role_id;

  -- An owner invitation is honoured only while there is no active owner (the
  -- bootstrap case); after that it becomes an administrator account.
  if v_role_key = 'owner' and exists (
    select 1 from public.profiles p
     where p.role_id = v_role_id and p.active
  ) then
    select r.id, r.key into v_role_id, v_role_key
      from public.roles r where r.key = 'administrator';
  end if;

  if v_role_id is null then
    select r.id into v_role_id from public.roles r where r.key = 'member';
  end if;

  if v_role_id is null then
    raise exception 'Signups are by invitation only' using errcode = '42501';
  end if;

  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name',
                                  new.raw_user_meta_data ->> 'name',
                                  '')), '');
  if v_name is not null then
    v_name := left(v_name, 120);
  end if;

  v_email := nullif(lower(btrim(coalesce(new.email, ''))), '');

  insert into public.profiles as p (id, email, full_name, role_id, active)
  values (new.id, v_email, v_name, v_role_id, true)
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, p.full_name),
        role_id   = excluded.role_id,
        active    = true;

  -- Transaction-local marker so guard_invitation() knows this acceptance comes
  -- from the signup path and not from a client.
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
-- 14. Audit and guard triggers
-- =============================================================================
-- Convention: current_uid() null means postgres, service_role or the signup
-- trigger. Those writes skip the client rules (but never the last-owner rule).
-- pg_trigger_depth() > 1 means the write was caused by another trigger or by a
-- foreign key action (a checklist recomputing its task's progress, a deleted
-- profile unassigning tasks); those skip the client rules too, because the
-- statement that caused them was already checked.

-- --- set_audit ---------------------------------------------------------------
-- Stamps created_* on insert and updated_* on every write, and pins created_*
-- on update. A client cannot choose these values. postgres may (the carry-over
-- in section 15 keeps the v1 timestamps).
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
    if v_uid is null then
      new.created_at := coalesce(new.created_at, now());
      new.updated_at := coalesce(new.updated_at, new.created_at);
      return new;
    end if;
    new.created_at := now();
    new.created_by := v_uid;
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
  foreach v_table in array array['projects', 'tasks', 'task_items', 'time_entries'] loop
    execute format('drop trigger if exists trg_set_audit on public.%I', v_table);
    execute format(
      'create trigger trg_set_audit before insert or update on public.%I
         for each row execute function public.set_audit()', v_table);
  end loop;
end;
$do$;

-- --- roles -------------------------------------------------------------------
-- System roles (the owner role) cannot be edited or deleted from the portal.
-- A role in use, by a person or an open invitation, cannot be deleted.
create or replace function public.guard_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := public.current_uid();
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'The % role is built in and cannot be deleted', old.name
        using errcode = '42501';
    end if;
    if exists (select 1 from public.profiles p where p.role_id = old.id) then
      raise exception 'This role is in use. Move its people to another role first.'
        using errcode = '42501';
    end if;
    if exists (
      select 1 from public.invitations i
       where i.role_id = old.id and i.accepted_at is null and i.revoked_at is null
    ) then
      raise exception 'This role has open invitations. Revoke them first.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- Store permissions sorted and without repeats.
  new.permissions := coalesce(
    array(select distinct e from unnest(new.permissions) as u(e) order by e),
    '{}'::text[]);

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    if v_uid is not null then
      new.is_system := false;
    end if;
    return new;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();

  if v_uid is not null then
    if old.is_system then
      raise exception 'The % role is built in and cannot be changed', old.name
        using errcode = '42501';
    end if;
    if new.is_system is distinct from old.is_system then
      raise exception 'A role cannot be made a built-in role' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_guard_role on public.roles;
create trigger trg_guard_role
  before insert or update or delete on public.roles
  for each row execute function public.guard_role();

-- --- profiles (UPDATE) -------------------------------------------------------
-- Yourself: full_name, title, last_seen_at. Never your own role, never your
-- own deactivation. Someone else (people.manage): role_id, active, title,
-- full_name. Anything touching an owner, or the owner role, needs an owner.
-- There is always at least one active owner, whoever is asking.
create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid       uuid := public.current_uid();
  v_owner_id  uuid;
  v_was_owner boolean;
  v_is_owner  boolean;
begin
  select r.id into v_owner_id from public.roles r where r.key = 'owner';

  v_was_owner := old.role_id = v_owner_id;
  v_is_owner  := new.role_id = v_owner_id;

  if v_was_owner and old.active
     and (not v_is_owner or not new.active)
     and not exists (
       select 1 from public.profiles p
        where p.role_id = v_owner_id and p.active and p.id <> old.id)
  then
    raise exception 'There must always be at least one active owner' using errcode = '42501';
  end if;

  if v_uid is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'A profile id cannot be changed' using errcode = '42501';
  end if;
  if new.email is distinct from old.email then
    raise exception 'A profile email cannot be changed here' using errcode = '42501';
  end if;
  new.created_at := old.created_at;

  if v_uid = old.id then
    if new.role_id is distinct from old.role_id then
      raise exception 'You cannot change your own role' using errcode = '42501';
    end if;
    if new.active is distinct from old.active then
      raise exception 'You cannot deactivate your own account' using errcode = '42501';
    end if;
    return new;
  end if;

  if not public.has_perm('people.manage') then
    raise exception 'You can only edit your own profile' using errcode = '42501';
  end if;

  -- last_seen_at is the person's own business.
  new.last_seen_at := old.last_seen_at;

  if (v_was_owner or v_is_owner)
     and (new.role_id is distinct from old.role_id
          or new.active is distinct from old.active
          or new.full_name is distinct from old.full_name
          or new.title is distinct from old.title)
     and not public.is_owner()
  then
    raise exception 'Only an owner can give the owner role or change an owner''s account'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile();

-- --- profiles (DELETE) -------------------------------------------------------
create or replace function public.protect_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid      uuid := public.current_uid();
  v_owner_id uuid;
begin
  select r.id into v_owner_id from public.roles r where r.key = 'owner';

  if old.role_id = v_owner_id and old.active and not exists (
    select 1 from public.profiles p
     where p.role_id = v_owner_id and p.active and p.id <> old.id)
  then
    raise exception 'There must always be at least one active owner' using errcode = '42501';
  end if;

  if v_uid is not null and pg_trigger_depth() <= 1 then
    if old.id = v_uid then
      raise exception 'You cannot delete your own account' using errcode = '42501';
    end if;
    if old.role_id = v_owner_id and not public.is_owner() then
      raise exception 'Only an owner can remove an owner' using errcode = '42501';
    end if;
  end if;

  return old;
end;
$fn$;

drop trigger if exists trg_protect_profile_delete on public.profiles;
create trigger trg_protect_profile_delete
  before delete on public.profiles
  for each row execute function public.protect_profile_delete();

-- --- invitations -------------------------------------------------------------
-- Nobody invites an owner from the portal. Token, inviter and acceptance are
-- not client-editable.
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

  if coalesce(current_setting('mmt.signup', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.expires_at := coalesce(new.expires_at, now() + interval '14 days');
    if v_uid is null then
      return new;
    end if;
    new.invited_by  := v_uid;
    new.created_at  := now();
    new.accepted_at := null;
    new.accepted_by := null;
  else
    if v_uid is null then
      return new;
    end if;
    if new.token          is distinct from old.token
       or new.invited_by  is distinct from old.invited_by
       or new.created_at  is distinct from old.created_at
       or new.accepted_at is distinct from old.accepted_at
       or new.accepted_by is distinct from old.accepted_by
    then
      raise exception 'An invitation''s link, sender and acceptance cannot be edited'
        using errcode = '42501';
    end if;
    -- Leaving the role alone is always fine (revoking an old owner invitation).
    if new.role_id is not distinct from old.role_id then
      return new;
    end if;
  end if;

  if exists (select 1 from public.roles r where r.id = new.role_id and r.key = 'owner') then
    raise exception 'Nobody can be invited as an owner' using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_guard_invitation on public.invitations;
create trigger trg_guard_invitation
  before insert or update on public.invitations
  for each row execute function public.guard_invitation();

-- --- tasks -------------------------------------------------------------------
-- done_at follows status. progress follows the checklist when one exists.
-- Assigning: you may take an unassigned task or drop your own; anything else
-- (giving a task to someone else, or taking it from someone) needs
-- tasks.assign. Someone who neither made nor holds a task may only take it.
create or replace function public.guard_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid      uuid := public.current_uid();
  v_internal boolean := public.current_uid() is null or pg_trigger_depth() > 1;
  v_total    integer;
  v_done     integer;
  v_ignore   constant text[] := array['assignee_id', 'updated_at', 'updated_by',
                                      'progress', 'done_at'];
begin
  if tg_op = 'INSERT' then
    if new.status = 'done' then
      new.done_at := case when v_internal then coalesce(new.done_at, now()) else now() end;
    else
      new.done_at := null;
    end if;
  else
    if new.id is distinct from old.id then
      raise exception 'A task id cannot be changed' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      new.done_at := case when new.status = 'done' then now() end;
    elsif not v_internal then
      new.done_at := old.done_at;
    end if;

    select count(*), count(*) filter (where i.done)
      into v_total, v_done
      from public.task_items i
     where i.task_id = new.id;
    if v_total > 0 then
      new.progress := round(100.0 * v_done / v_total);
    end if;
  end if;

  if v_internal then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not public.has_perm('tasks.edit_any')
       and old.created_by is distinct from v_uid
       and old.assignee_id is distinct from v_uid
    then
      if old.assignee_id is not null
         or new.assignee_id is distinct from v_uid
         or (to_jsonb(new) - v_ignore) is distinct from (to_jsonb(old) - v_ignore)
      then
        raise exception 'Only the person who made this task or the person doing it can change it. You can take it if nobody has.'
          using errcode = '42501';
      end if;
    end if;

    if new.assignee_id is distinct from old.assignee_id
       and not ((old.assignee_id is null or old.assignee_id = v_uid)
                and (new.assignee_id is null or new.assignee_id = v_uid))
       and not public.has_perm('tasks.assign')
    then
      raise exception 'You do not have permission to assign tasks to other people'
        using errcode = '42501';
    end if;
  else
    if new.assignee_id is not null and new.assignee_id <> v_uid
       and not public.has_perm('tasks.assign')
    then
      raise exception 'You do not have permission to assign tasks to other people'
        using errcode = '42501';
    end if;
  end if;

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (
       select 1 from public.profiles p where p.id = new.assignee_id and p.active)
  then
    raise exception 'That person''s account is not active' using errcode = '23514';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_guard_task on public.tasks;
create trigger trg_guard_task
  before insert or update on public.tasks
  for each row execute function public.guard_task();

-- --- task_items: keep the parent's progress in step --------------------------
create or replace function public.sync_task_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_task  uuid;
  v_total integer;
  v_done  integer;
  v_pct   smallint;
begin
  foreach v_task in array
    case tg_op
      when 'INSERT' then array[new.task_id]
      when 'DELETE' then array[old.task_id]
      else array_remove(array[new.task_id,
                              case when old.task_id is distinct from new.task_id
                                   then old.task_id end], null)
    end
  loop
    select count(*), count(*) filter (where i.done)
      into v_total, v_done
      from public.task_items i
     where i.task_id = v_task;

    if v_total > 0 then
      v_pct := round(100.0 * v_done / v_total);
      update public.tasks t
         set progress = v_pct
       where t.id = v_task
         and t.progress is distinct from v_pct;
    end if;
  end loop;

  return null;
end;
$fn$;

drop trigger if exists trg_sync_task_progress on public.task_items;
create trigger trg_sync_task_progress
  after insert or delete or update of done, task_id on public.task_items
  for each row execute function public.sync_task_progress();

-- --- task_comments: the author is whoever is signed in -----------------------
create or replace function public.set_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := public.current_uid();
begin
  if v_uid is not null then
    new.user_id    := v_uid;
    new.created_at := now();
  else
    new.created_at := coalesce(new.created_at, now());
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_set_comment_author on public.task_comments;
create trigger trg_set_comment_author
  before insert on public.task_comments
  for each row execute function public.set_comment_author();

-- --- time_entries ------------------------------------------------------------
-- A person's day holds at most 24 hours. A closed month refuses every write
-- unless the writer has hours.close. A task's project fills in when the entry
-- names a task but no project.
create or replace function public.guard_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid   uuid := public.current_uid();
  v_total numeric;
begin
  if v_uid is not null and pg_trigger_depth() <= 1
     and not public.has_perm('hours.close')
     and ((tg_op <> 'INSERT' and public.month_is_closed(old.work_date))
          or (tg_op <> 'DELETE' and public.month_is_closed(new.work_date)))
  then
    raise exception 'That month is closed, so its hours cannot change' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.task_id is not null and new.project_id is null then
    new.project_id := (select t.project_id from public.tasks t where t.id = new.task_id);
  end if;

  if tg_op = 'INSERT'
     or new.hours     is distinct from old.hours
     or new.work_date is distinct from old.work_date
     or new.user_id   is distinct from old.user_id
  then
    -- Serialise writes to one person's day so two tabs cannot both squeeze in.
    perform pg_advisory_xact_lock(
      hashtextextended('mmt.time_entries:' || new.user_id::text || ':' || new.work_date::text, 0));

    select coalesce(sum(e.hours), 0) into v_total
      from public.time_entries e
     where e.user_id = new.user_id
       and e.work_date = new.work_date
       and e.id <> new.id;

    if v_total + new.hours > 24 then
      raise exception 'That would put more than 24 hours on one day' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_guard_time_entry on public.time_entries;
create trigger trg_guard_time_entry
  before insert or update or delete on public.time_entries
  for each row execute function public.guard_time_entry();

-- --- hours_months ------------------------------------------------------------
create or replace function public.guard_hours_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := public.current_uid();
begin
  new.month := date_trunc('month', new.month::timestamp)::date;
  if v_uid is not null then
    new.closed_by := v_uid;
    new.closed_at := now();
  else
    new.closed_at := coalesce(new.closed_at, now());
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_guard_hours_month on public.hours_months;
create trigger trg_guard_hours_month
  before insert on public.hours_months
  for each row execute function public.guard_hours_month();


-- =============================================================================
-- 15. Carry the v1 work over
-- =============================================================================
-- Runs once: each legacy table is marked in its comment when its rows have
-- been carried, so a re-run never brings back a task someone deleted since.
-- Rows keep their v1 ids and audit columns. The activity trigger does not
-- exist yet on the first run, so the carry-over writes no feed lines.

do $do$
declare
  v_row   record;
  v_parts text[];
  v_base  text;
  v_code  text;
  v_n     integer;
  v_sort  integer := 0;
  v_done  constant text := 'Workbench v1 data, kept read-only by 0002_workspace.sql. Carried over.';
begin
  -- --- projects --------------------------------------------------------------
  if to_regclass('public.legacy_projects') is not null
     and coalesce(obj_description(to_regclass('public.legacy_projects'), 'pg_class'), '')
         not like '%Carried over.'
  then
    for v_row in
      select lp.* from public.legacy_projects lp order by lp.created_at, lp.slug
    loop
      v_sort := v_sort + 10;

      -- Code from the slug: the first letter of each part ('a-b-c' -> 'ABC'),
      -- or the first three letters of a one-part slug. Made unique with a digit.
      v_parts := array_remove(
        string_to_array(regexp_replace(lower(v_row.slug), '[^a-z0-9-]', '', 'g'), '-'), '');
      if coalesce(array_length(v_parts, 1), 0) >= 2 then
        select string_agg(left(x.part, 1), '' order by x.ord)
          into v_base
          from unnest(v_parts) with ordinality as x(part, ord);
      else
        v_base := left(coalesce(v_parts[1], 'pr'), 3);
      end if;
      v_base := upper(left(v_base, 6));
      if char_length(v_base) < 2 then
        v_base := rpad(v_base, 2, 'X');
      end if;

      v_code := v_base;
      v_n := 2;
      while exists (
        select 1 from public.projects p where p.code = v_code and p.id <> v_row.id
      ) loop
        v_code := left(v_base, 6 - char_length(v_n::text)) || v_n::text;
        v_n := v_n + 1;
      end loop;

      insert into public.projects (id, name, code, track, summary, status, sort,
                                   created_by, updated_by, created_at, updated_at)
      values (v_row.id, left(v_row.name, 200), v_code, v_row.track,
              left(coalesce(v_row.summary, ''), 2000), v_row.status, v_sort,
              v_row.created_by, v_row.updated_by, v_row.created_at, v_row.updated_at)
      on conflict (id) do nothing;
    end loop;

    execute format('comment on table public.legacy_projects is %L', v_done);
  end if;

  -- --- tasks -----------------------------------------------------------------
  if to_regclass('public.legacy_tasks') is not null
     and coalesce(obj_description(to_regclass('public.legacy_tasks'), 'pg_class'), '')
         not like '%Carried over.'
  then
    execute $q$
      insert into public.tasks (id, project_id, title, description, status, priority,
                                assignee_id, due, progress, done_at, sort,
                                created_by, updated_by, created_at, updated_at)
      select t.id,
             (select p.id from public.projects p where p.id = t.project_id),
             left(t.title, 200),
             left(coalesce(concat_ws(E'\n\n',
               nullif(btrim(t.notes), ''),
               case when btrim(t.why) <> ''
                    then E'**Why**\n' || btrim(t.why) end,
               case when btrim(t.done_when) <> ''
                    then E'**Done when**\n' || btrim(t.done_when) end), ''), 10000),
             t.status,
             case t.pri when 'critical' then 'urgent' when 'high' then 'high' else 'normal' end,
             (select pr.id from public.profiles pr where pr.id = t.assignee),
             t.due,
             case when t.status = 'done' then 100 else 0 end,
             case when t.status = 'done' then t.updated_at end,
             (row_number() over (order by t.sort, t.created_at, t.id) * 10)::integer,
             t.created_by, t.updated_by, t.created_at, t.updated_at
        from public.legacy_tasks t
      on conflict (id) do nothing
    $q$;

    execute format('comment on table public.legacy_tasks is %L', v_done);
  end if;

  -- --- comments on tasks -----------------------------------------------------
  if to_regclass('public.legacy_comments') is not null
     and coalesce(obj_description(to_regclass('public.legacy_comments'), 'pg_class'), '')
         not like '%Carried over.'
  then
    execute $q$
      insert into public.task_comments (id, task_id, user_id, body, created_at)
      select c.id, c.entity_id, c.user_id, c.body, c.created_at
        from public.legacy_comments c
       where c.entity = 'task'
         and exists (select 1 from public.tasks t where t.id = c.entity_id)
         and exists (select 1 from public.profiles p where p.id = c.user_id)
      on conflict (id) do nothing
    $q$;

    execute format('comment on table public.legacy_comments is %L', v_done);
  end if;
end;
$do$;


-- =============================================================================
-- 16. Activity feed
-- =============================================================================
-- One plain line per meaningful change. Skipped: updates where only audit
-- columns, sort, done_at or last_seen_at moved (re-orders, no-op saves,
-- presence), and updates or deletes caused by another trigger or a foreign
-- key action (cascades, a checklist recomputing progress). The feed prunes
-- itself to the newest 3000 rows, about one write in fifty.

create or replace function public.record_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_row     jsonb;
  v_uid     uuid := public.current_uid();
  v_action  text;
  v_entity  text;
  v_eid     uuid;
  v_task    uuid;
  v_changed text[];
  v_parts   text[] := array[]::text[];
  v_summary text;
  v_title   text;
  v_name    text;
  v_code    text;
  v_hours   text;
  v_for     text := '';
begin
  if tg_op <> 'INSERT' and pg_trigger_depth() > 1 then
    return null;
  end if;

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

    select array_agg(k.key)
      into v_changed
      from jsonb_object_keys(v_new) as k(key)
     where (v_old -> k.key) is distinct from (v_new -> k.key)
       and k.key <> all (array['updated_at', 'updated_by', 'created_at', 'created_by',
                               'sort', 'done_at', 'last_seen_at']);

    if v_changed is null then
      return null;
    end if;
  end if;

  -- jsonb_exists() rather than `?`, which some SQL clients treat as a placeholder.
  v_eid := case when jsonb_exists(v_row, 'id') then nullif(v_row ->> 'id', '')::uuid end;

  -- ------------------------------------------------------------------ tasks --
  if tg_table_name = 'tasks' then
    v_entity := 'task';
    v_task   := v_eid;
    v_title  := coalesce(v_row ->> 'title', 'untitled');

    if tg_op = 'INSERT' then
      v_summary := 'Created "' || v_title || '"';
      if v_new ->> 'assignee_id' is not null
         and (v_new ->> 'assignee_id')::uuid is distinct from v_uid then
        v_summary := v_summary || ' for '
          || coalesce(public.display_name((v_new ->> 'assignee_id')::uuid), 'someone');
      end if;
    elsif tg_op = 'DELETE' then
      v_summary := 'Deleted "' || v_title || '"';
    else
      if 'title' = any (v_changed) then
        v_parts := v_parts || ('Renamed to "' || v_title || '"');
      end if;
      if 'status' = any (v_changed) then
        v_parts := v_parts || ('Status: ' || public.activity_label(v_old ->> 'status')
                               || ' → ' || public.activity_label(v_new ->> 'status'));
      end if;
      if 'priority' = any (v_changed) then
        v_parts := v_parts || ('Priority: ' || public.activity_label(v_old ->> 'priority')
                               || ' → ' || public.activity_label(v_new ->> 'priority'));
      end if;
      if 'due' = any (v_changed) then
        v_parts := v_parts || ('Due: ' || public.fmt_day(v_old ->> 'due')
                               || ' → ' || public.fmt_day(v_new ->> 'due'));
      end if;
      if 'assignee_id' = any (v_changed) then
        if v_new ->> 'assignee_id' is null then
          v_parts := v_parts || 'Unassigned'::text;
        elsif (v_new ->> 'assignee_id')::uuid = v_uid then
          v_parts := v_parts || 'Took the task'::text;
        else
          v_parts := v_parts || ('Assigned to '
            || coalesce(public.display_name((v_new ->> 'assignee_id')::uuid), 'someone'));
        end if;
      end if;
      if 'project_id' = any (v_changed) then
        if v_new ->> 'project_id' is null then
          v_parts := v_parts || 'Removed from its project'::text;
        else
          select p.code into v_code from public.projects p
           where p.id = (v_new ->> 'project_id')::uuid;
          v_parts := v_parts || ('Moved to ' || coalesce(v_code, 'another project'));
        end if;
      end if;
      if 'description' = any (v_changed) then
        v_parts := v_parts || 'Edited the description'::text;
      end if;
      if 'progress' = any (v_changed) then
        v_parts := v_parts || ('Progress: ' || coalesce(v_old ->> 'progress', '0')
                               || '% → ' || coalesce(v_new ->> 'progress', '0') || '%');
      end if;
      v_summary := nullif(array_to_string(v_parts, ' · '), '');
    end if;

  -- ------------------------------------------------------------- task_items --
  elsif tg_table_name = 'task_items' then
    v_entity := 'task_item';
    v_task   := nullif(v_row ->> 'task_id', '')::uuid;
    if not exists (select 1 from public.tasks t where t.id = v_task) then
      return null;
    end if;
    v_title := coalesce(v_row ->> 'text', '');

    if tg_op = 'INSERT' then
      v_summary := 'Added "' || v_title || '" to the checklist';
    elsif tg_op = 'DELETE' then
      v_summary := 'Removed "' || v_title || '" from the checklist';
    else
      if 'text' = any (v_changed) then
        v_parts := v_parts || ('Reworded a checklist item to "' || v_title || '"');
      end if;
      if 'done' = any (v_changed) then
        if (v_new ->> 'done')::boolean then
          v_parts := v_parts || ('Checked off "' || v_title || '"');
        else
          v_parts := v_parts || ('Unchecked "' || v_title || '"');
        end if;
      end if;
      v_summary := nullif(array_to_string(v_parts, ' · '), '');
    end if;

  -- ---------------------------------------------------------- task_comments --
  elsif tg_table_name = 'task_comments' then
    v_entity := 'comment';
    v_task   := nullif(v_row ->> 'task_id', '')::uuid;
    select t.title into v_title from public.tasks t where t.id = v_task;
    if not found then
      return null;
    end if;

    if tg_op = 'INSERT' then
      v_action  := 'commented';
      v_summary := 'Commented on "' || v_title || '"';
    elsif tg_op = 'DELETE' then
      v_summary := 'Deleted a comment on "' || v_title || '"';
    end if;

  -- ----------------------------------------------------------- time_entries --
  elsif tg_table_name = 'time_entries' then
    v_entity := 'time_entry';
    v_hours  := trim_scale((v_row ->> 'hours')::numeric)::text || ' h';

    if (v_row ->> 'user_id')::uuid is distinct from v_uid then
      v_for := ' for ' || coalesce(public.display_name((v_row ->> 'user_id')::uuid), 'someone');
    end if;

    if tg_op = 'INSERT' then
      select p.code into v_code from public.projects p
       where p.id = nullif(v_new ->> 'project_id', '')::uuid;
      if v_code is not null then
        v_summary := 'Logged ' || v_hours || ' on ' || v_code || v_for;
      else
        v_summary := 'Logged ' || v_hours || ' on ' || public.fmt_day(v_new ->> 'work_date') || v_for;
      end if;
    elsif tg_op = 'DELETE' then
      v_summary := 'Removed ' || v_hours || ' from ' || public.fmt_day(v_old ->> 'work_date') || v_for;
    else
      if 'hours' = any (v_changed) then
        v_summary := 'Changed ' || trim_scale((v_old ->> 'hours')::numeric)::text || ' h to '
                     || v_hours || ' on ' || public.fmt_day(v_new ->> 'work_date') || v_for;
      else
        v_summary := 'Edited an entry for ' || public.fmt_day(v_new ->> 'work_date') || v_for;
      end if;
    end if;

  -- --------------------------------------------------------------- projects --
  elsif tg_table_name = 'projects' then
    v_entity := 'project';
    v_code   := coalesce(v_row ->> 'code', '');

    if tg_op = 'INSERT' then
      v_summary := 'Created project ' || v_code;
    elsif tg_op = 'DELETE' then
      v_summary := 'Deleted project ' || v_code;
    else
      if 'status' = any (v_changed) then
        v_parts := v_parts || (case when v_new ->> 'status' = 'archived'
                                    then 'Archived project ' else 'Restored project ' end
                               || v_code);
      end if;
      if 'code' = any (v_changed) then
        v_parts := v_parts || ('Changed project code ' || coalesce(v_old ->> 'code', '')
                               || ' to ' || v_code);
      end if;
      if 'name' = any (v_changed) then
        v_parts := v_parts || ('Renamed project ' || v_code || ' to "'
                               || coalesce(v_new ->> 'name', '') || '"');
      end if;
      if array_length(v_parts, 1) is null then
        v_parts := v_parts || ('Edited project ' || v_code);
      end if;
      v_summary := array_to_string(v_parts, ' · ');
    end if;

  -- --------------------------------------------------------------- profiles --
  elsif tg_table_name = 'profiles' then
    v_entity := 'profile';
    v_name := coalesce(nullif(btrim(v_row ->> 'full_name'), ''),
                       nullif(split_part(coalesce(v_row ->> 'email', ''), '@', 1), ''),
                       'someone');

    if tg_op = 'INSERT' then
      v_uid := coalesce(v_uid, v_eid);
      select r.name into v_title from public.roles r
       where r.id = (v_new ->> 'role_id')::uuid;
      v_summary := 'Joined as ' || coalesce(v_title, 'a team member');
    elsif tg_op = 'DELETE' then
      v_summary := 'Removed ' || v_name;
    else
      if 'role_id' = any (v_changed) then
        select r.name into v_title from public.roles r
         where r.id = (v_new ->> 'role_id')::uuid;
        v_parts := v_parts || ('Changed ' || v_name || '''s role to '
                               || coalesce(v_title, 'another role'));
      end if;
      if 'active' = any (v_changed) then
        v_parts := v_parts || (case when (v_new ->> 'active')::boolean
                                    then 'Reactivated ' else 'Deactivated ' end || v_name);
      end if;
      if v_changed && array['full_name', 'title'] then
        if v_eid = v_uid then
          v_parts := v_parts || 'Updated their profile'::text;
        else
          v_parts := v_parts || ('Updated ' || v_name || '''s profile');
        end if;
      end if;
      v_summary := nullif(array_to_string(v_parts, ' · '), '');
    end if;

  -- ------------------------------------------------------------------ roles --
  elsif tg_table_name = 'roles' then
    v_entity := 'role';
    v_name   := coalesce(v_row ->> 'name', '');

    if tg_op = 'INSERT' then
      v_summary := 'Created the role "' || v_name || '"';
    elsif tg_op = 'DELETE' then
      v_summary := 'Deleted the role "' || v_name || '"';
    else
      if 'name' = any (v_changed) then
        v_parts := v_parts || ('Renamed the role "' || coalesce(v_old ->> 'name', '')
                               || '" to "' || v_name || '"');
      end if;
      if 'permissions' = any (v_changed) then
        v_parts := v_parts || ('Changed what "' || v_name || '" can do');
      end if;
      if array_length(v_parts, 1) is null then
        v_parts := v_parts || ('Edited the role "' || v_name || '"');
      end if;
      v_summary := array_to_string(v_parts, ' · ');
    end if;

  -- ------------------------------------------------------------ invitations --
  -- No e-mail address in the feed: everyone can read it.
  elsif tg_table_name = 'invitations' then
    v_entity := 'invitation';
    select r.name into v_name from public.roles r
     where r.id = (v_row ->> 'role_id')::uuid;
    v_name := coalesce(v_name, 'a role');

    if tg_op = 'INSERT' then
      v_summary := 'Invited someone as ' || v_name;
    elsif tg_op = 'DELETE' then
      v_summary := 'Deleted an invitation for ' || v_name;
    elsif 'revoked_at' = any (v_changed) and v_new ->> 'revoked_at' is not null then
      v_summary := 'Revoked an invitation for ' || v_name;
    elsif v_changed && array['role_id', 'email', 'note', 'expires_at'] then
      v_summary := 'Edited an invitation for ' || v_name;
    end if;

  -- -------------------------------------------------------------- inquiries --
  -- No name or contact details in the feed: everyone can read it, and only
  -- inquiries.view may see who wrote in. New inquiries are logged by
  -- ingest_form_response() itself.
  elsif tg_table_name = 'inquiries' then
    v_entity := 'inquiry';
    if tg_op = 'DELETE' then
      v_summary := 'Deleted an inquiry';
    elsif tg_op = 'UPDATE' then
      if 'status' = any (v_changed) then
        v_parts := v_parts || ('Status: ' || public.activity_label(v_old ->> 'status')
                               || ' → ' || public.activity_label(v_new ->> 'status'));
      end if;
      if 'assignee_id' = any (v_changed) then
        if v_new ->> 'assignee_id' is null then
          v_parts := v_parts || 'Unassigned'::text;
        else
          v_parts := v_parts || ('Assigned to '
            || coalesce(public.display_name((v_new ->> 'assignee_id')::uuid), 'someone'));
        end if;
      end if;
      if 'task_id' = any (v_changed) then
        if v_new ->> 'task_id' is null then
          v_parts := v_parts || 'Unlinked its task'::text;
        else
          select t.title into v_title from public.tasks t
           where t.id = (v_new ->> 'task_id')::uuid;
          v_parts := v_parts || ('Linked the task "' || coalesce(v_title, 'untitled') || '"');
        end if;
      end if;
      v_summary := nullif(array_to_string(v_parts, ' · '), '');
    end if;

  -- ----------------------------------------------------------- hours_months --
  elsif tg_table_name = 'hours_months' then
    v_entity := 'month';
    v_eid    := null;
    if tg_op = 'INSERT' then
      v_action  := 'closed';
      v_summary := 'Closed ' || to_char((v_new ->> 'month')::date, 'FMMonth YYYY');
    elsif tg_op = 'DELETE' then
      v_action  := 'reopened';
      v_summary := 'Reopened ' || to_char((v_old ->> 'month')::date, 'FMMonth YYYY');
    end if;
  end if;

  if v_entity is null or v_summary is null or btrim(v_summary) = '' then
    return null;
  end if;

  -- An actor whose profile is gone (or never existed) is recorded as nobody.
  if v_uid is not null
     and not exists (select 1 from public.profiles p where p.id = v_uid) then
    v_uid := null;
  end if;

  insert into public.activity (actor_id, entity, entity_id, task_id, action, summary)
  values (v_uid, v_entity, v_eid, v_task, v_action, left(v_summary, 300));

  if random() < 0.02 then
    delete from public.activity a
     where a.id < (select a2.id from public.activity a2
                    order by a2.id desc offset 2999 limit 1);
  end if;

  return null;
end;
$fn$;

do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    'roles', 'profiles', 'invitations', 'projects', 'tasks', 'task_items',
    'task_comments', 'time_entries', 'hours_months'
  ] loop
    execute format('drop trigger if exists trg_record_activity on public.%I', v_table);
    execute format(
      'create trigger trg_record_activity after insert or update or delete on public.%I
         for each row execute function public.record_activity()', v_table);
  end loop;
end;
$do$;


-- =============================================================================
-- 17. Function privileges
-- =============================================================================
-- Supabase's default privileges grant EXECUTE on every new function in public
-- to anon and authenticated, so revoking from PUBLIC is not enough: each role
-- is revoked by name. Then:
--   * authenticated gets the helpers that policies call (policies run as the
--     caller), plus permission_catalogue(), which the roles check constraint
--     evaluates as the caller;
--   * anon gets invite_preview() and ping() here, and ingest_form_response()
--     in section 20, and nothing else.
-- Trigger functions need no grant: EXECUTE is checked when a trigger is
-- created, not when it fires.

do $do$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    -- policy helpers and the catalogue
    'public.permission_catalogue()',
    'public.has_profile()',
    'public.my_role_key()',
    'public.has_perm(text)',
    'public.is_owner()',
    'public.task_is_mine(uuid)',
    'public.month_is_closed(date)',
    'public.topic_is_workspace()',
    -- internal helpers
    'public.current_uid()',
    'public.activity_label(text)',
    'public.fmt_day(text)',
    'public.display_name(uuid)',
    -- trigger functions
    'public.handle_new_user()',
    'public.set_audit()',
    'public.guard_role()',
    'public.protect_profile()',
    'public.protect_profile_delete()',
    'public.guard_invitation()',
    'public.guard_task()',
    'public.sync_task_progress()',
    'public.set_comment_author()',
    'public.guard_time_entry()',
    'public.guard_hours_month()',
    'public.record_activity()',
    -- the two public entry points
    'public.invite_preview(text)',
    'public.ping()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_fn);
  end loop;
end;
$do$;

grant execute on function public.permission_catalogue()  to authenticated, service_role;
grant execute on function public.has_profile()           to authenticated, service_role;
grant execute on function public.my_role_key()           to authenticated, service_role;
grant execute on function public.has_perm(text)          to authenticated, service_role;
grant execute on function public.is_owner()              to authenticated, service_role;
grant execute on function public.task_is_mine(uuid)      to authenticated, service_role;
grant execute on function public.month_is_closed(date)   to authenticated, service_role;
grant execute on function public.topic_is_workspace()    to authenticated, service_role;

grant execute on function public.invite_preview(text)    to anon, authenticated, service_role;
grant execute on function public.ping()                  to anon, authenticated, service_role;


-- =============================================================================
-- 18. Realtime: publication membership and replica identity
-- =============================================================================
-- Postgres changes are filtered by RLS per subscriber, so a person without
-- hours.view_all never receives someone else's time entry.

do $do$
declare
  v_table text;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;

  foreach v_table in array array[
    'profiles', 'roles', 'projects', 'tasks', 'task_items', 'task_comments',
    'time_entries', 'hours_months', 'activity'
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

alter table public.tasks         replica identity full;
alter table public.task_items    replica identity full;
alter table public.task_comments replica identity full;
alter table public.time_entries  replica identity full;


-- =============================================================================
-- 19. Realtime: the private `workspace` channel
-- =============================================================================
-- One channel for presence and broadcast. Read and write need an active
-- account; any other topic is denied.

do $do$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages not found, skipping the workspace channel policies';
    return;
  end if;

  execute 'grant select, insert on realtime.messages to authenticated';

  execute 'drop policy if exists mmt_workspace_read on realtime.messages';
  execute $p$
    create policy mmt_workspace_read on realtime.messages
      for select to authenticated
      using ((select public.topic_is_workspace()) and (select public.has_profile()))
  $p$;

  execute 'drop policy if exists mmt_workspace_write on realtime.messages';
  execute $p$
    create policy mmt_workspace_write on realtime.messages
      for insert to authenticated
      with check ((select public.topic_is_workspace()) and (select public.has_profile()))
  $p$;
end;
$do$;


-- =============================================================================
-- 20. Inquiries
-- =============================================================================
-- The three public forms post to Google (the system of record) through a
-- Cloudflare Worker, which then copies each response here by calling
-- ingest_form_response() with a shared secret. The secret lives in
-- ingest_secrets, which only postgres and the definer function can read. It
-- is set with set_ingest_secret() and never enters this repository.

create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  source      text not null check (source in ('inquiry', 'dlt_signup', 'dlt_interest')),
  received_at timestamptz not null default now(),
  lang        text not null default 'en' check (lang in ('en', 'es')),
  page        text not null default '' check (char_length(page) <= 200),
  name        text not null default '' check (char_length(name) <= 200),
  contact     text not null default '' check (char_length(contact) <= 300),
  fields      jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  status      text not null default 'new'
              check (status in ('new', 'contacted', 'enrolled', 'closed')),
  assignee_id uuid references public.profiles (id) on delete set null,
  notes       text not null default '' check (char_length(notes) <= 10000),
  task_id     uuid references public.tasks (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create index if not exists inquiries_received_idx
  on public.inquiries (received_at desc);
create index if not exists inquiries_new_idx
  on public.inquiries (received_at desc) where status = 'new';

create table if not exists public.ingest_secrets (
  name       text primary key check (char_length(name) between 1 and 40),
  secret     text not null check (char_length(secret) between 16 and 500),
  created_at timestamptz not null default now()
);

alter table public.inquiries      enable row level security;
alter table public.inquiries      force row level security;
alter table public.ingest_secrets enable row level security;
alter table public.ingest_secrets force row level security;

-- ingest_secrets: no policies, and no grants for anyone but its owner.
revoke all on public.ingest_secrets from public, anon, authenticated, service_role;

-- inquiries: no insert grant or policy; the definer function inserts.
revoke all on public.inquiries from public, anon, authenticated;
grant select, update, delete on public.inquiries to authenticated;
grant all on public.inquiries to service_role;

drop policy if exists inquiries_select on public.inquiries;
create policy inquiries_select on public.inquiries
  for select to authenticated
  using ((select public.has_perm('inquiries.view')));

drop policy if exists inquiries_update on public.inquiries;
create policy inquiries_update on public.inquiries
  for update to authenticated
  using ((select public.has_perm('inquiries.manage')))
  with check ((select public.has_perm('inquiries.manage')));

drop policy if exists inquiries_delete on public.inquiries;
create policy inquiries_delete on public.inquiries
  for delete to authenticated
  using ((select public.has_perm('inquiries.manage')));

-- What the person sent is a record: only status, assignee, notes and the
-- linked task change after it arrives.
create or replace function public.guard_inquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := public.current_uid();
begin
  if v_uid is not null and pg_trigger_depth() <= 1 and (
       new.id          is distinct from old.id
    or new.source      is distinct from old.source
    or new.received_at is distinct from old.received_at
    or new.lang        is distinct from old.lang
    or new.page        is distinct from old.page
    or new.name        is distinct from old.name
    or new.contact     is distinct from old.contact
    or new.fields      is distinct from old.fields)
  then
    raise exception 'What the person sent cannot be changed' using errcode = '42501';
  end if;

  new.updated_at := now();
  new.updated_by := v_uid;
  return new;
end;
$fn$;

drop trigger if exists trg_guard_inquiry on public.inquiries;
create trigger trg_guard_inquiry
  before update on public.inquiries
  for each row execute function public.guard_inquiry();

-- Inserts are logged by ingest_form_response(), so this trigger skips them.
drop trigger if exists trg_record_activity on public.inquiries;
create trigger trg_record_activity
  after update or delete on public.inquiries
  for each row execute function public.record_activity();

-- Called by the Worker as anon. One generic refusal for every bad call, so a
-- caller learns nothing about why. Over-long values are cut, not refused.
create or replace function public.ingest_form_response(
  p_secret  text,
  p_source  text,
  p_lang    text,
  p_page    text,
  p_name    text,
  p_contact text,
  p_fields  jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_secret text;
  v_lang   text := lower(btrim(coalesce(p_lang, 'en')));
  v_fields jsonb;
  v_id     uuid;
begin
  select s.secret into v_secret from public.ingest_secrets s where s.name = 'worker';

  if v_secret is null
     or p_secret is null
     or p_secret is distinct from v_secret
     or p_source is null
     or p_source not in ('inquiry', 'dlt_signup', 'dlt_interest')
     or v_lang not in ('en', 'es')
  then
    raise exception 'not accepted' using errcode = '42501';
  end if;

  select coalesce(
           jsonb_agg(jsonb_build_object(
                       'k', left(coalesce(e.item ->> 'k', ''), 100),
                       'v', left(coalesce(e.item ->> 'v', ''), 2000))
                     order by e.ord),
           '[]'::jsonb)
    into v_fields
    from jsonb_array_elements(
           case when jsonb_typeof(p_fields) = 'array' then p_fields else '[]'::jsonb end
         ) with ordinality as e(item, ord)
   where e.ord <= 60
     and jsonb_typeof(e.item) = 'object';

  insert into public.inquiries (source, lang, page, name, contact, fields)
  values (p_source,
          v_lang,
          left(btrim(coalesce(p_page, '')), 200),
          left(btrim(coalesce(p_name, '')), 200),
          left(btrim(coalesce(p_contact, '')), 300),
          v_fields)
  returning id into v_id;

  insert into public.activity (actor_id, entity, entity_id, task_id, action, summary)
  values (null, 'inquiry', v_id, null, 'created',
          'New inquiry from ' || case p_source
                                   when 'inquiry'    then 'the contact form'
                                   when 'dlt_signup' then 'the DLT sign-up form'
                                   else 'the DLT interest form'
                                 end);

  return v_id;
end;
$fn$;

-- postgres only. Run once with the CLI; the same value goes into the Worker
-- as the secret INGEST_SECRET.
create or replace function public.set_ingest_secret(p_secret text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  if char_length(coalesce(p_secret, '')) < 16 then
    raise exception 'The secret must be at least 16 characters' using errcode = '22023';
  end if;

  insert into public.ingest_secrets (name, secret)
  values ('worker', p_secret)
  on conflict (name) do update
    set secret = excluded.secret, created_at = now();
end;
$fn$;

revoke all on function public.guard_inquiry()
  from public, anon, authenticated;
revoke all on function public.set_ingest_secret(text)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_form_response(text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_form_response(text, text, text, text, text, text, jsonb)
  to anon, authenticated, service_role;

do $do$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables pt
     where pt.pubname = 'supabase_realtime'
       and pt.schemaname = 'public' and pt.tablename = 'inquiries'
  ) then
    execute 'alter publication supabase_realtime add table public.inquiries';
  end if;
end;
$do$;

alter table public.inquiries replica identity full;


-- =============================================================================
-- 21. Bootstrap: an owner invitation, only when there is no owner
-- =============================================================================
-- Existing accounts keep working (their profiles were mapped in section 4).
-- A new token appears only on a database with no active owner and no open
-- owner invitation. Hand it over as /admin/#/join/<token>.

do $do$
declare
  v_owner_id uuid;
begin
  select r.id into v_owner_id from public.roles r where r.key = 'owner';

  if not exists (
       select 1 from public.profiles p where p.role_id = v_owner_id and p.active)
     and not exists (
       select 1 from public.invitations i
        where i.role_id = v_owner_id
          and i.accepted_at is null and i.revoked_at is null
          and i.expires_at > now())
  then
    insert into public.invitations (role_id, email, expires_at, note)
    values (v_owner_id, null, now() + interval '30 days', 'Bootstrap owner invite');
  end if;
end;
$do$;

-- The SQL Editor shows the last result: any open owner invitation token.
-- Empty once an owner exists.
select i.token
  from public.invitations i
  join public.roles r on r.id = i.role_id
 where r.key = 'owner'
   and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
