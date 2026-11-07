/**
 * One person (#/people/<id>): who they are, their open tasks, and their
 * recent hours. The hours block is there only for yourself or for someone
 * with hours.view_all; for everyone else it is left out, not greyed out
 * (the database would send back nothing anyway).
 */
import { useMemo } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { LinkButton } from '../../components/Button';
import { IconArrowLeft } from '../../components/Icons';
import { PageHeader } from '../../components/PageHeader';
import { ProjectMark } from '../../components/ProjectMark';
import { Skeleton } from '../../components/Skeleton';
import { Chip } from '../../components/Chip';
import { useAuth } from '../../lib/auth';
import { dueWording, formatDate, isOverdue } from '../../lib/format';
import { addDays, formatHours, sumHours, todayKey } from '../../lib/hours';
import { useCan } from '../../lib/perms';
import { href } from '../../lib/router';
import { STATUS_LABEL } from '../../lib/types';
import {
  byDue,
  useProfile,
  useProjects,
  useRole,
  useTasks,
  useTimeEntries,
  useWorkspace,
} from '../../lib/workspace';
import { Presence, displayName } from './shared';

const TASKS_SHOWN = 8;
const HOURS_DAYS = 14;

export function Person({ id }: { id: string }) {
  const workspace = useWorkspace();
  const person = useProfile(id);
  const role = useRole(person?.role_id);
  const auth = useAuth();
  const canViewAll = useCan('hours.view_all');
  const projects = useProjects();
  const allTasks = useTasks();

  const open = useMemo(
    () => allTasks.filter((task) => task.assignee_id === id && task.status !== 'done').sort(byDue),
    [allTasks, id]
  );

  if (!person) {
    if (workspace.status === 'loading' || workspace.status === 'idle') {
      return (
        <div class="wb-page wb-person-page" aria-busy="true">
          <Skeleton width="40%" height={36} />
          <Skeleton height={120} radius={12} />
        </div>
      );
    }
    return (
      <div class="wb-page wb-person-page">
        <PageHeader title="Person" />
        <EmptyState
          title="We could not find that person"
          body="The link may be out of date."
          action={
            <LinkButton href={href('/people')} icon={<IconArrowLeft size={16} />}>
              All people
            </LinkButton>
          }
        />
      </div>
    );
  }

  const name = displayName(person);
  const showHours = person.id === auth.userId || canViewAll;
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const shown = open.slice(0, TASKS_SHOWN);

  return (
    <div class="wb-page wb-person-page">
      <PageHeader
        title={name}
        lead={person.title || undefined}
        actions={
          <LinkButton href={href('/people')} variant="quiet" icon={<IconArrowLeft size={16} />}>
            All people
          </LinkButton>
        }
      />

      <div class="wb-cols">
        <section class="wb-section" aria-labelledby="wb-person-open-title">
          <div class="wb-section-head">
            <h2 class="wb-section-title" id="wb-person-open-title">
              Open tasks
            </h2>
            <span class="wb-mono wb-meta">{open.length}</span>
          </div>
          {open.length === 0 ? (
            <p class="wb-meta">{person.id === auth.userId ? 'You have' : `${name} has`} no open tasks.</p>
          ) : (
            <>
              <ul class="wb-list">
                {shown.map((task) => {
                  const project = task.project_id ? projectById.get(task.project_id) : null;
                  const late = isOverdue(task.due);
                  return (
                    <li key={task.id}>
                      <a class="wb-row" href={href('/tasks', { task: task.id })}>
                        <span class="wb-row-main">
                          <span class="wb-row-title">{task.title}</span>
                          <span class="wb-row-meta">
                            {project ? <ProjectMark project={project} /> : null}
                            <span>{STATUS_LABEL[task.status]}</span>
                            {task.due ? <span class={late ? 'wb-person-late' : ''}>{dueWording(task.due)}</span> : null}
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <p class="wb-person-more">
                <a href={href('/tasks', { person: person.id })}>
                  {open.length > shown.length ? `See all ${open.length} of their tasks` : 'Open in Tasks'}
                </a>
              </p>
            </>
          )}
        </section>

        <div class="wb-person-side-col">
          <section class="wb-section" aria-labelledby="wb-person-about-title">
            <div class="wb-section-head">
              <h2 class="wb-section-title" id="wb-person-about-title">
                About
              </h2>
            </div>
            <div class="wb-person-head">
              <Avatar id={person.id} name={person.full_name} email={person.email} size={56} />
              {person.active ? null : <Chip tone="quiet">Deactivated</Chip>}
            </div>
            <dl class="wb-facts">
              <div>
                <dt>Role</dt>
                <dd>{role?.name ?? 'No role'}</dd>
              </div>
              <div>
                <dt>Presence</dt>
                <dd>{person.active ? <Presence person={person} /> : 'Deactivated'}</dd>
              </div>
              {person.email ? (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${person.email}`}>{person.email}</a>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Joined</dt>
                <dd>{formatDate(person.created_at.slice(0, 10))}</dd>
              </div>
            </dl>
          </section>

          {showHours ? <RecentHours userId={person.id} projects={projects} name={name} mine={person.id === auth.userId} /> : null}
        </div>
      </div>
    </div>
  );
}

/** Their entries over the last two weeks, newest first. */
function RecentHours({
  userId,
  projects,
  name,
  mine,
}: {
  userId: string;
  projects: ReturnType<typeof useProjects>;
  name: string;
  mine: boolean;
}) {
  const to = todayKey();
  const from = addDays(to, -(HOURS_DAYS - 1));
  const { entries, loading, error } = useTimeEntries({ from, to, userId });
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.work_date.localeCompare(a.work_date) || b.created_at.localeCompare(a.created_at)),
    [entries]
  );
  const byId = new Map(projects.map((project) => [project.id, project]));

  return (
    <section class="wb-section" aria-labelledby="wb-person-hours-title">
      <div class="wb-section-head">
        <h2 class="wb-section-title" id="wb-person-hours-title">
          Hours, last {HOURS_DAYS} days
        </h2>
        {loading ? null : <span class="wb-numeral wb-person-total">{formatHours(sumHours(sorted))}</span>}
      </div>
      {error ? (
        <p class="wb-meta">The hours did not load. {error.message}</p>
      ) : loading ? (
        <Skeleton height={44} radius={8} />
      ) : sorted.length === 0 ? (
        <p class="wb-meta">{mine ? 'You have' : `${name} has`} not logged any hours in this time.</p>
      ) : (
        <ul class="wb-list">
          {sorted.map((entry) => {
            const project = entry.project_id ? byId.get(entry.project_id) : null;
            return (
              <li class="wb-person-entry" key={entry.id}>
                <span class="wb-person-entry-date wb-mono">{formatDate(entry.work_date)}</span>
                <span class="wb-person-entry-body">
                  <span>{entry.summary}</span>
                  {project ? <ProjectMark project={project} /> : null}
                </span>
                <span class="wb-person-entry-hours wb-mono">{formatHours(entry.hours)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
