/**
 * My week: seven days, each with its entries and a total, the week total in
 * Fraunces inside the bracket, and the one primary button on the screen.
 *
 * Address: #/hours?week=YYYY-MM-DD (the Monday) &log=1 &date=YYYY-MM-DD &entry=<id>
 */
import { useEffect, useMemo } from 'preact/hooks';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { IconChevron, IconLock, IconPlus } from '../../components/Icons';
import { PageHeader, PhoneAction } from '../../components/PageHeader';
import { ProjectMark } from '../../components/ProjectMark';
import { SkeletonLines } from '../../components/Skeleton';
import { useAuth } from '../../lib/auth';
import {
  addDays,
  formatHoursNumber,
  sumHours,
  todayKey,
  totalsByDay,
  weekBounds,
  weekLabel,
  weekStart,
} from '../../lib/hours';
import { parseLocalDate } from '../../lib/format';
import { patchQuery, useRoute } from '../../lib/router';
import type { TimeEntry } from '../../lib/types';
import { refetch, useClosedMonths, useProjects, useTasks, useTimeEntries, useWorkspaceSlice } from '../../lib/workspace';
import { HoursTabs } from './HoursTabs';
import { LogDialog } from './LogDialog';
import { closedSet, dayWording, isClosedEntry, readDate, readWeek } from './shared';

export function MyWeek() {
  const route = useRoute();
  const me = useAuth().userId ?? undefined;
  const thisWeek = weekStart(todayKey());
  const from = readWeek(route.query.week) ?? thisWeek;
  const bounds = useMemo(() => weekBounds(from), [from]);
  const isThisWeek = bounds.from === thisWeek;
  const today = todayKey();

  const { entries, loading, error } = useTimeEntries({ from: bounds.from, to: bounds.to, userId: me });
  const projects = useProjects();
  const tasks = useTasks();
  const closed = closedSet(useClosedMonths());

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const byDay = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const day of bounds.days) map.set(day, []);
    for (const entry of entries) map.get(entry.work_date)?.push(entry);
    for (const list of map.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return map;
  }, [entries, bounds]);
  const dayTotals = totalsByDay(entries);
  const total = sumHours(entries);

  // The dialog: ?log=1 for a new entry, ?entry=<id> to edit one.
  const logging = route.query.log === '1';
  const editingId = route.query.entry || null;
  const editing = useWorkspaceSlice(
    (state) => (editingId ? (state.time_entries.find((row) => row.id === editingId) ?? null) : null),
    [editingId]
  );
  const editable = editing && !isClosedEntry(editing, closed) ? editing : null;

  // An address pointing at an entry that is gone or locked just closes.
  useEffect(() => {
    if (editingId && !loading && !editable) patchQuery({ entry: null }, { replace: true });
  }, [editingId, loading, editable]);

  const initialDate = readDate(route.query.date) ?? today;
  const dialogOpen = logging || Boolean(editable);

  const goToWeek = (monday: string | null) => patchQuery({ week: monday }, { replace: true });
  const openLog = (date?: string) => patchQuery({ log: 1, entry: null, date: date ?? null });
  const closeDialog = () => patchQuery({ log: null, entry: null, date: null });
  const afterSave = (date: string) => {
    const savedWeek = weekStart(date);
    if (savedWeek !== bounds.from) patchQuery({ week: savedWeek === thisWeek ? null : savedWeek }, { replace: true });
  };

  const empty = !loading && !error && entries.length === 0;

  return (
    <div class="wb-page hours-page">
      <PageHeader
        title="Hours"
        lead="What you worked on, week by week."
        actions={
          <Button variant="primary" class="hours-log-button" icon={<IconPlus size={16} />} onClick={() => openLog()}>
            Log hours
          </Button>
        }
      />
      <PhoneAction label="Log hours" icon={<IconPlus size={18} />} onClick={() => openLog()} />
      <HoursTabs active="week" />

      <div class="hours-week-head">
        <div class="hours-switcher" role="group" aria-label="Choose a week">
          <Button
            variant="secondary"
            iconOnly
            aria-label="Previous week"
            icon={<IconChevron size={16} class="wb-flip" />}
            onClick={() => goToWeek(addDays(bounds.from, -7))}
          />
          <Button variant="secondary" disabled={isThisWeek} onClick={() => goToWeek(null)}>
            This week
          </Button>
          <Button
            variant="secondary"
            iconOnly
            aria-label="Next week"
            icon={<IconChevron size={16} />}
            onClick={() => goToWeek(addDays(bounds.from, 7))}
          />
          <p class="hours-week-label" aria-live="polite">
            {weekLabel(bounds.from)}
            {parseLocalDate(bounds.from)?.getFullYear() !== new Date().getFullYear() ? `, ${bounds.from.slice(0, 4)}` : ''}
          </p>
        </div>

        <section class="wb-bracket hours-total" aria-label="Week total">
          <p class="hours-total-line">
            <span class="wb-numeral hours-total-number">{loading ? '0' : formatHoursNumber(total)}</span>
            <span class="hours-total-unit">hours</span>
          </p>
          <p class="wb-meta">{isThisWeek ? 'this week' : 'that week'}</p>
        </section>
      </div>

      {error ? (
        <EmptyState
          tone="bad"
          quiet
          title="Your hours did not load."
          body={error.message}
          action={
            <Button onClick={() => void refetch()}>Try again</Button>
          }
        />
      ) : loading ? (
        <SkeletonLines count={5} />
      ) : (
        <>
          {empty ? (
            <EmptyState
              quiet
              title={isThisWeek ? 'Nothing logged this week yet.' : 'Nothing logged in this week.'}
              body="Log what you worked on and it shows up on its day."
            />
          ) : null}
          <ol class="hours-days">
            {bounds.days.map((day) => {
              const list = byDay.get(day) ?? [];
              const dayTotal = dayTotals[day] ?? 0;
              const isToday = day === today;
              const dayClosed = closed.has(day.slice(0, 7));
              const wording = dayWording(day);
              return (
                <li key={day} class={`hours-day${isToday ? ' is-today' : ''}`}>
                  <header class="hours-day-head">
                    <h2 class="hours-day-name">
                      <span class="hours-day-weekday">{wording.split(',')[0]}</span>
                      <span class="hours-day-date">{wording.split(', ')[1]}</span>
                      {isToday ? <span class="hours-day-today">Today</span> : null}
                    </h2>
                    <p class={`hours-day-total wb-num-col${dayTotal ? '' : ' is-zero'}`}>
                      <span class="wb-sr">Day total </span>
                      {dayTotal ? `${formatHoursNumber(dayTotal)} h` : 'None'}
                    </p>
                  </header>
                  {list.length ? (
                    <ul class="hours-entries">
                      {list.map((entry) => (
                        <li key={entry.id}>
                          <EntryItem
                            entry={entry}
                            locked={isClosedEntry(entry, closed)}
                            project={entry.project_id ? projectMap.get(entry.project_id) : undefined}
                            taskTitle={entry.task_id ? taskMap.get(entry.task_id)?.title : undefined}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!dayClosed ? (
                    <button
                      type="button"
                      class="hours-day-add"
                      aria-label={`Log hours for ${wording}`}
                      onClick={() => openLog(day)}
                    >
                      <IconPlus size={14} />
                      <span>Add</span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {dialogOpen ? (
        <LogDialog
          key={editable?.id ?? `new-${initialDate}`}
          entry={editable}
          initialDate={initialDate}
          onClose={closeDialog}
          onSaved={afterSave}
        />
      ) : null}
    </div>
  );
}

function EntryItem({
  entry,
  locked,
  project,
  taskTitle,
}: {
  entry: TimeEntry;
  locked: boolean;
  project: Parameters<typeof ProjectMark>[0]['project'];
  taskTitle?: string;
}) {
  const body = (
    <>
      <span class="hours-entry-hours wb-num-col">{formatHoursNumber(entry.hours)} h</span>
      <span class="hours-entry-body">
        {project || taskTitle || locked ? (
          <span class="hours-entry-meta">
            {project ? <ProjectMark project={project} /> : null}
            {taskTitle ? <span class="hours-entry-task">{taskTitle}</span> : null}
            {locked ? (
              <span class="hours-entry-closed">
                <IconLock size={12} />
                Closed
              </span>
            ) : null}
          </span>
        ) : null}
        <span class="hours-entry-summary">{entry.summary}</span>
      </span>
    </>
  );

  if (locked) {
    return (
      <div class="hours-entry is-closed" title="This month is closed, so the entry cannot be changed.">
        {body}
      </div>
    );
  }
  return (
    <button type="button" class="hours-entry" onClick={() => patchQuery({ entry: entry.id, log: null })}>
      {body}
    </button>
  );
}
