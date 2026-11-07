# Supabase backend for MMT Workbench

The portal at `/admin/` runs on two migrations:

- `migrations/0001_admin_portal.sql`: the v1 grant portal. Kept because the
  live database was built from it.
- `migrations/0002_workspace.sql`: the v2 workspace. It turns the v1 schema
  into v2 in one transaction and is safe to re-run.

No business data, staff names or e-mail addresses appear anywhere in this
directory. The repository is public; the data is not.

## What 0002 sets up

- **Roles.** A role is a named set of permissions. The catalogue is fixed:
  fourteen keys, returned by `permission_catalogue()` and enforced by a check
  constraint on `roles.permissions` (the app mirrors it in
  `src/admin/lib/types.ts`). Seven roles are seeded: `owner`, `administrator`,
  `technology_lead`, `instructor`, `course_designer`, `finance`, `member`.
  Anyone with `roles.manage` can add and edit roles; the owner role is built
  in and cannot be edited or deleted, and a role in use cannot be deleted.
- **Tables** (`public`): `roles`, `profiles`, `invitations`, `projects`,
  `tasks`, `task_items`, `task_comments`, `time_entries`, `hours_months`,
  `activity`, `inquiries`, `ingest_secrets`.
- **Row level security**, enabled and forced on every table. `anon` has no
  table privileges at all. `authenticated` gets only the verbs each table has
  policies for. Policies speak through a few `SECURITY DEFINER` helpers:
  `has_profile()`, `my_role_key()`, `has_perm(p)`, `is_owner()`,
  `task_is_mine(task_id)`, `month_is_closed(d)`, `topic_is_workspace()`. An
  inactive account counts as no account.
- **Rules enforced in SQL, whatever the role:**
  - only an owner gives or takes the owner role, and nobody invites an owner;
  - nobody changes their own role or deactivates themselves;
  - there is always at least one active owner;
  - you may take an unassigned task; giving a task to someone else needs
    `tasks.assign`;
  - a person's day holds at most 24 hours, in quarter hours;
  - a closed month refuses every write to its hours, except from someone
    with `hours.close`;
  - what a person sent through a public form cannot be edited.
- **Tasks.** `done_at` follows the status. When a task has a checklist, its
  `progress` is the share of items ticked; otherwise it is set by hand.
- **Activity.** Every meaningful change becomes one plain line in
  `activity` ("Status: To do → In progress", "Logged 2.5 h on DLT", "Closed
  March 2026"). Re-orders, no-op saves and presence updates are not logged.
  The feed prunes itself to its newest 3000 rows.
- **Inquiries.** The three public forms still post to Google, which stays the
  record. The Cloudflare Worker then copies each response here by calling
  `ingest_form_response(...)`, which `anon` may execute but which refuses any
  call without the shared secret. The secret sits in `ingest_secrets`, which
  only `postgres` can read.
- **Realtime.** The v2 tables (not `ingest_secrets`) are in the
  `supabase_realtime` publication. Changes are filtered by RLS for each
  subscriber, so a person without `hours.view_all` never receives someone
  else's hours. Presence and broadcast use one private channel, `workspace`,
  open to every active account.
- **Keep-alive.** `ping()`, executable by `anon`.

`anon` can execute three functions: `invite_preview`, `ping` and
`ingest_form_response`. Nothing else.

## How to apply it

The CLI is linked to the project, so from the repository root:

```sh
# Once only: 0001 was pasted into the SQL Editor by hand, so tell the CLI it
# has already run.
supabase migration repair --status applied 0001

# Then apply 0002.
supabase db push
```

`db push` runs the file in a transaction as `postgres`. Pasting the whole
file into the SQL Editor works the same way.

Then set the Worker's secret once. Choose a long random value, run this, and
put the same value into the Worker as the secret `INGEST_SECRET`:

```sh
supabase db query --linked "select public.set_ingest_secret('<the secret>')"
```

The secret never goes into this repository. Until it is set, every copy from
the Worker is refused and the forms keep working as before.

### Checking it

`tests/rls_smoke_v2.sql` is a transaction that ends in `rollback`. Paste it
into the SQL Editor straight after the migration, or run it with psql:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke_v2.sql
```

It makes an owner, an administrator, a finance person and a member through
the real signup path, checks the rules above from each of their points of
view, checks which functions `anon` can execute, rolls everything back and
prints `RLS smoke tests v2 passed`. Any failure stops it with a `FAIL` line.

Locally, with Docker running: `supabase start`, then `supabase db reset`
applies 0001 and 0002 to a fresh database.

The helpers rely on `postgres` having `BYPASSRLS`, which it does on Supabase:

```sql
select rolbypassrls from pg_roles where rolname = 'postgres';  -- expect true
```

## Dashboard settings

Unchanged from v1. These are not in SQL: set them by hand, once, or the
portal will not work.

**Authentication > Sign In / Providers > Email**

| Setting | Value | Why |
| --- | --- | --- |
| Enable Email provider | **ON** | Email and password is the only sign-in method. |
| Confirm email | **OFF** | Free-tier e-mail is limited to a handful per hour. With confirmation off, `signUp()` returns a session at once and the invited person goes straight into the portal. |
| Allow new users to sign up | **ON** | Required: the database trigger is what makes the portal invite-only. Turning this off would block invited people too. |
| Secure password change / Minimum password length | your preference | 8 or more recommended. |

**Authentication > URL Configuration**

| Field | Value |
| --- | --- |
| Site URL | `https://www.mercermedtech.com/admin/` |
| Redirect URLs | `https://www.mercermedtech.com/admin/**` |
| | `http://127.0.0.1:4321/admin/**` |
| | `http://localhost:4321/admin/**` |

The two localhost entries are for `npm run dev`. The site is hash-routed, so
`#/reset` and the other screens never need a server-side rewrite.

Nothing else needs changing. Do not enable an OAuth provider, do not add a
custom SMTP server unless password resets become a problem, and never put a
`service_role` key anywhere near this repository.

If `POST /rest/v1/rpc/ping` returns 404 straight after the migration,
PostgREST has not reloaded its schema cache yet: **Settings > API > Reload
schema cache**, or wait a minute.

## How invites work

1. Someone with `people.manage` opens **People** and creates an invitation:
   a role (any role except owner), an optional e-mail binding, an optional
   note, and an expiry that defaults to 14 days.
2. The portal shows a copyable link, `/admin/#/join/<token>`. Send it however
   is convenient. The system never sends e-mail.
3. The join screen calls `invite_preview(token)` to greet the invitee with
   the role's name and who invited them. Every invalid case (unknown,
   revoked, expired, already used, malformed) returns the same
   `{valid: false}` payload, so the endpoint cannot be used to probe for live
   tokens.
4. The invitee sets a password. `signUp()` carries the token in user
   metadata; the `auth.users` trigger checks it, creates the profile with the
   invitation's role, and marks the invitation used. A bad token means the
   signup fails and no auth user is created at all.
5. An invitation can be revoked (set `revoked_at`) or deleted at any time.

Existing accounts keep working: 0002 maps the old roles (owner to owner,
admin to administrator, member to member). A new owner invitation appears
only on a database with no active owner; the last statement of the migration
prints its token, and on the live project it prints nothing.

To retire someone, deactivate them in **People**. A person who has logged
hours cannot be deleted, because hours are a record.

Password reset is the one flow that uses Supabase's e-mail, redirecting to
`/admin/#/reset`. It is rare enough to stay inside the free-tier limit.

## The legacy tables

0002 keeps every v1 row. The nine v1 content tables are renamed:
`legacy_projects`, `legacy_project_members`, `legacy_tasks`,
`legacy_reports`, `legacy_partners`, `legacy_project_state`,
`legacy_project_docs`, `legacy_comments`, `legacy_activity`. They stay RLS
forced with no policies and no grants, and they are out of the realtime
publication, so nothing can read them through the API. The SQL Editor still
can.

Projects, tasks and the comments on tasks were carried into the v2 tables,
keeping their ids and dates. Reports, partners, project docs, the numbers and
the old activity feed were not; they have no place in v2.

When the owner is satisfied that nothing more is needed from them, run
`scripts/drop_legacy.sql` by hand. It drops the nine tables and nothing else,
and it cannot be undone, so take a backup first. It lives outside
`migrations/` so `db push` never runs it.

## Free-tier notes

- **E-mail** on the built-in SMTP is limited to a few messages an hour. That
  is why nothing here depends on e-mail: invitations travel as links and
  confirmation is off.
- **Projects pause after 7 days without API traffic.** The workflow at
  `.github/workflows/supabase-keepalive.yml` calls `/rest/v1/rpc/ping` twice
  a week. GitHub turns off scheduled workflows in a repository with no
  activity for 60 days, so if the project pauses anyway, check that first.
- **Realtime**: 200 concurrent connections and 2 million messages a month.
  The portal opens one channel per signed-in session.
- **Database**: 500 MB. Activity prunes itself to 3000 rows; hours are small
  rows; the inbox holds text only. Nothing here stores files.

## Rollback

There is no automatic way back to v1, and the app no longer speaks v1. If
0002 fails, it fails as a whole and the database is left as it was. Once it
has committed, the way back is a restore: the dashboard's daily backup
(**Database > Backups**) or a `supabase db dump` taken before the push.

The v1 data itself is never at risk: until `drop_legacy.sql` runs it is all
still in the `legacy_*` tables, readable from the SQL Editor.
