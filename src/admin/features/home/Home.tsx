/**
 * Home: the greeting, then the six blocks of the plan (section 8).
 *
 * Left: My tasks, Due this week. Right: This week (my hours), Today on the
 * team, Recently. Everything is read straight from the workspace store. The
 * only request Home makes of its own is the time window for this week; my
 * strip, the week total and today's team entries are all cut from that one
 * window, so nothing loads beyond it.
 *
 * Without hours.view_all the database sends only my own entries, so "Today on
 * the team" says so instead of looking empty by mistake.
 */
import { useMemo } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { LinkButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { IconClock, IconPlus } from '../../components/Icons';
import { PageHeader } from '../../components/PageHeader';
import { ProjectMark } from '../../components/ProjectMark';
import { Skeleton } from '../../components/Skeleton';
import { StatusDot } from '../../components/StatusDot';
import { useAuth } from '../../lib/auth';
import { daysUntil, dueWording, firstName, formatDate, fullTime, plural, relativeTime } from '../../lib/format';
import { formatHours, formatHoursNumber, sumHours, todayKey, weekBounds, weekdayShort, weekStrip } from '../../lib/hours';
import { useCan } from '../../lib/perms';
import { href } from '../../lib/router';
import type { Profile, Project, Task, TimeEntry } from '../../lib/types';
import {
  nameOf,
  useActivity,
  useIsHere,
  useMyTasks,
  useProfiles,
  useProjects,
  useTasks,
  useTimeEntries,
} from '../../lib/workspace';

const MY_TASK_ROWS = 7;
const DUE_ROWS = 8;
const RECENT_ROWS = 10;

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The tone class for a due date: late is red, today and tomorrow are amber. */
function dueTone(due: string | null): string {
  const days = daysUntil(due);
  if (days === null) return '';
  if (days < 0) return 'is-overdue';
  if (days <= 1) return 'is-soon';
  return '';
}

export function Home() {
  const auth = useAuth();
  const me = auth.userId;
  const now = new Date();
  const first = firstName(auth.profile?.full_name);
  const greeting = `${greetingFor(now)}${first ? `, ${first}` : ''}.`;
  const canCreate = useCan('tasks.create');
  const projects = useProjects();
  const profiles = useProfiles();

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  return (
    <div class="wb-page hm-page">
      <PageHeader
        title={greeting}
        lead={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        actions={
          canCreate ? (
            <LinkButton href={href('/tasks', { new: 1 })} icon={<IconPlus />}>
              New task
            </LinkButton>
          ) : null
        }
      />
      <div class="wb-cols hm-cols">
        <div class="hm-col">
          <MyTasks projectById={projectById} />
          <DueThisWeek projectById={projectById} profileById={profileById} />
        </div>
        <div class="hm-col">
          <ThisWeek me={me} profileById={profileById} projectById={projectById} />
          <Recently profileById={profileById} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tasks -- */

function TaskLine({
  task,
  project,
  person,
}: {
  task: Task;
  project: Project | undefined;
  /** Pass `null` for "Unassigned"; leave undefined to show no assignee at all. */
  person?: Profile | null;
}) {
  const wording = dueWording(task.due);
  return (
    <li>
      <a class="hm-row" href={href('/tasks', { task: task.id })}>
        <span class="hm-row-main">
          <span class="hm-row-title">{task.title}</span>
          <span class="hm-row-meta">
            {project ? <ProjectMark project={project} /> : null}
            {wording ? <span class={dueTone(task.due)}>{wording}</span> : <span>No due date</span>}
            <StatusDot status={task.status} />
          </span>
        </span>
        {person !== undefined ? (
          person ? (
            <Avatar
              id={person.id}
              name={person.full_name}
              email={person.email}
              size={28}
              title={person.full_name || person.email || undefined}
            />
          ) : (
            <span class="hm-unassigned">Unassigned</span>
          )
        ) : null}
      </a>
    </li>
  );
}

function MyTasks({ projectById }: { projectById: Map<string, Project> }) {
  const tasks = useMyTasks();
  const shown = tasks.slice(0, MY_TASK_ROWS);
  return (
    <section class="wb-section" aria-labelledby="hm-my-tasks">
      <div class="wb-section-head">
        <h2 class="wb-section-title" id="hm-my-tasks">
          My tasks
        </h2>
        {tasks.length ? <span class="hm-count wb-mono">{tasks.length}</span> : null}
      </div>
      {shown.length ? (
        <>
          <ul class="wb-list">
            {shown.map((task) => (
              <TaskLine
                key={task.id}
                task={task}
                project={task.project_id ? projectById.get(task.project_id) : undefined}
              />
            ))}
          </ul>
          <p class="hm-more">
            <a href={href('/tasks', { scope: 'mine' })}>
              All my tasks{tasks.length > shown.length ? ` (${tasks.length})` : ''}
            </a>
          </p>
        </>
      ) : (
        <EmptyState
          quiet
          title="No tasks are assigned to you."
          body="Take one from the list, or make one."
          action={
            <LinkButton size="sm" href={href('/tasks', { scope: 'all' })}>
              See all tasks
            </LinkButton>
          }
        />
      )}
    </section>
  );
}

function DueThisWeek({
  projectById,
  profileById,
}: {
  projectById: Map<string, Project>;
  profileById: Map<string, Profile>;
}) {
  const tasks = useTasks();
  const due = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== 'done' && task.due && (daysUntil(task.due) ?? 99) <= 7)
        .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.sort - b.sort),
    [tasks]
  );
  const shown = due.slice(0, DUE_ROWS);
  return (
    <section class="wb-section" aria-labelledby="hm-due">
      <div class="wb-section-head">
        <h2 class="wb-section-title" id="hm-due">
          Due this week
        </h2>
        {due.length ? <span class="hm-count wb-mono">{due.length}</span> : null}
      </div>
      {shown.length ? (
        <>
          <ul class="wb-list">
            {shown.map((task) => (
              <TaskLine
                key={task.id}
                task={task}
                project={task.project_id ? projectById.get(task.project_id) : undefined}
                person={task.assignee_id ? (profileById.get(task.assignee_id) ?? null) : null}
              />
            ))}
          </ul>
          {due.length > shown.length ? (
            <p class="hm-more">
              <a href={href('/tasks', { scope: 'all' })}>
                {plural(due.length - shown.length, 'more task')} due, in Tasks
              </a>
            </p>
          ) : null}
        </>
      ) : (
        <EmptyState quiet title="Nothing is due in the next 7 days." body="Overdue work would show here too." />
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- week -- */

function ThisWeek({
  me,
  profileById,
  projectById,
}: {
  me: string | null;
  profileById: Map<string, Profile>;
  projectById: Map<string, Project>;
}) {
  const canLog = useCan('hours.log');
  const canViewAll = useCan('hours.view_all');
  const today = todayKey();
  const bounds = weekBounds(today);
  // One window for the whole right-hand column. Its key is its values, so a
  // new object each render still fetches once.
  const { entries, loading } = useTimeEntries({ from: bounds.from, to: bounds.to });

  const mine = useMemo(() => entries.filter((entry) => entry.user_id === me), [entries, me]);
  const strip = weekStrip(mine, bounds.from);
  const total = sumHours(mine);
  const todays = useMemo(() => entries.filter((entry) => entry.work_date === today), [entries, today]);

  return (
    <>
      <section class="wb-section" aria-labelledby="hm-week">
        <div class="wb-section-head">
          <h2 class="wb-section-title" id="hm-week">
            This week
          </h2>
          <span class="hm-range">
            {formatDate(bounds.from)} to {formatDate(bounds.to)}
          </span>
        </div>
        <div class="hm-week">
          <div class="hm-week-total">
            {loading ? (
              <Skeleton width={72} height={40} radius={6} />
            ) : (
              <span class="wb-numeral hm-week-number" aria-label={formatHours(total)}>
                {formatHoursNumber(total)}
              </span>
            )}
            <span class="hm-week-unit">hours logged by you</span>
          </div>
          <ol class="hm-strip" aria-label="Your hours by day">
            {bounds.days.map((day, index) => (
              <li
                key={day}
                class={`hm-strip-day${day === today ? ' is-today' : ''}`}
                aria-current={day === today ? 'date' : undefined}
              >
                <span class="hm-strip-name">{weekdayShort(day)}</span>
                <span class={`hm-strip-hours wb-mono${strip[index] ? '' : ' is-zero'}`}>
                  {loading ? '' : strip[index] ? formatHoursNumber(strip[index]!) : '0'}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {canLog ? (
          <div>
            <LinkButton variant="primary" href={href('/hours', { log: 1 })} icon={<IconClock />}>
              Log hours
            </LinkButton>
          </div>
        ) : null}
      </section>

      <TodayOnTheTeam
        entries={todays}
        loading={loading}
        canViewAll={canViewAll}
        profileById={profileById}
        projectById={projectById}
      />
    </>
  );
}

function Here({ userId }: { userId: string }) {
  const here = useIsHere(userId);
  if (!here) return null;
  return (
    <span class="hm-here">
      <span class="wb-here" aria-hidden="true" />
      <span class="hm-here-word">Here now</span>
    </span>
  );
}

function TodayOnTheTeam({
  entries,
  loading,
  canViewAll,
  profileById,
  projectById,
}: {
  entries: TimeEntry[];
  loading: boolean;
  canViewAll: boolean;
  profileById: Map<string, Profile>;
  projectById: Map<string, Project>;
}) {
  const people = useMemo(() => {
    const byPerson = new Map<string, TimeEntry[]>();
    for (const entry of entries) {
      const list = byPerson.get(entry.user_id) ?? [];
      list.push(entry);
      byPerson.set(entry.user_id, list);
    }
    return [...byPerson.entries()]
      .map(([id, list]) => ({
        id,
        name: nameOf(id),
        total: sumHours(list),
        list: list.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  return (
    <section class="wb-section" aria-labelledby="hm-team">
      <div class="wb-section-head">
        <h2 class="wb-section-title" id="hm-team">
          Today on the team
        </h2>
      </div>
      {loading ? (
        <div class="hm-skeleton" aria-hidden="true">
          <Skeleton width="100%" height={44} />
          <Skeleton width="100%" height={44} />
        </div>
      ) : people.length ? (
        <ul class="wb-list">
          {people.map((person) => {
            const profile = profileById.get(person.id);
            return (
              <li key={person.id} class="hm-person">
                <Avatar id={person.id} name={profile?.full_name} email={profile?.email} size={30} />
                <div class="hm-person-main">
                  <div class="hm-person-head">
                    <span class="hm-person-name">{person.name}</span>
                    <Here userId={person.id} />
                    <span class="hm-person-hours wb-mono">{formatHours(person.total)}</span>
                  </div>
                  <ul class="hm-entries">
                    {person.list.map((entry) => {
                      const project = entry.project_id ? projectById.get(entry.project_id) : undefined;
                      return (
                        <li key={entry.id}>
                          {project ? <span class="hm-entry-code">{project.code}</span> : null}
                          {entry.summary}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          quiet
          title="No hours are logged yet today."
          body={canViewAll ? undefined : 'You see your own hours here. Ask an administrator if you need the whole team.'}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------- recently -- */

function Recently({ profileById }: { profileById: Map<string, Profile> }) {
  const { rows } = useActivity();
  const recent = rows.slice(0, RECENT_ROWS);
  return (
    <section class="wb-section" aria-labelledby="hm-recent">
      <div class="wb-section-head">
        <h2 class="wb-section-title" id="hm-recent">
          Recently
        </h2>
      </div>
      {recent.length ? (
        <>
          <ul class="wb-list">
            {recent.map((row) => {
              const actor = row.actor_id ? profileById.get(row.actor_id) : undefined;
              const body = (
                <>
                  <Avatar id={row.actor_id} name={actor?.full_name} email={actor?.email} size={26} />
                  <span class="hm-recent-main">
                    <span class="hm-recent-text">
                      <strong>{nameOf(row.actor_id)}</strong> {row.summary}
                    </span>
                    <span class="hm-recent-time" title={fullTime(row.created_at)}>
                      {relativeTime(row.created_at)}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={row.id}>
                  {row.task_id ? (
                    <a class="hm-row hm-recent" href={href('/tasks', { task: row.task_id })}>
                      {body}
                    </a>
                  ) : (
                    <div class="hm-row hm-recent">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <p class="hm-more">
            <a href={href('/activity')}>See all activity</a>
          </p>
        </>
      ) : (
        <EmptyState quiet title="Nothing has happened yet." body="Changes to tasks and hours will show here." />
      )}
    </section>
  );
}
