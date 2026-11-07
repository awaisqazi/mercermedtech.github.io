/**
 * Team hours: everyone's entries for one month. Needs `hours.view_all`;
 * without it the tab says whom to ask instead of vanishing.
 *
 * Address: #/hours/team?month=YYYY-MM &person=<id> &project=<id|none>
 */
import { useMemo, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { IconChevron, IconDownload, IconLock } from '../../components/Icons';
import { PageHeader } from '../../components/PageHeader';
import { PersonPicker } from '../../components/PersonPicker';
import { ProjectMark } from '../../components/ProjectMark';
import { Select } from '../../components/Select';
import { SkeletonLines } from '../../components/Skeleton';
import { formatDate, parseLocalDate, plural } from '../../lib/format';
import {
  NO_PROJECT,
  addDays,
  addMonths,
  buildHoursCsv,
  csvFilename,
  downloadText,
  formatHoursNumber,
  monthBounds,
  monthKey,
  monthLabel,
  sumHours,
  totalsByPersonWeek,
  totalsByProject,
  weeksOfMonth,
} from '../../lib/hours';
import { toast } from '../../lib/toasts';
import { useCan } from '../../lib/perms';
import { patchQuery, useRoute } from '../../lib/router';
import type { Profile, Project, TimeEntry } from '../../lib/types';
import {
  deleteEntry,
  nameOf,
  refetch,
  useMonthClosed,
  useProfiles,
  useProjects,
  useTasks,
  useTimeEntries,
} from '../../lib/workspace';
import { HoursTabs } from './HoursTabs';
import { LogDialog } from './LogDialog';
import { MonthClose } from './MonthClose';
import { dayWording, dayWordingLong, readMonth } from './shared';

export function TeamHours() {
  const allowed = useCan('hours.view_all');
  if (!allowed) {
    return (
      <div class="wb-page hours-page">
        <PageHeader title="Team hours" />
        <HoursTabs active="team" />
        <EmptyState quiet title="Ask an administrator for access to the team's hours." />
      </div>
    );
  }
  return <TeamMonth />;
}

function TeamMonth() {
  const route = useRoute();
  const canExport = useCan('hours.export');
  const canEditAny = useCan('hours.edit_any');
  const thisMonth = monthKey(new Date());
  const month = readMonth(route.query.month) ?? thisMonth;
  const bounds = useMemo(() => monthBounds(month), [month]);
  const weeks = useMemo(() => weeksOfMonth(month), [month]);

  const personFilter = route.query.person || null;
  const projectFilter = route.query.project || '';

  const profiles = useProfiles();
  const projects = useProjects();
  const tasks = useTasks();
  const closedRow = useMonthClosed(bounds.from);
  const { entries, loading, error } = useTimeEntries({ from: bounds.from, to: bounds.to });

  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const canChange = canEditAny && !closedRow;

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteEntry(deleting.id);
    setBusy(false);
    if (!result.ok) return;
    toast.good('Entry deleted.');
    setDeleting(null);
  };

  const projectMap = useMemo(() => new Map<string, Project>(projects.map((p) => [p.id, p])), [projects]);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const profileMap = useMemo(() => new Map<string, Profile>(profiles.map((p) => [p.id, p])), [profiles]);

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        if (personFilter && entry.user_id !== personFilter) return false;
        if (projectFilter === NO_PROJECT) return !entry.project_id;
        if (projectFilter && entry.project_id !== projectFilter) return false;
        return true;
      }),
    [entries, personFilter, projectFilter]
  );

  const grid = useMemo(() => totalsByPersonWeek(filtered), [filtered]);
  const byPerson = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.user_id) ?? [];
      list.push(entry);
      map.set(entry.user_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.work_date.localeCompare(b.work_date) || a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [filtered]);

  const personName = (id: string) => profileMap.get(id)?.full_name || profileMap.get(id)?.email || nameOf(id);
  const rows = useMemo(
    () => [...byPerson.keys()].sort((a, b) => personName(a).localeCompare(personName(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byPerson, profileMap]
  );

  const total = sumHours(filtered);
  const weekTotals = weeks.map((week) => sumHours(rows.map((id) => ({ hours: grid[id]?.[week] ?? 0 }))));
  const projectTotals = useMemo(() => totalsByProject(filtered), [filtered]);
  const projectRows = useMemo(
    () => Object.entries(projectTotals).sort((a, b) => b[1] - a[1]),
    [projectTotals]
  );

  // People you can pick: anyone active, plus anyone with hours this month.
  const pickable = useMemo(() => {
    const withHours = new Set(entries.map((entry) => entry.user_id));
    return profiles.filter((person) => person.active || withHours.has(person.id));
  }, [profiles, entries]);

  const patch = (values: Record<string, string | null>) => patchQuery(values, { replace: true });
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const download = () => {
    const suffixParts: string[] = [];
    if (personFilter) suffixParts.push(personName(personFilter));
    if (projectFilter === NO_PROJECT) suffixParts.push('no project');
    else if (projectFilter) suffixParts.push(projectMap.get(projectFilter)?.code ?? '');
    const csv = buildHoursCsv(filtered, { profiles, projects, tasks });
    downloadText(csvFilename(month, suffixParts.filter(Boolean).join(' ') || undefined), csv);
  };

  const filtering = Boolean(personFilter || projectFilter);

  return (
    <div class="wb-page hours-page">
      <PageHeader
        title="Team hours"
        lead="Everyone's hours for the month."
        actions={
          <>
            {canExport ? (
              <Button icon={<IconDownload size={16} />} disabled={!filtered.length} onClick={download}>
                Download CSV
              </Button>
            ) : null}
            <MonthClose month={month} closedRow={closedRow} />
          </>
        }
      />
      <HoursTabs active="team" />

      <div class="hours-month-head">
        <div class="hours-switcher" role="group" aria-label="Choose a month">
          <Button
            variant="secondary"
            iconOnly
            aria-label="Previous month"
            icon={<IconChevron size={16} class="wb-flip" />}
            onClick={() => patch({ month: addMonths(month, -1) })}
          />
          <Button variant="secondary" disabled={month === thisMonth} onClick={() => patch({ month: null })}>
            This month
          </Button>
          <Button
            variant="secondary"
            iconOnly
            aria-label="Next month"
            icon={<IconChevron size={16} />}
            onClick={() => patch({ month: addMonths(month, 1) })}
          />
        </div>
        <p class="hours-month-title" aria-live="polite">
          <span class="hours-month-name">{monthLabel(month)}</span>
          {closedRow ? (
            <span class="hours-state is-closed">
              <IconLock size={13} />
              Closed
            </span>
          ) : (
            <span class="hours-state">Open</span>
          )}
        </p>
        {closedRow ? (
          <p class="wb-meta hours-month-note">
            Closed {formatDate(closedRow.closed_at)}
            {closedRow.closed_by ? ` by ${nameOf(closedRow.closed_by)}` : ''}.{closedRow.note ? ` ${closedRow.note}` : ''}
          </p>
        ) : null}
      </div>

      <div class="hours-filters">
        <PersonPicker
          label="Person"
          value={personFilter}
          people={pickable}
          allowNone
          noneLabel="Everyone"
          onChange={(id) => patch({ person: id })}
        />
        <label class="hours-filter">
          <span class="wb-label">Project</span>
          <Select
            value={projectFilter}
            placeholder="All projects"
            options={[
              ...projects.map((project) => ({ value: project.id, label: `${project.code} ${project.name}` })),
              { value: NO_PROJECT, label: 'No project' },
            ]}
            onValue={(value) => patch({ project: value || null })}
          />
        </label>
        {filtering ? (
          <Button variant="quiet" onClick={() => patch({ person: null, project: null })}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {error ? (
        <EmptyState
          tone="bad"
          quiet
          title="The month's hours did not load."
          body={error.message}
          action={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      ) : loading ? (
        <SkeletonLines count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filtering ? 'No hours match those filters.' : `No hours logged in ${monthLabel(month)}.`}
          body={filtering ? 'Clear a filter to see more.' : 'Entries show up here as people log them.'}
        />
      ) : (
        <>
          <p class="hours-month-total">
            <span class="wb-numeral hours-month-number">{formatHoursNumber(total)}</span>
            <span class="hours-total-unit">hours</span>
            <span class="wb-meta">
              {plural(rows.length, 'person', 'people')}, {plural(filtered.length, 'entry', 'entries')}
            </span>
          </p>

          <section class="wb-section" aria-labelledby="hours-people-title">
            <div class="wb-section-head">
              <h2 class="wb-section-title" id="hours-people-title">
                People and weeks
              </h2>
            </div>
            <table class="wb-table is-stacking hours-table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  {weeks.map((week) => (
                    <th scope="col" class="is-num" key={week}>
                      {weekHeading(week, bounds.from, bounds.to)}
                    </th>
                  ))}
                  <th scope="col" class="is-num">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((id) => {
                  const person = profileMap.get(id);
                  const list = byPerson.get(id) ?? [];
                  const isOpen = open.has(id);
                  const personTotal = sumHours(list);
                  return [
                    <tr key={id} class={`hours-person-row${isOpen ? ' is-open' : ''}`}>
                      <th scope="row" class="hours-person-cell">
                        <button
                          type="button"
                          class="hours-person-toggle"
                          aria-expanded={isOpen}
                          aria-controls={`hours-detail-${id}`}
                          onClick={() => toggle(id)}
                        >
                          <IconChevron size={14} class={`hours-person-caret${isOpen ? ' is-open' : ''}`} />
                          <Avatar id={id} name={person?.full_name} email={person?.email} size={24} />
                          <span class="hours-person-name">{personName(id)}</span>
                          <span class="wb-meta hours-person-count">{plural(list.length, 'entry', 'entries')}</span>
                        </button>
                      </th>
                      {weeks.map((week) => {
                        const value = grid[id]?.[week] ?? 0;
                        return (
                          <td key={week} class={`is-num wb-num-col${value ? '' : ' is-zero'}`} data-label={weekHeading(week, bounds.from, bounds.to)}>
                            {formatHoursNumber(value)}
                          </td>
                        );
                      })}
                      <td class="is-num wb-num-col hours-total-cell" data-label="Total">
                        {formatHoursNumber(personTotal)}
                      </td>
                    </tr>,
                    isOpen ? (
                      <tr key={`${id}-detail`} class="hours-detail-row" id={`hours-detail-${id}`}>
                        <td colSpan={weeks.length + 2} class="hours-detail-cell">
                          <ul class="hours-detail">
                            {list.map((entry) => {
                              const project = entry.project_id ? projectMap.get(entry.project_id) : undefined;
                              const task = entry.task_id ? taskMap.get(entry.task_id) : undefined;
                              return (
                                <li key={entry.id} class="hours-detail-item">
                                  <span class="hours-detail-date">{dayWording(entry.work_date)}</span>
                                  <span class="hours-detail-hours wb-num-col">{formatHoursNumber(entry.hours)} h</span>
                                  <span class="hours-detail-text">
                                    {project || task ? (
                                      <span class="hours-entry-meta">
                                        {project ? <ProjectMark project={project} /> : null}
                                        {task ? <span class="hours-entry-task">{task.title}</span> : null}
                                      </span>
                                    ) : null}
                                    <span class="hours-entry-summary">{entry.summary}</span>
                                  </span>
                                  {canChange ? (
                                    <span class="hours-detail-actions">
                                      <Button
                                        variant="quiet"
                                        size="sm"
                                        aria-label={`Edit ${personName(id)}'s hours on ${dayWording(entry.work_date)}`}
                                        onClick={() => setEditing(entry)}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        variant="quiet"
                                        size="sm"
                                        class="hours-delete"
                                        aria-label={`Delete ${personName(id)}'s hours on ${dayWording(entry.work_date)}`}
                                        onClick={() => setDeleting(entry)}
                                      >
                                        Delete
                                      </Button>
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
              <tfoot>
                <tr class="hours-foot-row">
                  <th scope="row">Everyone</th>
                  {weeks.map((week, index) => (
                    <td
                      key={week}
                      class={`is-num wb-num-col${weekTotals[index] ? '' : ' is-zero'}`}
                      data-label={weekHeading(week, bounds.from, bounds.to)}
                    >
                      {formatHoursNumber(weekTotals[index] ?? 0)}
                    </td>
                  ))}
                  <td class="is-num wb-num-col hours-total-cell" data-label="Total">
                    {formatHoursNumber(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section class="wb-section" aria-labelledby="hours-projects-title">
            <div class="wb-section-head">
              <h2 class="wb-section-title" id="hours-projects-title">
                Hours by project
              </h2>
            </div>
            <ul class="wb-list hours-projects">
              {projectRows.map(([key, hours]) => {
                const project = key === NO_PROJECT ? undefined : projectMap.get(key);
                const share = total ? Math.round((hours / total) * 100) : 0;
                return (
                  <li key={key} class="hours-project-row">
                    <span class="hours-project-name">
                      {project ? <ProjectMark project={project} showName /> : <span>No project</span>}
                    </span>
                    <span class="wb-meta hours-project-share wb-num-col">{share}%</span>
                    <span class="wb-numeral hours-project-hours">{formatHoursNumber(hours)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {editing ? (
        <LogDialog
          key={editing.id}
          entry={editing}
          initialDate={editing.work_date}
          onClose={() => setEditing(null)}
          onSaved={() => undefined}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        busy={busy}
        title="Delete this entry?"
        body={
          deleting
            ? `${personName(deleting.user_id)}: ${formatHoursNumber(deleting.hours)} h on ${dayWordingLong(deleting.work_date)}. ${deleting.summary}`
            : undefined
        }
        confirmLabel="Delete entry"
        cancelLabel="Keep it"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/** "Nov 2 to 8", kept inside the month so a partial week says so. */
function weekHeading(monday: string, monthFrom: string, monthTo: string): string {
  const start = monday < monthFrom ? monthFrom : monday;
  const sunday = addDays(monday, 6);
  const end = sunday > monthTo ? monthTo : sunday;
  const a = parseLocalDate(start);
  const b = parseLocalDate(end);
  if (!a || !b) return monday;
  const monthShort = a.toLocaleDateString('en-US', { month: 'short' });
  return a.getDate() === b.getDate() ? `${monthShort} ${a.getDate()}` : `${monthShort} ${a.getDate()} to ${b.getDate()}`;
}
