/**
 * Today: the screen for "what do I do next, and what did everyone else do".
 *
 *   My work                open tasks assigned to me, soonest first
 *   Due this week          any open task due in the next seven days (or late),
 *                          and the next report
 *   Team                   who is on the team, who has been around, how much
 *                          each has open and the last thing each changed
 *   Since you were here    what other people changed since your last visit
 *
 * Every section draws as soon as its own data lands (see `loadToday` in
 * queries.ts): nothing waits for everything, and there is never a whole-page
 * skeleton. No realtime channel here: the socket belongs to whichever project
 * is open, so this reads once and refreshes quietly when the tab comes back.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { displayName, resumeSession, useAuth } from '../lib/auth';
import { loadToday } from '../lib/queries';
import { href } from '../lib/router';
import { daysUntil, dueWording, formatDate, formatDateLong, formatMonth, relativeTime } from '../lib/format';
import { toAppError, type AppError } from '../lib/errors';
import { LOAD_DEADLINE_MS, SLOW_LOAD_MS } from '../lib/config';
import { withDeadline } from '../lib/deadline';
import { pickPrimary, useProjectList } from '../lib/projects';
import type { ActivityRow, Profile, Project, ProjectMember, Report, Task } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { SkeletonLines } from '../components/Skeleton';
import { SchemaNotice, SlowNotice } from '../components/SchemaNotice';
import { isMine } from '../components/tasks/shared';

const LIST_CAP = 7;
/** Seen in the last quarter of an hour counts as "around now". */
const AROUND_MS = 15 * 60 * 1000;
/** Coming back to the tab refreshes, but not more often than this. */
const REFRESH_GAP_MS = 60 * 1000;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const byDue = (a: { due: string | null }, b: { due: string | null }) =>
  (a.due ?? '9999-12-31').localeCompare(b.due ?? '9999-12-31');

/** One part of the screen: nothing yet, the rows, or what went wrong. */
type Part<T> = { rows: T[] | null; error: AppError | null };
const EMPTY_PART = { rows: null, error: null };

export function Home() {
  const auth = useAuth();
  const list = useProjectList();
  const [tasks, setTasks] = useState<Part<Task>>(EMPTY_PART);
  const [members, setMembers] = useState<Part<ProjectMember>>(EMPTY_PART);
  const [profiles, setProfiles] = useState<Part<Profile>>(EMPTY_PART);
  const [activity, setActivity] = useState<Part<ActivityRow>>(EMPTY_PART);
  const [reports, setReports] = useState<Part<Report>>(EMPTY_PART);
  const lastLoad = useRef(0);
  const [slow, setSlow] = useState(false);

  /*
   * Each part has the same ceiling a whole screen had before (12 s, after
   * which a stall becomes an error with Try again on it), and if anything is
   * still out after four seconds the screen says so instead of waiting in
   * silence. Parts that have landed stay on screen either way.
   */
  const load = useCallback(() => {
    lastLoad.current = Date.now();
    setSlow(false);
    const requests = loadToday();
    const land = <T,>(work: Promise<T[]>, set: (part: Part<T>) => void) =>
      withDeadline(work, LOAD_DEADLINE_MS).then(
        (rows) => set({ rows, error: null }),
        (error) => set({ rows: [], error: toAppError(error) })
      );
    void land(requests.tasks, setTasks);
    void land(requests.members, setMembers);
    void land(requests.profiles, setProfiles);
    void land(requests.activity, setActivity);
    void land(requests.reports, setReports);
  }, []);

  useEffect(() => {
    if (!auth.userId) return undefined;
    load();
    // Coming back to the tab refreshes in place: what is on screen stays
    // until the new rows replace it.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REFRESH_GAP_MS) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [auth.userId, load]);

  const waiting =
    tasks.rows === null ||
    members.rows === null ||
    profiles.rows === null ||
    activity.rows === null ||
    reports.rows === null;

  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const retry = async () => {
    await resumeSession('restore');
    load();
  };

  const me = auth.userId;
  const myName = displayName(auth);
  const projects = list.projects;
  const primary = pickPrimary(projects);
  const activeIds = new Set(projects.filter((project) => project.status === 'active').map((project) => project.id));
  const projectOf = (id: string): Project | null => projects.find((project) => project.id === id) ?? null;
  // A project's name on a row only helps when it is not the home project.
  const nameIfOther = (projectId: string) =>
    projectId !== primary?.id ? (projectOf(projectId)?.name ?? null) : null;
  const people: Record<string, Profile> = {};
  for (const profile of profiles.rows ?? []) people[profile.id] = profile;
  const nameOf = (id: string | null) =>
    id === me ? 'You' : (id && (people[id]?.full_name?.trim() || people[id]?.email)) || 'Someone';

  const openTasks = (tasks.rows ?? []).filter((task) => !projectOf(task.project_id) || activeIds.has(task.project_id));
  const mine = openTasks.filter((task) => isMine(task, me, myName)).sort(byDue);
  const week = openTasks
    .filter((task) => {
      const days = daysUntil(task.due);
      return days !== null && days <= 7;
    })
    .sort(byDue);
  const nextReports = (reports.rows ?? [])
    .filter((report) => activeIds.has(report.project_id) || !projectOf(report.project_id))
    .sort(byDue);
  const nextReport = nextReports[0] ?? null;

  const taskHref = (task: Task) => {
    const project = projectOf(task.project_id);
    return project ? href(`/p/${project.slug}/plan`, { task: task.id }) : href('/');
  };

  const firstError =
    tasks.error ?? members.error ?? profiles.error ?? activity.error ?? reports.error ?? list.error ?? null;

  /* ----------------------------------------------------------- the team --- */
  const teamIds = [
    ...new Set(
      (members.rows ?? [])
        .filter((member) => !primary || member.project_id === primary.id)
        .map((member) => member.user_id)
    ),
  ];
  const lastChangeBy = (id: string) => (activity.rows ?? []).find((row) => row.user_id === id) ?? null;
  const openFor = (id: string) => openTasks.filter((task) => task.assignee === id).length;

  /* --------------------------------------------------- since you were here --- */
  const since = auth.lastVisit;
  const others = (activity.rows ?? []).filter((row) => row.user_id !== me);
  const fresh = since ? others.filter((row) => row.created_at > since) : [];
  const changes = (fresh.length ? fresh : others).slice(0, 10);

  return (
    <div class="wb-page wb-today wb-home">
      <header class="wb-today-head">
        <h1 class="wb-page-title">
          {greeting()}
          {auth.profile?.full_name ? `, ${auth.profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p class="wb-mono-soft">{formatDateLong(new Date().toISOString().slice(0, 10))}</p>
      </header>

      {slow && waiting ? <SlowNotice what="Some of your work" /> : null}

      {firstError ? (
        <SchemaNotice
          error={firstError}
          action={
            firstError.missingSchema || firstError.permission ? null : (
              <Button variant="secondary" onClick={retry} data-wb-retry>
                Try again
              </Button>
            )
          }
        />
      ) : null}

      <div class="wb-today-grid">
        <section class="wb-today-section" data-section="mine">
          <header class="wb-today-section-head">
            <h2 class="wb-today-title">My work</h2>
            {tasks.rows ? <span class="wb-plan-count wb-mono">{mine.length}</span> : null}
          </header>
          {tasks.rows === null ? (
            <SkeletonLines count={4} />
          ) : mine.length ? (
            <>
              <ul class="wb-today-list">
                {mine.slice(0, LIST_CAP).map((task) => (
                  <TaskLine key={task.id} task={task} to={taskHref(task)} project={nameIfOther(task.project_id)} />
                ))}
              </ul>
              {mine.length > LIST_CAP && primary ? (
                <a class="wb-today-more" href={href(`/p/${primary.slug}/plan`, { mine: '1' })}>
                  See all {mine.length} in the Plan
                </a>
              ) : null}
            </>
          ) : (
            <p class="wb-today-empty" data-wb-filled>
              Nothing is assigned to you.{' '}
              {primary ? <a href={href(`/p/${primary.slug}/plan`, { unassigned: '1' })}>See what nobody has yet</a> : null}
            </p>
          )}
        </section>

        <section class="wb-today-section" data-section="week">
          <header class="wb-today-section-head">
            <h2 class="wb-today-title">Due this week</h2>
            {tasks.rows ? <span class="wb-plan-count wb-mono">{week.length + (nextReport ? 1 : 0)}</span> : null}
          </header>
          {tasks.rows === null && reports.rows === null ? (
            <SkeletonLines count={3} />
          ) : (
            <ul class="wb-today-list">
              {nextReport ? (
                <li>
                  <a
                    class={`wb-today-row is-report${(daysUntil(nextReport.due) ?? 99) < 0 ? ' is-late' : ''}`}
                    href={href(`/p/${projectOf(nextReport.project_id)?.slug ?? primary?.slug ?? ''}/reports`, {
                      report: nextReport.id,
                    })}
                    data-wb-filled
                  >
                    <span class="wb-today-row-title">
                      <span class="wb-pill wb-pill-accent">Report</span>
                      {nextReport.covers?.trim() || formatMonth(nextReport.period)}
                    </span>
                    <span class="wb-due">{nextReport.due ? dueWording(nextReport.due) : 'No due date'}</span>
                  </a>
                </li>
              ) : null}
              {tasks.rows === null ? (
                <li>
                  <SkeletonLines count={2} />
                </li>
              ) : (
                week.slice(0, LIST_CAP).map((task) => (
                  <TaskLine
                    key={task.id}
                    task={task}
                    to={taskHref(task)}
                    project={nameIfOther(task.project_id)}
                    who={task.assignee ? (people[task.assignee] ?? { id: task.assignee }) : null}
                  />
                ))
              )}
              {tasks.rows && !week.length && !nextReport ? (
                <li class="wb-today-empty" data-wb-filled>
                  Nothing is due in the next seven days.
                </li>
              ) : null}
            </ul>
          )}
        </section>

        <section class="wb-today-section" data-section="team">
          <header class="wb-today-section-head">
            <h2 class="wb-today-title">Team</h2>
            {primary ? <span class="wb-mono-soft">{primary.name}</span> : null}
          </header>
          {members.rows === null || profiles.rows === null ? (
            <SkeletonLines count={3} />
          ) : teamIds.length ? (
            <ul class="wb-team">
              {teamIds.map((id) => {
                const profile = people[id];
                const seen = profile?.last_seen_at ? Date.now() - new Date(profile.last_seen_at).getTime() : null;
                const around = id === me || (seen !== null && seen < AROUND_MS);
                const last = lastChangeBy(id);
                return (
                  <li class="wb-team-row" key={id} data-wb-filled>
                    <Avatar id={id} name={profile?.full_name} email={profile?.email} size={34} active={around} />
                    <div class="wb-team-body">
                      <p class="wb-team-name">
                        {id === me ? `${profile?.full_name?.trim() || 'You'} (you)` : profile?.full_name?.trim() || profile?.email || 'Member'}
                        <span class={`wb-team-presence${around ? ' is-here' : ''}`}>
                          {around ? 'Around now' : profile?.last_seen_at ? `Seen ${relativeTime(profile.last_seen_at)}` : 'Not seen yet'}
                        </span>
                      </p>
                      <p class="wb-team-meta wb-mono-soft">
                        {tasks.rows ? `${openFor(id)} open` : ''}
                        {last ? ` · last: ${last.summary}, ${relativeTime(last.created_at)}` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p class="wb-today-empty" data-wb-filled>
              Nobody else is on this project yet.
            </p>
          )}
        </section>

        <section class="wb-today-section" data-section="changes">
          <header class="wb-today-section-head">
            <h2 class="wb-today-title">{fresh.length ? 'Since you were here' : 'Recent changes'}</h2>
            {fresh.length ? <span class="wb-plan-count wb-mono">{fresh.length}</span> : null}
          </header>
          {activity.rows === null ? (
            <SkeletonLines count={4} />
          ) : changes.length ? (
            <ol class="wb-today-changes">
              {changes.map((row) => {
                const project = projectOf(row.project_id);
                const link =
                  project && row.entity_id
                    ? row.entity === 'task'
                      ? href(`/p/${project.slug}/plan`, { task: row.entity_id })
                      : row.entity === 'report'
                        ? href(`/p/${project.slug}/reports`, { report: row.entity_id })
                        : row.entity === 'partner'
                          ? href(`/p/${project.slug}/partners`, { partner: row.entity_id })
                          : null
                    : null;
                const profile = row.user_id ? people[row.user_id] : null;
                return (
                  <li class="wb-change" key={row.id} data-wb-filled>
                    <Avatar id={row.user_id} name={profile?.full_name} email={profile?.email} size={22} />
                    <span class="wb-change-text">
                      <span class="wb-change-who">{nameOf(row.user_id)}</span>{' '}
                      {link ? <a href={link}>{row.summary}</a> : row.summary}
                    </span>
                    <span class="wb-mono-soft wb-change-when">
                      {project && project.id !== primary?.id ? `${project.name} · ` : ''}
                      {relativeTime(row.created_at)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p class="wb-today-empty" data-wb-filled>
              Quiet so far. Changes other people make will show up here.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function TaskLine({
  task,
  to,
  project,
  who,
}: {
  task: Task;
  to: string;
  project?: string | null;
  /** Shown as a small face: who has it. */
  who?: Pick<Profile, 'id'> & Partial<Profile> | null;
}) {
  const days = daysUntil(task.due);
  const late = days !== null && days < 0;
  return (
    <li>
      <a class={`wb-today-row${late ? ' is-late' : ''}`} href={to} data-wb-filled>
        <span class="wb-today-row-title">
          <span class={`wb-status-dot is-${task.status}`} aria-hidden="true" />
          {task.title}
        </span>
        <span class="wb-today-row-meta">
          {task.pri === 'critical' ? <span class="wb-pri-word is-critical">Critical</span> : null}
          {task.status === 'blocked' ? <span class="wb-pri-word is-blocked">Blocked</span> : null}
          {who ? (
            <Avatar
              id={who.id}
              name={who.full_name}
              email={who.email}
              size={20}
              title={`Assigned to ${who.full_name?.trim() || who.email || 'a member'}`}
            />
          ) : null}
          {project ? <span class="wb-mono-soft">{project}</span> : null}
          {task.due ? (
            <span class={`wb-due${late ? ' is-late' : ''}`} title={formatDate(task.due)}>
              {dueWording(task.due)}
            </span>
          ) : null}
        </span>
      </a>
    </li>
  );
}
