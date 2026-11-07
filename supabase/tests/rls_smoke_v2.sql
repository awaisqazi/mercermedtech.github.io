-- =============================================================================
-- MMT Workbench v2: RLS smoke tests
-- =============================================================================
-- Run after supabase/migrations/0002_workspace.sql, either pasted into the SQL
-- Editor or with psql:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke_v2.sql
--
-- Everything happens inside one transaction that ends in ROLLBACK, so nothing
-- survives: no auth users, profiles, tasks, hours, inquiries or invitations,
-- and the ingest secret it sets is put back as it was.
--
-- People are made through the real signup path: rows inserted into auth.users
-- carry an invitation token in raw_user_meta_data, and the signup trigger
-- creates their profiles. Policies are then exercised by switching role and
-- setting request.jwt.claims by hand, which is what PostgREST does on every
-- request.
--
-- On a database that already has an owner, the signup trigger turns an owner
-- invitation into an administrator account (as it should). The test then
-- promotes its owner directly, as postgres, so it runs the same on a fresh
-- local database and on the live project. It also resets the seeded roles'
-- permissions to the plan's values for the length of the transaction, so
-- edits made in the portal do not change what is being tested.
--
-- Every failure raises. If the script reaches the end and prints
-- "RLS smoke tests v2 passed", every assertion held.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Fixtures, as postgres
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '';

update public.roles set permissions = array['tasks.create', 'tasks.assign', 'tasks.edit_any',
  'tasks.delete', 'hours.log', 'hours.view_all', 'hours.edit_any', 'hours.close',
  'hours.export', 'projects.manage', 'people.manage', 'roles.manage',
  'inquiries.view', 'inquiries.manage']
 where key = 'administrator';
update public.roles set permissions = array['tasks.create', 'tasks.assign', 'hours.log',
  'hours.view_all', 'hours.edit_any', 'hours.close', 'hours.export']
 where key = 'finance';
update public.roles set permissions = array['tasks.create', 'hours.log']
 where key = 'member';

insert into public.invitations (id, token, role_id, note, expires_at)
select v.id, v.token, r.id, 'rls test', now() + interval '1 day'
  from (values
    ('0d000000-0000-4000-8000-000000000001'::uuid, 'rlstest-owner-00000000000000000001',   'owner'),
    ('0d000000-0000-4000-8000-000000000002'::uuid, 'rlstest-finance-000000000000000002',   'finance'),
    ('0d000000-0000-4000-8000-000000000003'::uuid, 'rlstest-member-00000000000000000003',  'member'),
    ('0d000000-0000-4000-8000-000000000004'::uuid, 'rlstest-admin-00000000000000000004',   'administrator'),
    ('0d000000-0000-4000-8000-000000000005'::uuid, 'rlstest-unused-00000000000000000005',  'member')
  ) as v(id, token, role_key)
  join public.roles r on r.key = v.role_key;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
select '00000000-0000-0000-0000-000000000000', v.id,
       'authenticated', 'authenticated', v.email, '',
       now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('invite_token', v.token, 'full_name', v.full_name)
  from (values
    ('0b000000-0000-4000-8000-000000000001'::uuid, 'rls-owner@example.test',
     'rlstest-owner-00000000000000000001', 'Test Owner'),
    ('0b000000-0000-4000-8000-000000000002'::uuid, 'rls-finance@example.test',
     'rlstest-finance-000000000000000002', 'Test Finance'),
    ('0b000000-0000-4000-8000-000000000003'::uuid, 'rls-member@example.test',
     'rlstest-member-00000000000000000003', 'Test Member'),
    ('0b000000-0000-4000-8000-000000000004'::uuid, 'rls-admin@example.test',
     'rlstest-admin-00000000000000000004', 'Test Admin')
  ) as v(id, email, token, full_name);

-- See the header: on a database with an owner, the test owner arrives as an
-- administrator and is promoted here.
update public.profiles
   set role_id = (select r.id from public.roles r where r.key = 'owner')
 where id = '0b000000-0000-4000-8000-000000000001';

do $$
declare
  n int;
  k text;
begin
  select count(*) into n from public.profiles
   where id in ('0b000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000002',
                '0b000000-0000-4000-8000-000000000003', '0b000000-0000-4000-8000-000000000004')
     and active;
  if n <> 4 then
    raise exception 'FAIL 0a: the signup trigger made % of 4 active profiles', n;
  end if;

  select r.key into k from public.profiles p join public.roles r on r.id = p.role_id
   where p.id = '0b000000-0000-4000-8000-000000000002';
  if k is distinct from 'finance' then
    raise exception 'FAIL 0b: the finance person has role %', k;
  end if;

  select r.key into k from public.profiles p join public.roles r on r.id = p.role_id
   where p.id = '0b000000-0000-4000-8000-000000000003';
  if k is distinct from 'member' then
    raise exception 'FAIL 0c: the member has role %', k;
  end if;

  select count(*) into n from public.invitations
   where id in ('0d000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000002',
                '0d000000-0000-4000-8000-000000000003', '0d000000-0000-4000-8000-000000000004')
     and accepted_at is not null;
  if n <> 4 then
    raise exception 'FAIL 0d: % of 4 invitations were marked accepted', n;
  end if;

  if array_length(public.permission_catalogue(), 1) <> 14 then
    raise exception 'FAIL 0e: the permission catalogue has % keys, expected 14',
      array_length(public.permission_catalogue(), 1);
  end if;

  begin
    update public.roles set permissions = array['tasks.fly'] where key = 'member';
    raise exception 'FAIL 0f: a permission outside the catalogue was accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- Signups without a usable token are refused.
do $$
begin
  begin
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', '0b000000-0000-4000-8000-0000000000f1',
            'authenticated', 'authenticated', 'rls-nobody@example.test', now(), now(), '{}'::jsonb);
    raise exception 'FAIL 1a: a signup with no invite_token succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', '0b000000-0000-4000-8000-0000000000f2',
            'authenticated', 'authenticated', 'rls-bogus@example.test', now(), now(),
            jsonb_build_object('invite_token', 'this-token-does-not-exist'));
    raise exception 'FAIL 1b: a signup with an unknown invite_token succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', '0b000000-0000-4000-8000-0000000000f3',
            'authenticated', 'authenticated', 'rls-reuse@example.test', now(), now(),
            jsonb_build_object('invite_token', 'rlstest-member-00000000000000000003'));
    raise exception 'FAIL 1c: an accepted invite_token was used twice';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Content, as postgres, with fixed authors.
insert into public.projects (id, name, code, track, created_by)
values ('0a000000-0000-4000-8000-000000000001', 'RLS test project', 'ZQRT', 'org',
        '0b000000-0000-4000-8000-000000000001');

insert into public.tasks (id, project_id, title, status, assignee_id, created_by) values
  ('0c000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
   'Unassigned task', 'todo', null, '0b000000-0000-4000-8000-000000000001'),
  ('0c000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001',
   'Task for the member', 'todo', '0b000000-0000-4000-8000-000000000003',
   '0b000000-0000-4000-8000-000000000001'),
  ('0c000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000001',
   'Task for finance', 'todo', '0b000000-0000-4000-8000-000000000002',
   '0b000000-0000-4000-8000-000000000001');

-- A known ingest secret for this transaction only (the rollback restores the real one).
select public.set_ingest_secret('rls-smoke-secret-00000000000000000000');


-- -----------------------------------------------------------------------------
-- anon: invite_preview, ping and ingest_form_response; nothing else
-- -----------------------------------------------------------------------------
set local role anon;

do $$
declare
  n    int;
  r    jsonb;
  v_id uuid;
begin
  begin
    execute 'select count(*) from public.tasks' into n;
    raise exception 'FAIL 2a: anon read tasks';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select count(*) from public.profiles' into n;
    raise exception 'FAIL 2b: anon read the directory';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select count(*) from public.inquiries' into n;
    raise exception 'FAIL 2c: anon read inquiries';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select count(*) from public.ingest_secrets' into n;
    raise exception 'FAIL 2d: anon read ingest_secrets';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.set_ingest_secret('anon-tries-to-set-the-secret-000');
    raise exception 'FAIL 2e: anon executed set_ingest_secret';
  exception when insufficient_privilege then null;
  end;

  r := public.invite_preview('definitely-not-a-real-token');
  if coalesce((r ->> 'valid')::boolean, true)
     or r ->> 'email' is not null or r ->> 'role_name' is not null
     or r ->> 'inviter' is not null or r ->> 'expires_at' is not null then
    raise exception 'FAIL 2f: invite_preview gave something away for a bad token: %', r;
  end if;

  if public.invite_preview('rlstest-member-00000000000000000003') is distinct from r then
    raise exception 'FAIL 2g: a used token answers differently from an unknown one';
  end if;

  r := public.invite_preview('rlstest-unused-00000000000000000005');
  if not coalesce((r ->> 'valid')::boolean, false) or r ->> 'role_name' is null then
    raise exception 'FAIL 2h: invite_preview did not describe a live token: %', r;
  end if;

  perform public.ping();

  begin
    perform public.ingest_form_response('wrong-secret-0000000000000000', 'dlt_interest',
      'en', '/digital-literacy/', 'Test Person', 'person@example.test',
      '[{"k":"Program","v":"Test"}]'::jsonb);
    raise exception 'FAIL 2i: ingest_form_response took a wrong secret';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ingest_form_response('rls-smoke-secret-00000000000000000000', 'not_a_form',
      'en', '/', 'Test Person', '', '[]'::jsonb);
    raise exception 'FAIL 2j: ingest_form_response took an unknown source';
  exception when insufficient_privilege then null;
  end;

  v_id := public.ingest_form_response('rls-smoke-secret-00000000000000000000', 'dlt_interest',
    'es', '/es/digital-literacy/', 'Test Person', 'person@example.test',
    jsonb_build_array(jsonb_build_object('k', 'Program', 'v', 'Test'),
                      jsonb_build_object('k', 'Note', 'v', repeat('x', 2500))));
  if v_id is null then
    raise exception 'FAIL 2k: ingest_form_response returned no id';
  end if;
end;
$$;

reset role;
set local request.jwt.claims = '';

do $$
declare
  n int;
begin
  select count(*) into n from public.inquiries i
   where i.name = 'Test Person' and i.lang = 'es' and i.status = 'new'
     and char_length(i.fields -> 1 ->> 'v') = 2000;
  if n <> 1 then
    raise exception 'FAIL 2l: the ingested inquiry is missing or was not cut to length';
  end if;

  select count(*) into n from public.activity a
   where a.entity = 'inquiry' and a.summary = 'New inquiry from the DLT interest form';
  if n < 1 then
    raise exception 'FAIL 2m: ingesting wrote no activity line';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- The member
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"0b000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;

do $$
declare
  n    int;
  v_t  text;
  v_tb text;
begin
  select count(*) into n from public.profiles;
  if n < 4 then
    raise exception 'FAIL 3a: the member sees only % profiles', n;
  end if;

  select count(*) into n from public.invitations;
  if n <> 0 then
    raise exception 'FAIL 3b: the member reads % invitations', n;
  end if;

  select count(*) into n from public.inquiries;
  if n <> 0 then
    raise exception 'FAIL 3c: the member, without inquiries.view, reads % inquiries', n;
  end if;

  -- hours: own entry, the 24-hour day, quarter hours, nobody else's entries
  insert into public.time_entries (user_id, work_date, hours, project_id, summary)
  values ('0b000000-0000-4000-8000-000000000003', '2000-03-15', 2.5,
          '0a000000-0000-4000-8000-000000000001', 'Member work');

  begin
    insert into public.time_entries (user_id, work_date, hours, summary)
    values ('0b000000-0000-4000-8000-000000000003', '2000-03-15', 22, 'Too much');
    raise exception 'FAIL 3d: a day of more than 24 hours was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.time_entries (user_id, work_date, hours, summary)
    values ('0b000000-0000-4000-8000-000000000003', '2000-03-14', 1.3, 'Not a quarter');
    raise exception 'FAIL 3e: hours that are not quarter hours were accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.time_entries (user_id, work_date, hours, summary)
    values ('0b000000-0000-4000-8000-000000000002', '2000-03-14', 1, 'For someone else');
    raise exception 'FAIL 3f: the member logged hours for someone else';
  exception when insufficient_privilege then null;
  end;

  select count(*) into n from public.activity a
   where a.summary = 'Logged 2.5 h on ZQRT';
  if n < 1 then
    raise exception 'FAIL 3g: logging hours wrote no "Logged 2.5 h on ZQRT" line';
  end if;

  -- tasks: take an unassigned one
  update public.tasks set assignee_id = '0b000000-0000-4000-8000-000000000003'
   where id = '0c000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL 3h: the member could not take an unassigned task';
  end if;

  -- edit one assigned to them
  update public.tasks set status = 'doing'
   where id = '0c000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL 3i: the member could not edit a task assigned to them';
  end if;

  select count(*) into n from public.activity a
   where a.task_id = '0c000000-0000-4000-8000-000000000002'
     and a.summary = 'Status: To do → In progress';
  if n < 1 then
    raise exception 'FAIL 3j: no "Status: To do → In progress" line for the task';
  end if;

  -- not one assigned to someone else
  update public.tasks set status = 'done'
   where id = '0c000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL 3k: the member edited a task that is not theirs';
  end if;

  -- cannot assign to someone else, on create or on update
  begin
    insert into public.tasks (title, assignee_id)
    values ('Member assigns to finance', '0b000000-0000-4000-8000-000000000002');
    raise exception 'FAIL 3l: the member created a task assigned to someone else';
  exception when insufficient_privilege then null;
  end;

  insert into public.tasks (id, title)
  values ('0c000000-0000-4000-8000-000000000004', 'Member task');

  begin
    update public.tasks set assignee_id = '0b000000-0000-4000-8000-000000000002'
     where id = '0c000000-0000-4000-8000-000000000004';
    raise exception 'FAIL 3m: the member assigned a task to someone else';
  exception when insufficient_privilege then null;
  end;

  -- checklist drives progress
  insert into public.task_items (id, task_id, text)
  values ('0e000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000002', 'Step one');
  update public.task_items set done = true where id = '0e000000-0000-4000-8000-000000000001';
  select t.progress::text into v_t from public.tasks t where t.id = '0c000000-0000-4000-8000-000000000002';
  if v_t is distinct from '100' then
    raise exception 'FAIL 3n: a ticked one-item checklist left progress at %', v_t;
  end if;

  begin
    insert into public.task_items (task_id, text)
    values ('0c000000-0000-4000-8000-000000000003', 'Not my task');
    raise exception 'FAIL 3o: the member added to the checklist of a task that is not theirs';
  exception when insufficient_privilege then null;
  end;

  -- anyone may comment
  insert into public.task_comments (task_id, user_id, body)
  values ('0c000000-0000-4000-8000-000000000003', '0b000000-0000-4000-8000-000000000003',
          'A member may comment.');

  -- roles and people
  begin
    update public.profiles set role_id = (select r.id from public.roles r where r.key = 'owner')
     where id = '0b000000-0000-4000-8000-000000000003';
    raise exception 'FAIL 3p: the member changed their own role';
  exception when insufficient_privilege then null;
  end;

  update public.profiles set active = false where id = '0b000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL 3q: the member deactivated the owner';
  end if;

  begin
    insert into public.roles (key, name) values ('rls_test_role', 'RLS test role');
    raise exception 'FAIL 3r: the member created a role';
  exception when insufficient_privilege then null;
  end;

  -- sealed tables and functions
  foreach v_tb in array array[
    'legacy_projects', 'legacy_project_members', 'legacy_tasks', 'legacy_reports',
    'legacy_partners', 'legacy_project_state', 'legacy_project_docs',
    'legacy_comments', 'legacy_activity', 'ingest_secrets'
  ] loop
    begin
      execute format('select count(*) from public.%I', v_tb) into n;
      raise exception 'FAIL 3s: authenticated read public.%', v_tb;
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    perform public.set_ingest_secret('member-tries-to-set-the-secret-0');
    raise exception 'FAIL 3t: authenticated executed set_ingest_secret';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.activity (entity, action, summary) values ('task', 'created', 'forged');
    raise exception 'FAIL 3u: a client wrote to the activity feed';
  exception when insufficient_privilege then null;
  end;
end;
$$;


-- -----------------------------------------------------------------------------
-- Finance: sees everyone's hours, closes a month, still writes in it
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"0b000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from public.time_entries
   where user_id = '0b000000-0000-4000-8000-000000000003';
  if n < 1 then
    raise exception 'FAIL 4a: finance cannot see the member''s hours';
  end if;

  select count(*) into n from public.inquiries;
  if n <> 0 then
    raise exception 'FAIL 4b: finance, without inquiries.view, reads % inquiries', n;
  end if;

  insert into public.hours_months (month, note) values ('2000-03-01', 'rls test');

  insert into public.time_entries (user_id, work_date, hours, summary)
  values ('0b000000-0000-4000-8000-000000000002', '2000-03-10', 1, 'Finance work');

  select count(*) into n from public.activity a where a.summary = 'Closed March 2000';
  if n < 1 then
    raise exception 'FAIL 4c: closing the month wrote no "Closed March 2000" line';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- The member again: the closed month is frozen for them
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"0b000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;

do $$
declare
  n int;
begin
  begin
    insert into public.time_entries (user_id, work_date, hours, summary)
    values ('0b000000-0000-4000-8000-000000000003', '2000-03-16', 1, 'Too late');
    raise exception 'FAIL 5a: the member logged hours in a closed month';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.time_entries set hours = 3
     where user_id = '0b000000-0000-4000-8000-000000000003' and work_date = '2000-03-15';
    raise exception 'FAIL 5b: the member changed hours in a closed month';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.time_entries
     where user_id = '0b000000-0000-4000-8000-000000000003' and work_date = '2000-03-15';
    raise exception 'FAIL 5c: the member deleted hours in a closed month';
  exception when insufficient_privilege then null;
  end;

  select count(*) into n from public.time_entries
   where user_id = '0b000000-0000-4000-8000-000000000002';
  if n <> 0 then
    raise exception 'FAIL 5d: the member reads % of finance''s entries', n;
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- The administrator: people.manage, but not the owner role
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"0b000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;

do $$
declare
  n int;
begin
  begin
    update public.profiles set role_id = (select r.id from public.roles r where r.key = 'owner')
     where id = '0b000000-0000-4000-8000-000000000003';
    raise exception 'FAIL 6a: a non-owner granted the owner role';
  exception when insufficient_privilege then null;
  end;

  update public.profiles set role_id = (select r.id from public.roles r where r.key = 'instructor')
   where id = '0b000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL 6b: the administrator could not change a member''s role';
  end if;
  update public.profiles set role_id = (select r.id from public.roles r where r.key = 'member')
   where id = '0b000000-0000-4000-8000-000000000003';

  begin
    insert into public.invitations (role_id, note)
    values ((select r.id from public.roles r where r.key = 'owner'), 'rls test');
    raise exception 'FAIL 6c: an owner invitation was created from the portal';
  exception when insufficient_privilege then null;
  end;

  insert into public.invitations (role_id, note)
  values ((select r.id from public.roles r where r.key = 'member'), 'rls test');

  begin
    update public.profiles set active = false where id = '0b000000-0000-4000-8000-000000000001';
    raise exception 'FAIL 6d: a non-owner deactivated an owner';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set active = false where id = '0b000000-0000-4000-8000-000000000004';
    raise exception 'FAIL 6e: the administrator deactivated themselves';
  exception when insufficient_privilege then null;
  end;

  update public.profiles set active = false where id = '0b000000-0000-4000-8000-000000000003';
  update public.profiles set active = true  where id = '0b000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL 6f: the administrator could not reactivate the member';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- The owner: the owner role is fixed, roles in use stay, the inbox works
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '{"sub":"0b000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

do $$
declare
  n    int;
  v_id uuid;
begin
  begin
    update public.roles set name = 'Boss' where key = 'owner';
    raise exception 'FAIL 7a: the owner role was edited';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.roles where key = 'member';
    raise exception 'FAIL 7b: a role in use was deleted';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set role_id = (select r.id from public.roles r where r.key = 'member')
     where id = '0b000000-0000-4000-8000-000000000001';
    raise exception 'FAIL 7c: the owner changed their own role';
  exception when insufficient_privilege then null;
  end;

  select i.id into v_id from public.inquiries i where i.name = 'Test Person';
  if v_id is null then
    raise exception 'FAIL 7d: the owner cannot see the inbox';
  end if;

  update public.inquiries set status = 'contacted', notes = 'Called back' where id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL 7e: the owner could not update an inquiry';
  end if;

  select count(*) into n from public.activity a
   where a.entity = 'inquiry' and a.entity_id = v_id and a.summary = 'Status: New → Contacted';
  if n < 1 then
    raise exception 'FAIL 7f: no "Status: New → Contacted" line for the inquiry';
  end if;

  begin
    update public.inquiries set name = 'Someone else' where id = v_id;
    raise exception 'FAIL 7g: what the person sent was edited';
  exception when insufficient_privilege then null;
  end;
end;
$$;


-- -----------------------------------------------------------------------------
-- The last active owner, whoever asks
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

-- Make the test owner the only active owner (rolled back at the end).
update public.profiles p
   set active = false
  from public.roles r
 where r.id = p.role_id and r.key = 'owner' and p.active
   and p.id <> '0b000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    update public.profiles set active = false where id = '0b000000-0000-4000-8000-000000000001';
    raise exception 'FAIL 8a: the last active owner was deactivated';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set role_id = (select r.id from public.roles r where r.key = 'administrator')
     where id = '0b000000-0000-4000-8000-000000000001';
    raise exception 'FAIL 8b: the last active owner was demoted';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.profiles where id = '0b000000-0000-4000-8000-000000000001';
    raise exception 'FAIL 8c: the last active owner was deleted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- The administrator, a non-owner, against the last owner.
set local request.jwt.claims = '{"sub":"0b000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;

do $$
begin
  begin
    update public.profiles set active = false where id = '0b000000-0000-4000-8000-000000000001';
    raise exception 'FAIL 8d: a non-owner deactivated the last owner';
  exception when insufficient_privilege then null;
  end;
end;
$$;


-- -----------------------------------------------------------------------------
-- Privileges, read from the catalogue
-- -----------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

do $$
declare
  v_list text;
  v_tb   text;
begin
  -- anon may execute exactly three functions in public (extension members aside).
  select string_agg(p.oid::regprocedure::text, ', ' order by 1)
    into v_list
    from pg_catalog.pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.proname not in ('invite_preview', 'ping', 'ingest_form_response')
     and not exists (
       select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::regclass
          and d.objid = p.oid and d.deptype = 'e');
  if v_list is not null then
    raise exception 'FAIL 9a: anon can execute %', v_list;
  end if;

  if not has_function_privilege('anon', 'public.invite_preview(text)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.ping()', 'EXECUTE')
     or not has_function_privilege('anon',
          'public.ingest_form_response(text, text, text, text, text, text, jsonb)', 'EXECUTE')
  then
    raise exception 'FAIL 9b: anon cannot execute one of its three entry points';
  end if;

  if has_function_privilege('anon', 'public.set_ingest_secret(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.set_ingest_secret(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.set_ingest_secret(text)', 'EXECUTE')
  then
    raise exception 'FAIL 9c: someone other than postgres can execute set_ingest_secret';
  end if;

  -- trigger functions are not callable by clients
  select string_agg(p.oid::regprocedure::text, ', ' order by 1)
    into v_list
    from pg_catalog.pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prorettype = 'trigger'::regtype
     and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_list is not null then
    raise exception 'FAIL 9d: authenticated can execute trigger functions: %', v_list;
  end if;

  foreach v_tb in array array[
    'legacy_projects', 'legacy_project_members', 'legacy_tasks', 'legacy_reports',
    'legacy_partners', 'legacy_project_state', 'legacy_project_docs',
    'legacy_comments', 'legacy_activity', 'ingest_secrets'
  ] loop
    if to_regclass('public.' || v_tb) is null then
      raise exception 'FAIL 9e: public.% is missing', v_tb;
    end if;
    if has_table_privilege('anon', 'public.' || v_tb, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || v_tb, 'SELECT') then
      raise exception 'FAIL 9f: public.% is readable through the API', v_tb;
    end if;
    if exists (select 1 from pg_catalog.pg_policies pol
                where pol.schemaname = 'public' and pol.tablename = v_tb) then
      raise exception 'FAIL 9g: public.% has policies', v_tb;
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables pt
                where pt.pubname = 'supabase_realtime'
                  and pt.schemaname = 'public' and pt.tablename = v_tb) then
      raise exception 'FAIL 9h: public.% is in the realtime publication', v_tb;
    end if;
  end loop;

  raise notice 'RLS smoke tests v2 passed';
end;
$$;

rollback;

select 'RLS smoke tests v2 passed' as result;
