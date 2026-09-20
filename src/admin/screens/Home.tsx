/**
 * The screen people leave open. Everything on it is a plain query: no realtime
 * channel, because the socket belongs to whichever project is open.
 */
import { useCallback, useEffect, useState } from 'preact/hooks';
import { displayName, touchLastSeen, useAuth } from '../lib/auth';
import { loadHome, type HomeData } from '../lib/queries';
import { href } from '../lib/router';
import { daysUntil, dueWording, formatDateLong, relativeTime } from '../lib/format';
import type { Task } from '../lib/types';
import { STATUS_LABEL } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { LinkButton } from '../components/Button';
import { SkeletonCards, SkeletonLines } from '../components/Skeleton';
import { ProjectCard } from './ProjectCard';
import { IconProjects, IconWarning } from '../components/Icons';
import { SchemaNotice } from '../components/SchemaNotice';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function bucketOf(task: Task): 'overdue' | 'week' | 'later' {
  const days = daysUntil(task.due);
  if (days === null) return 'later';
  if (days < 0) return 'overdue';
  if (days <= 7) return 'week';
  return 'later';
}

const BUCKET_LABEL = {
  overdue: 'Overdue',
  week: 'This week',
  later: 'Later',
} as const;

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
  const slugOf = (projectId: string) =>
    data?.projects.find((summary) => summary.project.id === projectId)?.project.slug ?? '';
  const nameOfProject = (projectId: string) =>
    data?.projects.find((summary) => summary.project.id === projectId)?.project.name ?? 'Project';

  const taskHref = (task: Task) =>
    href(`/p/${slugOf(task.project_id)}/${kindTab(task.project_id)}`, { task: task.id });

  const kindTab = (projectId: string) => {
    const project = data?.projects.find((summary) => summary.project.id === projectId)?.project;
    return project?.kind === 'grant' ? 'deliverables' : 'tasks';
  };

  const buckets: Array<'overdue' | 'week' | 'later'> = ['overdue', 'week', 'later'];

  return (
    <div class="wb-page">
      <header class="wb-page-head">
        <div>
          <h1 class="wb-page-title">
            {greeting()}
            {auth.profile?.full_name ? `, ${auth.profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p class="wb-page-sub wb-mono-soft">{formatDateLong(new Date().toISOString().slice(0, 10))}</p>
        </div>
      </header>

      {data?.error ? <SchemaNotice error={data.error} /> : null}

      <div class="wb-home-grid">
        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">My work</h2>
          </header>
          {loading ? (
            <SkeletonLines count={4} />
          ) : data?.mine.length ? (
            <div class="wb-home-buckets">
              {buckets.map((bucket) => {
                const rows = data.mine.filter((task) => bucketOf(task) === bucket);
                if (!rows.length) return null;
                return (
                  <div class="wb-home-bucket" key={bucket}>
                    <h3 class="wb-home-bucket-head">{BUCKET_LABEL[bucket]}</h3>
                    <ul class="wb-minilist">
                      {rows.map((task) => (
                        <li key={task.id}>
                          <a class="wb-minirow" href={taskHref(task)}>
                            <span class="wb-minirow-title">{task.title}</span>
                            <span class="wb-minirow-meta">
                              <span class="wb-mono-soft">{nameOfProject(task.project_id)}</span>
                              {task.due ? (
                                <span class={`wb-mono-soft${bucket === 'overdue' ? ' is-overdue' : ''}`}>
                                  {dueWording(task.due)}
                                </span>
                              ) : null}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Nothing assigned to you"
              body="Tasks assigned to you, in any project, land here."
            />
          )}
        </section>

        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">Needs attention</h2>
          </header>
          {loading ? (
            <SkeletonLines count={3} />
          ) : data?.attention.length ? (
            <ul class="wb-minilist">
              {data.attention.map((task) => (
                <li key={task.id}>
                  <a class="wb-minirow" href={taskHref(task)}>
                    <span class="wb-minirow-title">
                      {task.pri === 'critical' ? (
                        <span class="wb-inline-icon wb-tone-crit" aria-hidden="true">
                          <IconWarning size={14} />
                        </span>
                      ) : null}
                      {task.title}
                    </span>
                    <span class="wb-minirow-meta">
                      <span class="wb-mono-soft">{nameOfProject(task.project_id)}</span>
                      <Chip tone={task.status === 'blocked' ? 'warn' : 'quiet'}>
                        {STATUS_LABEL[task.status]}
                      </Chip>
                      {task.due ? <span class="wb-mono-soft">{dueWording(task.due)}</span> : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing urgent" body="Nothing is overdue, blocked or critical today." />
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
          <ol class="wb-feed">
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
                      {nameOfProject(row.project_id)} · {relativeTime(row.created_at)}
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
