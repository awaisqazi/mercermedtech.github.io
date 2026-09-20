/**
 * The whole task surface: toolbar, list or board, and the add form. Used as
 * "Tasks" in a general project and as "Deliverables" in a grant, with the only
 * difference being the words and whether workstreams exist.
 *
 * The open card lives in the address (`?task=<id>`), so a link to one
 * deliverable is a link somebody can paste to a colleague.
 */
import { useMemo, useState } from 'preact/hooks';
import type { Horizon, TaskStatus, WorkstreamDef } from '../../lib/types';
import { HORIZONS, HORIZON_LABEL, STATUS_LABEL, TASK_STATUSES } from '../../lib/types';
import { useProject, useTasks } from '../../lib/store';
import { setQuery, useRoute } from '../../lib/router';
import { plural } from '../../lib/format';
import { Button } from '../Button';
import { Checkbox } from '../Field';
import { Select, optionsFrom } from '../Select';
import { Segmented } from '../Tabs';
import { IconSearch } from '../Icons';
import { TaskList } from './TaskList';
import { TaskBoard } from './TaskBoard';
import { AddTask } from './AddTask';
import { EMPTY_FILTERS, matchesFilters, type TaskFilters, type TaskView } from './shared';

const VIEW_KEY = 'wb.taskview';

export interface TaskSectionProps {
  workstreams?: WorkstreamDef[];
  /** "task" or "deliverable": used in labels and empty states. */
  noun?: string;
  /** Pre-set a workstream filter, e.g. from an Overview table click. */
  initialWs?: string;
  title?: string;
}

export function TaskSection({
  workstreams = [],
  noun = 'task',
  initialWs = '',
  title,
}: TaskSectionProps) {
  const route = useRoute();
  const tasks = useTasks();
  const { readOnly, members, profiles } = useProject();
  const [filters, setFilters] = useState<TaskFilters>({ ...EMPTY_FILTERS, ws: initialWs });
  const [view, setView] = useState<TaskView>(() => {
    try {
      return window.localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
    } catch {
      return 'list';
    }
  });

  const openId = route.query.task || null;
  const setOpenId = (id: string | null) => setQuery(id ? { ...route.query, task: id } : { ...route.query, task: null });

  const switchView = (next: TaskView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* nothing to remember */
    }
  };

  const nameOf = (userId: string | null) =>
    (userId && (profiles[userId]?.full_name || profiles[userId]?.email)) || '';

  const visible = useMemo(
    () => tasks.filter((task) => matchesFilters(task, filters, { nameOf })),
    // `profiles` only matters through nameOf, which is only used when filtering by person.
    [tasks, filters, profiles]
  );

  const peopleOptions = [
    { value: 'unassigned', label: 'Nobody yet' },
    ...members.map((member) => ({
      value: member.user_id,
      label: profiles[member.user_id]?.full_name?.trim() || profiles[member.user_id]?.email || 'Member',
    })),
  ];

  const plural2 = noun === 'task' ? 'tasks' : `${noun}s`;
  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const filtered =
    filters.search || filters.ws || filters.status || filters.who || filters.horizon || filters.hideDone;

  return (
    <section class="wb-panel">
      <header class="wb-panel-head">
        <h2 class="wb-panel-title">
          {title ?? `${noun[0]!.toUpperCase()}${noun.slice(1)}s`}
          <span class="wb-panel-count wb-mono-soft"> {visible.length}</span>
        </h2>
        <div class="wb-toolbar">
          <Segmented<TaskView>
            label="View"
            value={view}
            onValue={switchView}
            options={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Board' },
            ]}
          />
          {readOnly ? null : (
            <AddTask
              tasks={tasks}
              workstreams={workstreams}
              defaultWs={filters.ws}
              defaultHorizon={(filters.horizon || 'now') as Horizon}
              label={`Add ${noun === 'task' ? 'a task' : `a ${noun}`}`}
              onAdded={(task) => setOpenId(task.id)}
            />
          )}
        </div>
      </header>

      <div class="wb-filters">
        <span class="wb-search">
          <IconSearch size={16} />
          <input
            class="wb-input wb-input-sm"
            type="search"
            value={filters.search}
            placeholder={`Search ${plural2}`}
            aria-label={`Search ${plural2}`}
            onInput={(event) => set('search', (event.currentTarget as HTMLInputElement).value)}
          />
        </span>

        {workstreams.length ? (
          <Select
            value={filters.ws}
            placeholder="All workstreams"
            options={workstreams.map((entry) => ({ value: entry.key, label: entry.label }))}
            size="sm"
            aria-label="Workstream"
            onValue={(value) => set('ws', value)}
          />
        ) : null}

        <Select<TaskStatus>
          value={filters.status}
          placeholder="Any status"
          options={optionsFrom(TASK_STATUSES, STATUS_LABEL)}
          size="sm"
          aria-label="Status"
          onValue={(value) => set('status', value)}
        />

        <Select
          value={filters.who}
          placeholder="Anyone"
          options={peopleOptions}
          size="sm"
          aria-label="Assigned to"
          onValue={(value) => set('who', value)}
        />

        <Segmented<Horizon | ''>
          label="Horizon"
          value={filters.horizon}
          onValue={(value) => set('horizon', value)}
          options={[
            { value: '', label: 'All' },
            ...HORIZONS.map((horizon) => ({ value: horizon, label: HORIZON_LABEL[horizon] })),
          ]}
        />

        <Checkbox
          label="Hide done"
          checked={filters.hideDone}
          onChange={(event) => set('hideDone', (event.currentTarget as HTMLInputElement).checked)}
        />

        {filtered ? (
          <Button variant="quiet" size="sm" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {view === 'board' ? (
        <TaskBoard tasks={visible} workstreams={workstreams} openId={openId} onOpen={setOpenId} />
      ) : (
        <TaskList
          tasks={visible}
          workstreams={workstreams}
          openId={openId}
          onOpen={setOpenId}
          emptyTitle={filtered ? `No ${plural2} match those filters` : `No ${plural2} yet`}
          emptyBody={
            filtered
              ? 'Clear a filter to see more.'
              : readOnly
                ? 'Nothing has been added to this project yet.'
                : `Add the first one and it will show up for everyone straight away.`
          }
          emptyAction={
            filtered ? (
              <Button variant="secondary" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
                Clear filters
              </Button>
            ) : null
          }
        />
      )}

      {visible.length ? (
        <p class="wb-panel-foot wb-mono-soft">
          {plural(visible.length, noun, plural2)} shown
          {visible.length !== tasks.length ? ` of ${tasks.length}` : ''}
        </p>
      ) : null}
    </section>
  );
}
