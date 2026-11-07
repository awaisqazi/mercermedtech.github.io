/**
 * Tasks: every task, as a list grouped by status or as a board, with the
 * detail in a drawer. Everything about the view is in the address
 * (`#/tasks?view=board&scope=mine&project=...`), so a filtered view can be
 * shared as a link; `task=<id>` opens the drawer and `new=1` the new-task
 * dialog.
 *
 * On a phone the filters fold into one "Filter" button that opens a sheet.
 * `n` opens New task when no field has the keyboard.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Field } from '../../components/Field';
import { IconFilter, IconPlus, IconSearch } from '../../components/Icons';
import { Modal, anyModalOpen } from '../../components/Modal';
import { PageHeader, PhoneAction } from '../../components/PageHeader';
import { Select, type Option } from '../../components/Select';
import { Segmented } from '../../components/Tabs';
import { useAuth } from '../../lib/auth';
import { useCan, useMyRole } from '../../lib/perms';
import { patchQuery, useRoute } from '../../lib/router';
import { STATUS_LABEL, TASK_STATUSES, type Task, type TaskStatus } from '../../lib/types';
import { useProfiles, useProjects, useTasks } from '../../lib/workspace';
import {
  NONE,
  activeFilterCount,
  applyFilters,
  canEditTask,
  groupTasks,
  isFiltered,
  isTyping,
  readFilters,
  rememberView,
  usePhone,
  type TaskFilters,
  type TaskScope,
  type TaskView,
} from './filters';
import { TaskBoard } from './TaskBoard';
import { TaskDrawer } from './TaskDrawer';
import { NewTask } from './TaskForm';
import { TaskList } from './TaskList';

const CLEAR = { scope: null, project: null, person: null, status: null, q: null } as const;

export function Tasks() {
  const route = useRoute();
  const filters = readFilters(route.query);
  const me = useAuth().userId;
  const role = useMyRole();
  const tasks = useTasks();
  const projects = useProjects();
  const canCreate = useCan('tasks.create');
  const phone = usePhone();
  const [sheet, setSheet] = useState(false);

  const filtered = useMemo(
    () => applyFilters(tasks, filters, me, projects),
    // The filters are plain strings from the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projects, me, filters.scope, filters.project, filters.person, filters.status, filters.q]
  );
  const groups = useMemo(
    () => groupTasks(filtered, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, filters.status]
  );
  const openCount = filtered.filter((task) => task.status !== 'done').length;
  const shownCount = groups.reduce((sum, group) => sum + group.tasks.length, 0);
  const canEdit = (task: Task) => canEditTask(task, me, role);

  // Remember a view picked by link, too, so the next visit opens the same way.
  useEffect(() => {
    if (route.query.view === 'list' || route.query.view === 'board') rememberView(route.query.view);
  }, [route.query.view]);

  // `n` for New task, unless a field or an overlay has the keyboard.
  useEffect(() => {
    if (!canCreate) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTyping(event.target) || anyModalOpen()) return;
      event.preventDefault();
      patchQuery({ new: 1, task: null });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canCreate]);

  const openNew = () => patchQuery({ new: 1, task: null });
  const closeNew = () => patchQuery({ new: null }, { replace: true });
  const setView = (view: TaskView) => {
    rememberView(view);
    patchQuery({ view }, { replace: true });
  };

  const taskId = route.query.task;
  const showNew = route.query.new === '1' && canCreate;

  return (
    <div class="wb-page wb-tasks">
      <PageHeader
        title="Tasks"
        count={openCount}
        actions={
          <>
            <Segmented<TaskView>
              label="View"
              value={filters.view}
              onValue={setView}
              options={[
                { value: 'list', label: 'List' },
                { value: 'board', label: 'Board' },
              ]}
            />
            {canCreate && !phone ? (
              <Button variant="primary" icon={<IconPlus size={16} />} onClick={openNew} aria-keyshortcuts="n">
                New task
              </Button>
            ) : null}
          </>
        }
      />
      {canCreate && phone ? <PhoneAction label="New task" icon={<IconPlus />} onClick={openNew} /> : null}

      <div class="wb-tasks-toolbar" role="search" aria-label="Find tasks">
        <SearchBox value={filters.q} />
        {phone ? (
          <Button
            variant="secondary"
            icon={<IconFilter size={16} />}
            aria-haspopup="dialog"
            onClick={() => setSheet(true)}
            class="wb-tasks-filter-button"
          >
            {activeFilterCount(filters) ? `Filter (${activeFilterCount(filters)})` : 'Filter'}
          </Button>
        ) : (
          <FilterControls filters={filters} />
        )}
        {isFiltered(filters) && !phone ? (
          <Button variant="quiet" size="sm" onClick={() => patchQuery(CLEAR, { replace: true })}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {shownCount ? (
        filters.view === 'board' ? (
          <TaskBoard groups={groups} canEdit={canEdit} phone={phone} />
        ) : (
          <TaskList groups={groups} canEdit={canEdit} />
        )
      ) : (
        <TasksEmpty filters={filters} total={tasks.length} canCreate={canCreate} onNew={openNew} />
      )}

      {phone && sheet ? (
        <Modal
          open
          title="Filter tasks"
          onClose={() => setSheet(false)}
          size="sm"
          class="wb-tasks-sheet"
          footer={
            <>
              <Button variant="quiet" onClick={() => patchQuery(CLEAR, { replace: true })}>
                Clear filters
              </Button>
              <Button variant="primary" onClick={() => setSheet(false)}>
                {`Show ${shownCount} ${shownCount === 1 ? 'task' : 'tasks'}`}
              </Button>
            </>
          }
        >
          <FilterControls filters={filters} stacked />
        </Modal>
      ) : null}

      {taskId ? <TaskDrawer taskId={taskId} /> : null}
      {showNew ? <NewTask filters={filters} onClose={closeNew} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------ search --- */

/** Types freely; the address follows a moment later, without a history step per key. */
function SearchBox({ value }: { value: string }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onInput = (event: Event) => {
    const next = (event.currentTarget as HTMLInputElement).value;
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => patchQuery({ q: next.trim() ? next : null }, { replace: true }), 200);
  };

  return (
    <div class="wb-tasks-search">
      <IconSearch size={16} class="wb-tasks-search-icon" />
      <label class="wb-sr" for="tasks-search">
        Search tasks
      </label>
      <input
        id="tasks-search"
        class="wb-input"
        type="search"
        placeholder="Search tasks"
        autoComplete="off"
        value={draft}
        onInput={onInput}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && draft) {
            event.preventDefault();
            setDraft('');
            patchQuery({ q: null }, { replace: true });
          }
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------- filters --- */

function FilterControls({ filters, stacked = false }: { filters: TaskFilters; stacked?: boolean }) {
  const projects = useProjects();
  const people = useProfiles();
  const me = useAuth().userId;

  const projectOptions = useMemo<Array<Option<string>>>(
    () => [
      { value: NONE, label: 'No project' },
      ...projects
        .filter((project) => project.status === 'active' || project.id === filters.project)
        .map((project) => ({ value: project.id, label: `${project.code} · ${project.name}` })),
    ],
    [projects, filters.project]
  );

  const personOptions = useMemo<Array<Option<string>>>(
    () => [
      { value: NONE, label: 'Unassigned' },
      ...people
        .filter((person) => person.active || person.id === filters.person)
        .map((person) => ({
          value: person.id,
          label: `${person.full_name || person.email || 'Someone'}${person.id === me ? ' (you)' : ''}`,
        })),
    ],
    [people, filters.person, me]
  );

  const statusOptions: Array<Option<TaskStatus>> = TASK_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABEL[status],
  }));

  const set = (patch: Record<string, string | null>) => patchQuery(patch, { replace: true });
  const scope: TaskScope = filters.person ? 'all' : filters.scope;

  return (
    <div class={`wb-tasks-filters${stacked ? ' is-stacked' : ''}`}>
      <Segmented<TaskScope>
        label="Whose tasks"
        value={scope}
        onValue={(next) => set({ scope: next === 'mine' ? 'mine' : null, person: null })}
        options={[
          { value: 'mine', label: 'Mine' },
          { value: 'all', label: 'All' },
        ]}
      />
      <Field label="Project" hideLabel={!stacked} class="wb-tasks-filter">
        {(props) => (
          <Select
            {...props}
            size={stacked ? 'md' : 'sm'}
            value={filters.project}
            placeholder="Every project"
            options={projectOptions}
            onValue={(value) => set({ project: value || null })}
          />
        )}
      </Field>
      <Field label="Person" hideLabel={!stacked} class="wb-tasks-filter">
        {(props) => (
          <Select
            {...props}
            size={stacked ? 'md' : 'sm'}
            value={filters.person}
            placeholder="Anyone"
            options={personOptions}
            onValue={(value) => set({ person: value || null, scope: null })}
          />
        )}
      </Field>
      <Field label="Status" hideLabel={!stacked} class="wb-tasks-filter">
        {(props) => (
          <Select<TaskStatus>
            {...props}
            size={stacked ? 'md' : 'sm'}
            value={filters.status}
            placeholder="Every status"
            options={statusOptions}
            onValue={(value) => set({ status: value || null })}
          />
        )}
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------- empty --- */

function TasksEmpty({
  filters,
  total,
  canCreate,
  onNew,
}: {
  filters: TaskFilters;
  total: number;
  canCreate: boolean;
  onNew: () => void;
}) {
  const clear = () => patchQuery(CLEAR, { replace: true });

  if (!total) {
    return (
      <EmptyState
        title="There are no tasks yet"
        body={canCreate ? 'Make the first one. The whole team sees it here.' : 'When someone makes a task, it shows here.'}
        action={
          canCreate ? (
            <Button variant="primary" icon={<IconPlus size={16} />} onClick={onNew}>
              New task
            </Button>
          ) : undefined
        }
      />
    );
  }

  const onlyMine = filters.scope === 'mine' && !filters.person && !filters.project && !filters.status && !filters.q.trim();
  if (onlyMine) {
    return (
      <EmptyState
        title="No tasks are assigned to you"
        body={canCreate ? 'Take one from the list, or make one.' : 'Take one from the list.'}
        action={
          <Button variant="secondary" onClick={() => patchQuery({ scope: null }, { replace: true })}>
            See every task
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      title="No tasks match"
      body={
        filters.q.trim()
          ? `Nothing matches "${filters.q.trim()}" with these filters. Try fewer words, or clear the filters.`
          : 'Nothing fits these filters. Try a wider one, or clear them.'
      }
      action={
        <Button variant="secondary" onClick={clear}>
          Clear filters
        </Button>
      }
    />
  );
}
