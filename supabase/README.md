# Supabase backend for the admin portal

Everything the portal needs lives in one file: `migrations/0001_admin_portal.sql`.
No business data, staff names or e-mail addresses appear anywhere in this
directory — the repository is public, the data is not.

## What the migration sets up

- **Tables** (`public`): `profiles`, `invitations`, `projects`, `project_members`,
  `tasks`, `reports`, `partners`, `project_state`, `project_docs`, `comments`,
  `activity` — with check constraints, foreign keys and the indexes the portal's
  queries actually use.
- **Row Level Security**: enabled *and forced* on every table. `anon` has no
  table privileges at all; `authenticated` gets the four DML verbs everywhere and
  the policies decide what really happens. Policies are expressed through six
  `SECURITY DEFINER` helpers — `has_profile()`, `is_owner()`, `is_admin()`,
  `is_member(pid)`, `can_edit(pid)`, `can_manage(pid)`.
- **Invite-only signup**: an `AFTER INSERT` trigger on `auth.users` validates
  `raw_user_meta_data->>'invite_token'` against `public.invitations` and raises
  if it does not check out, which rolls the whole signup back. On success it
  creates the profile, applies the invitation's per-project grants and stamps the
  invitation accepted.
- **Guards**: a user may only edit their own `full_name` / `title` /
  `last_seen_at`; only an owner may change a role; `id` and `email` are immutable
  from the client; there is always at least one owner; `owner` invitations can
  never be created from the portal and `admin` invitations require an owner.
- **Audit + activity**: `updated_at` / `updated_by` (and `created_*` on insert)
  are stamped by trigger, and every meaningful change to tasks, reports,
  partners, project state and comments becomes a one-line entry in `activity`
  (`Status: To do → Done`, `Due: Sep 20 → Sep 25`, `Commented on "…"`). Pure
  re-orders and no-op saves are not logged. Each project's feed self-prunes to
  its newest 1,000 rows.
- **Realtime**: the nine content tables are added to the `supabase_realtime`
  publication, the delete-sensitive ones get `replica identity full`, and
  `realtime.messages` carries policies so only project members can join the
  private `project:<uuid>` channel used for presence and broadcast.
- **Keep-alive**: `public.ping()`, executable by `anon`.

## How to run it

1. Open the Supabase dashboard for the project → **SQL Editor** → new query.
2. Paste the entire contents of `migrations/0001_admin_portal.sql` and run it.
   The editor connects as `postgres`, which is what the script assumes.
3. The result grid of the last statement shows a single `token` value. That is
   the **bootstrap owner invitation**. The join link is

   ```
   https://www.mercermedtech.com/admin/#/join/<token>
   ```

   Hand it to the site owner out of band (text, chat, whatever). It expires in
   30 days and is single-use. Whoever signs up with it becomes the first `owner`;
   every account after that comes from an invitation created in the portal.

Re-running the script on an already-migrated database is safe. It will not
retro-fit column changes onto tables that already exist, so schema changes
belong in a new `0002_*.sql`.

### Sanity check

The script relies on the `postgres` role carrying `BYPASSRLS` (that is how the
`SECURITY DEFINER` helpers read `profiles` without re-entering the policies that
call them). On Supabase it does; if you ever port this elsewhere, verify with:

```sql
select rolbypassrls from pg_roles where rolname = 'postgres';  -- expect true
```

There is also a transaction-wrapped smoke test (`rls_tests.sql`, kept outside
this public repo) that can be pasted into the SQL Editor straight after the
migration. It fabricates three users through the real signup path, asserts the
policies from each of their points of view, then rolls itself back and prints
`RLS smoke tests passed`.

## Dashboard settings that must accompany the migration

These are **not** in SQL — set them by hand, once, or the portal will not work.

**Authentication → Sign In / Providers → Email**

| Setting | Value | Why |
| --- | --- | --- |
| Enable Email provider | **ON** | Email + password is the only sign-in method. |
| Confirm email | **OFF** | Free-tier e-mail is rate limited to a handful per hour. With confirmation off, `signUp()` returns a session immediately and the invited person is straight into the portal. |
| Allow new users to sign up | **ON** | Counter-intuitive but required: the database trigger is what makes the portal invite-only. Turning this off would block invited people too. |
| Secure password change / Minimum password length | your preference | 8+ recommended. |

**Authentication → URL Configuration**

| Field | Value |
| --- | --- |
| Site URL | `https://www.mercermedtech.com/admin/` |
| Redirect URLs | `https://www.mercermedtech.com/admin/**` |
| | `http://127.0.0.1:4321/admin/**` |
| | `http://localhost:4321/admin/**` |

The two localhost entries are for `npm run dev`. The site is hash-routed, so
`#/reset` and friends never need a server-side rewrite.

**Nothing else needs changing.** In particular do not enable any OAuth provider,
do not add a custom SMTP server unless password resets become a problem, and
never put a `service_role` key anywhere near this repository.

If `POST /rest/v1/rpc/ping` returns 404 straight after the migration, PostgREST
has not reloaded its schema cache yet: **Settings → API → Reload schema cache**,
or just wait a minute.

## How invites work

1. An admin (or owner) opens **People** in the portal and creates an invitation:
   optional e-mail binding, a global role (`member`, or `admin` if an owner is
   doing it), optional per-project grants, an optional note, and an expiry that
   defaults to 14 days.
2. The portal shows a copyable link: `/admin/#/join/<token>`. Send it however is
   convenient — the system never sends e-mail.
3. The join screen calls `invite_preview(token)` (the one RPC `anon` may execute)
   to greet the invitee. Every invalid case — unknown, revoked, expired, already
   used, malformed — returns exactly the same `{valid:false}` payload, so the
   endpoint cannot be used to probe for live tokens.
4. The invitee sets a password. `signUp()` carries the token in user metadata;
   the `auth.users` trigger validates it, creates the profile and the project
   memberships, and marks the invitation accepted. A bad token means the signup
   raises and no auth user is created at all.
5. An invitation can be revoked at any time (set `revoked_at`) or deleted.

Password reset is the one flow that does use Supabase's e-mail, redirecting to
`/admin/#/reset`. It is rare enough to stay inside the free-tier limit.

## Free-tier notes

- **E-mail rate limit** is roughly 2–4 messages per hour on the built-in SMTP.
  That is why nothing in this design depends on e-mail: invitations travel as
  links, and confirmation is off. Only password resets send mail.
- **Projects pause after 7 days without API activity.** The workflow at
  `.github/workflows/supabase-keepalive.yml` POSTs to `/rest/v1/rpc/ping` every
  Monday and Thursday at 13:00 UTC, which is enough to keep the project awake.
  Note that GitHub disables scheduled workflows in repositories with no activity
  for 60 days — if the project ever pauses anyway, check that first.
- **Realtime budget**: 200 concurrent connections and 2M messages/month. The
  portal opens exactly one channel per *open* project and closes it on leaving;
  the home screen uses plain queries.
- **Database**: 500 MB. The activity feed self-prunes to 1,000 rows per project;
  everything else is small text and JSON. The portal never stores files — the
  `sources` columns only record where an original lives.

## Rollback

Order matters: the trigger on `auth.users` lives outside our schema, so it has to
go first, and the profile guard has to be dropped before anything can delete the
last owner.

```sql
-- 1. detach from auth
drop trigger if exists on_auth_user_created on auth.users;

-- 2. drop the realtime policies and publication membership
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists mmt_project_channel_read on realtime.messages';
    execute 'drop policy if exists mmt_project_channel_write on realtime.messages';
  end if;
end;
$$;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'projects','project_members','tasks','reports','partners',
    'project_state','project_docs','comments','activity'
  ] loop
    if exists (select 1 from pg_publication_tables
                where pubname='supabase_realtime'
                  and schemaname='public' and tablename=v_table) then
      execute format('alter publication supabase_realtime drop table public.%I', v_table);
    end if;
  end loop;
end;
$$;

-- 3. guards off, so the tables can actually be dropped
drop trigger if exists trg_protect_profile        on public.profiles;
drop trigger if exists trg_protect_profile_delete on public.profiles;
drop trigger if exists trg_guard_invitation       on public.invitations;

-- 4. tables (cascade takes the triggers, policies and indexes with them)
drop table if exists public.activity       cascade;
drop table if exists public.comments       cascade;
drop table if exists public.project_docs   cascade;
drop table if exists public.project_state  cascade;
drop table if exists public.partners       cascade;
drop table if exists public.reports        cascade;
drop table if exists public.tasks          cascade;
drop table if exists public.project_members cascade;
drop table if exists public.projects       cascade;
drop table if exists public.invitations    cascade;
drop table if exists public.profiles       cascade;

-- 5. functions
drop function if exists public.handle_new_user();
drop function if exists public.set_audit();
drop function if exists public.set_comment_author();
drop function if exists public.log_activity();
drop function if exists public.protect_profile();
drop function if exists public.protect_profile_delete();
drop function if exists public.guard_invitation();
drop function if exists public.add_project_creator();
drop function if exists public.invite_preview(text);
drop function if exists public.ping();
drop function if exists public.topic_project_id();
drop function if exists public.can_manage(uuid);
drop function if exists public.can_edit(uuid);
drop function if exists public.is_member(uuid);
drop function if exists public.is_admin();
drop function if exists public.is_owner();
drop function if exists public.has_profile();
drop function if exists public.display_name(uuid);
drop function if exists public.activity_label(text);
drop function if exists public.fmt_day(text);
drop function if exists public.fmt_money(text);
drop function if exists public.current_uid();
```

Dropping the tables does **not** delete the `auth.users` rows. To start
completely clean, remove the users from Authentication → Users afterwards (or
`delete from auth.users;` while the trigger is dropped).
