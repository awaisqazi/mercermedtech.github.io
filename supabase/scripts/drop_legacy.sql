-- =============================================================================
-- MMT Workbench: drop the v1 legacy tables
-- =============================================================================
-- When to run it: once the owner has checked that the v2 workspace has
-- everything they need from v1 (projects, tasks and task comments were
-- carried over by 0002_workspace.sql; reports, partners, project docs, the
-- numbers and the old activity feed were not). Take a backup first if there
-- is any doubt: Database, Backups in the dashboard, or `supabase db dump`.
--
-- This file lives outside migrations/ on purpose, so `supabase db push`
-- never runs it. Run it by hand in the SQL Editor, or with
-- `supabase db query --linked -f supabase/scripts/drop_legacy.sql`.
--
-- It drops the nine legacy_* tables and nothing else. Nothing in v2 refers to
-- them, so no other object goes with them. It cannot be undone.
-- =============================================================================

begin;

drop table if exists public.legacy_activity;
drop table if exists public.legacy_comments;
drop table if exists public.legacy_project_docs;
drop table if exists public.legacy_project_state;
drop table if exists public.legacy_partners;
drop table if exists public.legacy_reports;
drop table if exists public.legacy_tasks;
drop table if exists public.legacy_project_members;
drop table if exists public.legacy_projects;

commit;
