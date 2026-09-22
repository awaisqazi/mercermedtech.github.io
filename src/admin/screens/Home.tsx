/**
 * The screen people leave open. Everything on it is a plain query: no realtime
 * channel, because the socket belongs to whichever project is open.
 *
 * It is a reading surface, so it is built to be scanned rather than studied:
 * one bright thing per row (the title), everything else a step quieter, and
 * the only colour is the semantic one — a left edge and a dot for work that is
 * late or stuck.
 */
import { useCallback, useEffect, useState } from 'preact/hooks';
import { displayName, touchLastSeen, useAuth } from '../lib/auth';
import { loadHome, type HomeData, type HomeStats } from '../lib/queries';
import { href } from '../lib/router';
import { daysUntil, dueWording, formatDateLong, relativeTime } from '../lib/format';
import type { Task } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { LinkButton } from '../components/Button';
import { SkeletonCards, SkeletonLines } from '../components/Skeleton';
import { ProjectCard } from './ProjectCard';
import { IconProjects } from '../components/Icons';
import { SchemaNotice } from '../components/SchemaNotice';

/** How many rows a list shows before it hands over to the project screen. */
const LIST_CAP = 8;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Soonest first; anything without a date sits at the end. */
function byDue(a: Task, b: Task): number {
  return (a.due ?? '9999-12-31').localeCompare(b.due ?? '9999-12-31');
}

/** The one thing worth saying about a task's state, or nothing at all. */
function flagOf(task: Task): { label: string; tone: 'crit' | 'warn' } | null {
  if (task.status === 'blocked') return { label: 'Blocked', tone: 'warn' };
  if (task.pri === 'critical') return { label: 'Critical', tone: 'crit' };
  return null;
}

interface RowProps {
  task: Task;
  to: string;
  /** Only worth repeating when the reader has more than one project open. */
  project: string | null;
}

/**
 * Two lines, never more: the title owns a full-width line of its own, and
 * everything that used to fight it for space sits underneath in small type.
 */
function TaskRow({ task, to, project }: RowProps) {
  const days = daysUntil(task.due);
  const late = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 3;
  const flag = flagOf(task);

  return (
    <li>
      <a class={`wb-home-row${late ? ' is-late' : soon ? ' is-soon' : ''}`} href={to}>
        <span class="wb-home-row-title">{task.title}</span>
        <span class="wb-home-row-meta">
          {flag ? (
            <span class={`wb-home-flag is-${flag.tone}`}>
              <span class="wb-home-flag-dot" aria-hidden="true" />
              {flag.label}
            </span>
          ) : null}
          {task.due ? (
            <span class={`wb-mono wb-home-row-due${late ? ' is-late' : ''}`}>
              {dueWording(task.due)}
            </span>
          ) : null}
          {project ? <span class="wb-home-row-project">{project}</span> : null}
        </span>
      </a>
    </li>
  );
}

export function Home() {
  const auth = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await loadHome(auth.userId, displayName(auth));
    setData(result);
    setLoading(false);
  }, [auth.userId, auth.profile?.full_name]);

  useEffect(() => {
    void refresh();
    void touchLastSeen();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const projects = (data?.projects ?? []).filter(
    (summary) => summary.project.status === 'active'
  );
  const projectOf = (projectId: string) =>
    data?.projects.find((summary) => summary.project.id === projectId)?.project ?? null;

  const kindTab = (projectId: string) =>
    projectOf(projectId)?.kind === 'grant' ? 'deliverables' : 'tasks';

  const taskHref = (task: Task) =>
    href(`/p/${projectOf(task.project_id)?.slug ?? ''}/${kindTab(task.project_id)}`, {
      task: task.id,
    });

  /* With one project open its name on every row is noise, so it is dropped. */
  const manyProjects = projects.length > 1;
  const nameFor = (task: Task) =>
    manyProjects ? projectOf(task.project_id)?.name ?? 'Project' : null;

  const mine = [...(data?.mine ?? [])].sort(byDue);
  const attention = data?.attention ?? [];

  /** "See all 14 in <project>" when the rest all live in the same place. */
  const seeAll = (tasks: Task[]) => {
    if (tasks.length <= LIST_CAP) return null;
    const ids = [...new Set(tasks.map((task) => task.project_id))];
    if (ids.length === 1) {
      const project = projectOf(ids[0]!);
      if (project) {
        return (
          <a class="wb-home-more" href={href(`/p/${project.slug}/${kindTab(ids[0]!)}`)}>
            See all {tasks.length} in {project.name}
          </a>
        );
      }
    }
    return (
      <a class="wb-home-more" href={href('/projects')}>
        See all {tasks.length}
      </a>
    );
  };

  const list = (tasks: Task[]) => (
    <>
      <ul class="wb-home-list">
        {tasks.slice(0, LIST_CAP).map((task) => (
          <TaskRow key={task.id} task={task} to={taskHref(task)} project={nameFor(task)} />
        ))}
      </ul>
      {seeAll(tasks)}
    </>
  );

  return (
    <div class="wb-page wb-home">
      <header class="wb-home-head">
        <div class="wb-home-greeting">
          <h1 class="wb-home-title">
            {greeting()}
            {auth.profile?.full_name ? `, ${auth.profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p class="wb-home-date wb-mono-soft">
            {formatDateLong(new Date().toISOString().slice(0, 10))}
          </p>
        </div>
        {loading ? null : <StatStrip stats={data?.stats ?? null} />}
      </header>

      {data?.error ? <SchemaNotice error={data.error} /> : null}

      <div class="wb-home-grid">
        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">My work</h2>
            {mine.length ? <Chip tone="quiet">{mine.length}</Chip> : null}
          </header>
          {loading ? (
            <SkeletonLines count={4} />
          ) : mine.length ? (
            list(mine)
          ) : (
            <EmptyState title="Nothing assigned to you yet." />
          )}
        </section>

        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">Needs attention</h2>
            {attention.length ? <Chip tone="quiet">{attention.length}</Chip> : null}
          </header>
          {loading ? (
            <SkeletonLines count={3} />
          ) : attention.length ? (
            list(attention)
          ) : (
            <EmptyState title="Nothing overdue, blocked or stuck." />
          )}
        </section>
      </div>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Projects</h2>
          <LinkButton variant="quiet" size="sm" href={href('/projects')}>
            See all
          </LinkButton>
        </header>
        {loading ? (
          <SkeletonCards count={2} />
        ) : projects.length ? (
          <div class="wb-card-grid">
            {projects.slice(0, 6).map((summary) => (
              <ProjectCard
                key={summary.project.id}
                summary={summary}
                profiles={data?.profiles ?? {}}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconProjects size={22} />}
            title="No projects yet"
            body="Once you are added to a project it will show up here."
          />
        )}
      </section>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Recent activity</h2>
        </header>
        {loading ? (
          <SkeletonLines count={5} />
        ) : data?.activity.length ? (
          <ol class="wb-feed wb-home-feed">
            {data.activity.map((row) => {
              const profile = row.user_id ? data.profiles[row.user_id] : null;
              return (
                <li class="wb-feed-row" key={row.id}>
                  <Avatar id={row.user_id} name={profile?.full_name} email={profile?.email} size={26} />
                  <div class="wb-feed-body">
                    <p class="wb-feed-line">
                      <span class="wb-feed-who">
                        {profile?.full_name?.trim() || profile?.email || 'Someone'}
                      </span>{' '}
                      <span class="wb-feed-what">{row.summary}</span>
                    </p>
                    <p class="wb-feed-meta wb-mono-soft">
                      {projectOf(row.project_id)?.name ?? 'Project'} · {relativeTime(row.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState title="Quiet so far" body="Changes people make will show up here." />
        )}
      </section>
    </div>
  );
}

/** "12 open · 3 due this week · 1 overdue", to the right of the greeting. */
function StatStrip({ stats }: { stats: HomeStats | null }) {
  if (!stats || !stats.open) return null;
  return (
    <ul class="wb-home-stats">
      <li>
        <span class="wb-mono wb-home-stat-n">{stats.open}</span> open
      </li>
      <li>
        <span class="wb-mono wb-home-stat-n">{stats.dueWeek}</span> due this week
      </li>
      <li class={stats.overdue ? 'is-late' : undefined}>
        <span class="wb-mono wb-home-stat-n">{stats.overdue}</span> overdue
      </li>
    </ul>
  );
}
