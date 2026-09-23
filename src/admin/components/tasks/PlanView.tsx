/**
 * The Plan: every task in the project, list first.
 *
 * The list is grouped by what needs doing when: Needs attention (critical,
 * blocked or overdue), This week, Next, Later, and Done (folded, with a
 * count). Each group starts with an "Add a task" line that files the new task
 * in that group. Above it, one row of filter chips (Mine, Critical, Overdue,
 * Unassigned, a workstream picker, search) and the switch to the Board.
 *
 * A task opens in its own panel; the address carries it (`?task=<id>`), so a
 * link to a task is something you can paste to a colleague.
 *
 * Keyboard: `/` jumps to search, `n` to "Add a task" in This week, Escape
 * closes the open panel.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Task, WorkstreamDef } from '../../lib/types';
import { insertRow, useProject, useTasks } from '../../lib/store';
import { displayName, useAuth } from '../../lib/auth';
import { setQuery, useRoute } from '../../lib/router';
import { plural } from '../../lib/format';
import { toast } from '../../lib/toasts';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { anyModalOpen } from '../Modal';
import { Popover } from '../Popover';
import { Segmented } from '../Tabs';
import { IconChevronDown, IconPlus, IconSearch } from '../Icons';
import { TaskBoard } from './TaskBoard';
import { TaskModal } from './TaskModal';
import { TaskRow } from './TaskRow';
import {
  EMPTY_PLAN_FILTERS,
  PLAN_GROUPS,
  PLAN_GROUP_DEFAULTS,
  PLAN_GROUP_LABEL,
  changedSince,
  comparePlan,
  isMine,
  isOverdueTask,
  isUnassigned,
  matchesPlan,
  nextSort,
  planGroupOf,
  sortTasks,
  type PlanFilters,
  type PlanGroup,
  type TaskView,
} from './shared';

const VIEW_KEY = 'wb.taskview';

export interface PlanViewProps {
  workstreams?: WorkstreamDef[];
}

export function PlanView({ workstreams = [] }: PlanViewProps) {
  const route = useRoute();
  const tasks = useTasks();
  const auth = useAuth();
  const { readOnly } = useProject();
  const search = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<PlanFilters>(() => ({
    ...EMPTY_PLAN_FILTERS,
    // Links from Today and from old workstream links pre-set a filter.
    mine: route.query.mine === '1',
    unassigned: route.query.unassigned === '1',
    ws: route.query.ws ? [route.query.ws] : [],
  }));
  const [showDone, setShowDone] = useState(false);
  const [view, setView] = useState<TaskView>(() => {
    try {
      return window.localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
    } catch {
      return 'list';
    }
  });

  const me = auth.userId;
  const myName = displayName(auth);
  const openId = route.query.task || null;
  const open = (id: string | null) => setQuery({ ...route.query, task: id });
  const openTask = openId ? (tasks.find((task) => task.id === openId) ?? null) : null;

  const switchView = (next: TaskView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* nothing to remember */
    }
  };

  // `/` for search and `n` for a new task, whenever nothing else has the keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || anyModalOpen()) return;
      const target = event.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (event.key === '/') {
        event.preventDefault();
        search.current?.focus();
      } else if (event.key === 'n' && !readOnly) {
        event.preventDefault();
        if (view === 'board') switchView('list');
        window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-quick-add="week"]')?.focus(), 0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [readOnly, view]);

  const counts = useMemo(() => {
    const open = tasks.filter((task) => task.status !== 'done');
    return {
      mine: open.filter((task) => isMine(task, me, myName)).length,
      critical: open.filter((task) => task.pri === 'critical').length,
      overdue: open.filter(isOverdueTask).length,
      unassigned: open.filter(isUnassigned).length,
    };
  }, [tasks, me, myName]);

  const visible = useMemo(
    () => tasks.filter((task) => matchesPlan(task, filters, me, myName)),
    [tasks, filters, me, myName]
  );

  const groups = useMemo(() => {
    const out: Record<PlanGroup, Task[]> = { attention: [], week: [], next: [], later: [], done: [] };
    for (const task of visible) out[planGroupOf(task)].push(task);
    for (const key of PLAN_GROUPS) out[key].sort(comparePlan);
    out.done.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return out;
  }, [visible]);

  const filtered = Boolean(
    filters.search || filters.mine || filters.critical || filters.overdue || filters.unassigned || filters.ws.length
  );
  const clear = () => setFilters(EMPTY_PLAN_FILTERS);
  const toggle = (key: 'mine' | 'critical' | 'overdue' | 'unassigned') =>
    setFilters((current) => ({ ...current, [key]: !current[key] }));

  const chip = (key: 'mine' | 'critical' | 'overdue' | 'unassigned', label: string) => (
    <button
      type="button"
      class={`wb-chip wb-chip-toggle${filters[key] ? ' is-active' : ''}`}
      aria-pressed={filters[key]}
      onClick={() => toggle(key)}
    >
      {label}
      {counts[key] ? <span class="wb-chip-count wb-mono">{counts[key]}</span> : null}
    </button>
  );

  const wsLabel = filters.ws.length
    ? filters.ws.length === 1
      ? (workstreams.find((entry) => entry.key === filters.ws[0])?.label ?? filters.ws[0])
      : `${filters.ws.length} workstreams`
    : 'Workstream';

  return (
    <section class="wb-plan" aria-label="Plan">
      <div class="wb-plan-bar">
        <div class="wb-plan-chips" role="group" aria-label="Show only">
          {chip('mine', 'Mine')}
          {chip('critical', 'Critical')}
          {chip('overdue', 'Overdue')}
          {chip('unassigned', 'Unassigned')}
          {workstreams.length ? (
            <Popover
              label="Workstreams"
              class={filters.ws.length ? 'is-active' : undefined}
              button={
                <>
                  {wsLabel}
                  <IconChevronDown size={13} />
                </>
              }
            >
              <ul class="wb-check-list">
                {workstreams.map((entry) => (
                  <li key={entry.key}>
                    <label class="wb-check">
                      <input
                        type="checkbox"
                        checked={filters.ws.includes(entry.key)}
                        onChange={(event) => {
                          const on = (event.currentTarget as HTMLInputElement).checked;
                          setFilters((current) => ({
                            ...current,
                            ws: on ? [...current.ws, entry.key] : current.ws.filter((key) => key !== entry.key),
                          }));
                        }}
                      />
                      <span>{entry.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {filters.ws.length ? (
                <Button variant="quiet" size="sm" onClick={() => setFilters((current) => ({ ...current, ws: [] }))}>
                  Show every workstream
                </Button>
              ) : null}
            </Popover>
          ) : null}
          {filtered ? (
            <button type="button" class="wb-linkish wb-plan-clear" onClick={clear}>
              Clear
            </button>
          ) : null}
        </div>

        <label class="wb-search wb-plan-search">
          <IconSearch size={16} />
          <span class="wb-sr">Search tasks</span>
          <input
            ref={search}
            class="wb-input wb-input-sm"
            type="search"
            value={filters.search}
            placeholder="Search"
            onInput={(event) =>
              setFilters((current) => ({ ...current, search: (event.currentTarget as HTMLInputElement).value }))
            }
          />
          <kbd class="wb-kbd" aria-hidden="true">
            /
          </kbd>
        </label>

        <Segmented<TaskView>
          label="View"
          value={view}
          onValue={switchView}
          options={[
            { value: 'list', label: 'List' },
            { value: 'board', label: 'Board' },
          ]}
        />
      </div>

      {view === 'board' ? (
        <TaskBoard
          tasks={sortTasks(visible)}
          workstreams={workstreams}
          openId={openId}
          onOpen={open}
        />
      ) : tasks.length === 0 && readOnly ? (
        <EmptyState title="No tasks yet" body="Nothing has been added to this project yet." />
      ) : (
        <div class="wb-plan-groups">
          {PLAN_GROUPS.map((key) => {
            const list = groups[key];
            if (key === 'done') {
              if (!list.length) return null;
              return (
                <section class="wb-plan-group is-done" key={key}>
                  <button
                    type="button"
                    class="wb-plan-group-head is-toggle"
                    aria-expanded={showDone}
                    onClick={() => setShowDone((value) => !value)}
                  >
                    <span>{PLAN_GROUP_LABEL.done}</span>
                    <span class="wb-plan-count wb-mono">{list.length}</span>
                    <IconChevronDown size={14} class={showDone ? 'wb-flip-y' : ''} />
                  </button>
                  {showDone ? (
                    <ul class="wb-rows">
                      {list.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          workstreams={workstreams}
                          open={openId === task.id}
                          changed={false}
                          onOpen={open}
                        />
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            }
            // Needs attention only shows when something needs it.
            if (key === 'attention' && !list.length) return null;
            if (filtered && !list.length) return null;
            return (
              <section class={`wb-plan-group is-${key}`} key={key}>
                <h3 class="wb-plan-group-head">
                  <span>{PLAN_GROUP_LABEL[key]}</span>
                  <span class="wb-plan-count wb-mono">{list.length}</span>
                </h3>
                <ul class="wb-rows">
                  {readOnly || key === 'attention' ? null : (
                    <QuickAdd group={key} tasks={tasks} filters={filters} me={me} />
                  )}
                  {list.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      workstreams={workstreams}
                      open={openId === task.id}
                      changed={changedSince(task, auth.lastVisit, me)}
                      onOpen={open}
                    />
                  ))}
                  {!list.length && readOnly ? <li class="wb-rows-empty">Nothing here.</li> : null}
                </ul>
              </section>
            );
          })}

          {filtered && !visible.length ? (
            <EmptyState
              title="No tasks match"
              body="Take a filter off to see more."
              action={
                <Button variant="secondary" onClick={clear}>
                  Clear the filters
                </Button>
              }
            />
          ) : null}

          <p class="wb-plan-foot wb-mono-soft">
            {plural(visible.filter((task) => task.status !== 'done').length, 'open task')}
            {filtered ? ` shown of ${tasks.filter((task) => task.status !== 'done').length}` : ''}
          </p>
        </div>
      )}

      <TaskModal task={openTask} workstreams={workstreams} onClose={() => open(null)} />
    </section>
  );
}

/**
 * The "Add a task" line at the top of a group. Enter adds it and keeps the
 * cursor here for the next one; the new task lands in this group, in the
 * workstream being filtered on, assigned to you when "Mine" is on.
 */
function QuickAdd({
  group,
  tasks,
  filters,
  me,
}: {
  group: Exclude<PlanGroup, 'done' | 'attention'>;
  tasks: Task[];
  filters: PlanFilters;
  me: string | null;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    const defaults = PLAN_GROUP_DEFAULTS[group];
    const result = await insertRow<Task>('tasks', {
      title: clean,
      horizon: defaults.horizon,
      pri: filters.critical ? 'critical' : defaults.pri,
      ws: filters.ws.length === 1 ? filters.ws[0] : '',
      assignee: filters.mine && me ? me : null,
      due: null,
      // The rest of the row, so the task shows complete the moment it is
      // added rather than after the server answers.
      status: 'todo',
      owner: '',
      why: '',
      done_when: '',
      notes: '',
      recurring: '',
      sources: [],
      sort: nextSort(tasks),
    });
    setBusy(false);
    if (result.ok) setTitle('');
    else if (result.error) toast.bad(result.error.message);
  };

  return (
    <li class="wb-row wb-quick-add">
      <IconPlus size={16} />
      <input
        class="wb-quick-input"
        type="text"
        value={title}
        data-quick-add={group}
        placeholder="Add a task"
        aria-label={`Add a task to ${PLAN_GROUP_LABEL[group]}`}
        readOnly={busy}
        onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void add();
          }
          if (event.key === 'Escape') {
            setTitle('');
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
      {title.trim() ? (
        <Button variant="primary" size="sm" busy={busy} onClick={() => void add()}>
          Add
        </Button>
      ) : null}
    </li>
  );
}
