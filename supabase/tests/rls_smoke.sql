-- =============================================================================
-- MMT Admin Portal — RLS smoke tests
-- =============================================================================
-- Paste into the Supabase SQL Editor AFTER running
-- supabase/migrations/0001_admin_portal.sql. Everything happens inside one
-- transaction that ends in ROLLBACK, so nothing survives: no projects, no
-- tasks, no auth users, no invitations.
--
-- How it fakes users without a real signup flow: it inserts minimal rows into
-- auth.users whose raw_user_meta_data carries an invitation token created a few
-- statements earlier. The signup trigger then does the rest — it creates the
-- profiles and the project memberships, exactly as a real signup would — which
-- also means profiles.id keeps its foreign key to auth.users. Policies are then
-- exercised by switching role and setting request.jwt.claims by hand, which is
-- precisely what PostgREST does per request.
--
-- Every failure raises. If the script runs to the end and prints
-- "RLS smoke tests passed", every assertion held.
--
-- Requires the editor's `postgres` role to be able to INSERT into auth.users
-- (it can, on Supabase).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Fixtures, created as postgres
-- -----------------------------------------------------------------------------

insert into public.projects (id, slug, name, kind, track, summary) values
  ('0a000000-0000-4000-8000-000000000001', 'rls-test-alpha', 'RLS Test Alpha', 'general', 'org', ''),
  ('0a000000-0000-4000-8000-000000000002', 'rls-test-beta',  'RLS Test Beta',  'general', 'org', '');

insert into public.tasks (id, project_id, title, status) values
  ('0c000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'Alpha task', 'todo'),
  ('0c000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000002', 'Beta task',  'todo');

-- Three invitations, each granting membership of one project, plus one that is
-- never redeemed (used to check the happy path of invite_preview).
insert into public.invitations (id, token, role, project_grants, note, expires_at) values
  ('0d000000-0000-4000-8000-000000000001',
   'rlstest-viewer-0000000000000000000001', 'member',
   '[{"project_id":"0a000000-0000-4000-8000-000000000001","role":"viewer"}]'::jsonb,
   'rls test', now() + interval '1 day'),
  ('0d000000-0000-4000-8000-000000000002',
   'rlstest-editor-0000000000000000000002', 'member',
   '[{"project_id":"0a000000-0000-4000-8000-000000000001","role":"editor"}]'::jsonb,
   'rls test', now() + interval '1 day'),
  ('0d000000-0000-4000-8000-000000000003',
   'rlstest-outsider-000000000000000003', 'member',
   '[{"project_id":"0a000000-0000-4000-8000-000000000002","role":"viewer"}]'::jsonb,
   'rls test', now() + interval '1 day'),
  ('0d000000-0000-4000-8000-000000000004',
   'rlstest-unused-0000000000000000000004', 'member',
   '[]'::jsonb,
   'rls test', now() + interval '1 day');

-- Minimal auth.users rows. The AFTER INSERT trigger validates the token and
-- creates public.profiles + public.project_members.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000',
   '0b000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'rls-viewer@example.test', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   jsonb_build_object('invite_token', 'rlstest-viewer-0000000000000000000001',
                      'full_name', 'Test Viewer')),
  ('00000000-0000-0000-0000-000000000000',
   '0b000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'rls-editor@example.test', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   jsonb_build_object('invite_token', 'rlstest-editor-0000000000000000000002',
                      'full_name', 'Test Editor')),
  ('00000000-0000-0000-0000-000000000000',
   '0b000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'rls-outsider@example.test', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   jsonb_build_object('invite_token', 'rlstest-outsider-000000000000000003',
                      'full_name', 'Test Outsider'));

-- Sanity: the trigger did what it was supposed to.
do $$
declare
  n int;
  r text;
begin
  select count(*) into n from public.profiles
   where id in ('0b000000-0000-4000-8000-000000000001',
                '0b000000-0000-4000-8000-000000000002',
                '0b000000-0000-4000-8000-000000000003');
  if n <> 3 then
    raise exception 'FAIL 0a: signup trigger created % of 3 profiles', n;
  end if;

  select pm.role into r from public.project_members pm
   where pm.user_id = '0b000000-0000-4000-8000-000000000001';
  if r is distinct from 'viewer' then
    raise exception 'FAIL 0b: viewer membership is %, expected viewer', r;
  end if;

  select count(*) into n from public.invitations i
   where i.id in ('0d000000-0000-4000-8000-000000000001',
                  '0d000000-0000-4000-8000-000000000002',
                  '0d000000-0000-4000-8000-000000000003')
     and i.accepted_at is not null;
  if n <> 3 then
    raise exception 'FAIL 0c: % of 3 invitations were marked accepted', n;
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- Test 6 (run first, while we are still postgres):
-- signups without a usable invitation token are refused
-- -----------------------------------------------------------------------------
do $$
begin
  -- no token at all
  begin
    insert into auth.users (instance_id, id, aud, role, email,
                            created_at, updated_at, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000',
            '0b000000-0000-4000-8000-0000000000f1',
            'authenticated', 'authenticated', 'rls-nobody@example.test',
            now(), now(), '{}'::jsonb);
    raise exception 'FAIL 6a: a signup with no invite_token succeeded';
  exception when insufficient_privilege then null;
  end;

  -- a token that does not exist
  begin
    insert into auth.users (instance_id, id, aud, role, email,
                            created_at, updated_at, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000',
            '0b000000-0000-4000-8000-0000000000f2',
            'authenticated', 'authenticated', 'rls-bogus@example.test',
            now(), now(),
            jsonb_build_object('invite_token', 'this-token-does-not-exist'));
    raise exception 'FAIL 6b: a signup with an unknown invite_token succeeded';
  exception when insufficient_privilege then null;
  end;

  -- a token that has already been redeemed above
  begin
    insert into auth.users (instance_id, id, aud, role, email,
                            created_at, updated_at, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000',
            '0b000000-0000-4000-8000-0000000000f3',
            'authenticated', 'authenticated', 'rls-reuse@example.test',
            now(), now(),
            jsonb_build_object('invite_token',
                               'rlstest-viewer-0000000000000000000001'));
    raise exception 'FAIL 6c: an already-accepted invite_token was reusable';
  exception when insufficient_privilege then null;
  end;
end;
$$;


-- -----------------------------------------------------------------------------
-- Tests 1 + 2: a project member sees only their project; a viewer cannot write
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"0b000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

do $$
declare
  n int;
  s text;
begin
  -- 1. scoping
  select count(*) into n from public.projects;
  if n <> 1 then
    raise exception 'FAIL 1a: a member sees % projects, expected exactly 1', n;
  end if;

  select p.slug into s from public.projects p;
  if s <> 'rls-test-alpha' then
    raise exception 'FAIL 1b: a member sees the wrong project (%)', s;
  end if;

  select count(*) into n from public.tasks;
  if n <> 1 then
    raise exception 'FAIL 1c: a member sees % tasks, expected exactly 1', n;
  end if;

  -- the roster of their own project (viewer + editor), never project beta's
  select count(*) into n from public.project_members;
  if n <> 2 then
    raise exception 'FAIL 1d: a member sees % membership rows, expected 2', n;
  end if;

  -- the staff directory is visible to anyone with a profile
  select count(*) into n from public.profiles;
  if n < 3 then
    raise exception 'FAIL 1e: the directory shows only % profiles', n;
  end if;

  -- invitations are admin-only
  select count(*) into n from public.invitations;
  if n <> 0 then
    raise exception 'FAIL 1f: a plain member can read % invitations', n;
  end if;

  -- 2. a viewer cannot change content
  update public.tasks set status = 'done'
   where id = '0c000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL 2a: a viewer updated % task rows', n;
  end if;

  begin
    insert into public.tasks (project_id, title)
    values ('0a000000-0000-4000-8000-000000000001', 'viewer should not manage this');
    raise exception 'FAIL 2b: a viewer inserted a task';
  exception when insufficient_privilege then null;
  end;

  delete from public.tasks where id = '0c000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL 2c: a viewer deleted % task rows', n;
  end if;

  -- ...but a viewer may still comment
  insert into public.comments (project_id, entity, entity_id, body)
  values ('0a000000-0000-4000-8000-000000000001', 'task',
          '0c000000-0000-4000-8000-000000000001', 'A viewer may comment.');

  -- ...and may not promote themselves
  begin
    update public.profiles set role = 'owner'
     where id = '0b000000-0000-4000-8000-000000000001';
    raise exception 'FAIL 2d: a member promoted themselves to owner';
  exception when insufficient_privilege then null;
  end;
end;
$$;


-- -----------------------------------------------------------------------------
-- Test 3: an editor can write — but only inside their own project
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"0b000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;

do $$
declare
  n int;
begin
  update public.tasks set status = 'done'
   where id = '0c000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL 3a: an editor updated % task rows, expected 1', n;
  end if;

  update public.tasks set status = 'done'
   where id = '0c000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL 3b: an editor reached into another project (% rows)', n;
  end if;

  -- an editor is not an admin
  begin
    insert into public.invitations (role, note) values ('member', 'rls test');
    raise exception 'FAIL 3c: a non-admin created an invitation';
  exception when insufficient_privilege then null;
  end;

  -- an editor is not a manager
  begin
    insert into public.project_members (project_id, user_id, role)
    values ('0a000000-0000-4000-8000-000000000001',
            '0b000000-0000-4000-8000-000000000003', 'editor');
    raise exception 'FAIL 3d: an editor added a project member';
  exception when insufficient_privilege then null;
  end;

  -- the status change should have produced a readable activity line
  select count(*) into n from public.activity a
   where a.project_id = '0a000000-0000-4000-8000-000000000001'
     and a.summary = 'Status: To do → Done';
  if n < 1 then
    raise exception 'FAIL 3e: no "Status: To do → Done" activity row was written';
  end if;

  select count(*) into n from public.activity a
   where a.project_id = '0a000000-0000-4000-8000-000000000001'
     and a.action = 'commented';
  if n < 1 then
    raise exception 'FAIL 3f: the viewer comment produced no activity row';
  end if;

  -- activity is read-only for clients
  begin
    insert into public.activity (project_id, entity, action, summary)
    values ('0a000000-0000-4000-8000-000000000001', 'task', 'created', 'forged');
    raise exception 'FAIL 3g: a client wrote directly to the activity feed';
  exception when insufficient_privilege then null;
  end;
end;
$$;


-- -----------------------------------------------------------------------------
-- Tests 4 + 5: anon sees nothing, and invite_preview gives nothing away
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '';
set local role anon;

do $$
declare
  n int;
  r jsonb;
begin
  -- 4. anon has no table privileges at all
  begin
    execute 'select count(*) from public.tasks' into n;
    raise exception 'FAIL 4a: anon read % task rows', n;
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select count(*) from public.projects' into n;
    raise exception 'FAIL 4b: anon read the project list';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select count(*) from public.profiles' into n;
    raise exception 'FAIL 4c: anon read the staff directory';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select count(*) from public.invitations' into n;
    raise exception 'FAIL 4d: anon read the invitation table';
  exception when insufficient_privilege then null;
  end;

  -- 5. invite_preview: an invalid token reveals nothing
  r := public.invite_preview('definitely-not-a-real-token');
  if coalesce((r ->> 'valid')::boolean, true) then
    raise exception 'FAIL 5a: invite_preview accepted a bad token';
  end if;
  if r ->> 'email' is not null or r ->> 'role' is not null
     or r ->> 'inviter' is not null or r ->> 'expires_at' is not null then
    raise exception 'FAIL 5b: invite_preview leaked fields for an invalid token: %', r;
  end if;

  -- an already-redeemed token is indistinguishable from an unknown one
  if public.invite_preview('rlstest-viewer-0000000000000000000001') is distinct from r then
    raise exception 'FAIL 5c: a used token returns a different payload than an unknown one';
  end if;

  -- a live token does work
  r := public.invite_preview('rlstest-unused-0000000000000000000004');
  if not coalesce((r ->> 'valid')::boolean, false) then
    raise exception 'FAIL 5d: invite_preview rejected a live token: %', r;
  end if;

  -- and ping() is reachable for the keep-alive workflow
  perform public.ping();
end;
$$;


-- -----------------------------------------------------------------------------
reset role;
rollback;

select 'RLS smoke tests passed' as result;
