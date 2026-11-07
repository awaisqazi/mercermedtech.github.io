/**
 * One task, in the drawer: right of the list on a desktop, a full-screen
 * sheet on a phone. Every field saves on its own (on blur for text, on choice
 * for the rest) through the store, so there is no Save button; a refused
 * write rolls back and says why.
 *
 * Who may do what (section 3 of the plan), mirrored here and enforced again
 * by the database:
 *   - edit fields, the checklist, move it: tasks.edit_any, or you made it, or
 *     it is assigned to you;
 *   - assign to someone else: tasks.assign; anyone may take an unassigned task
 *     or give back one assigned to them;
 *   - delete: tasks.delete, or a task you made;
 *   - comment: everyone.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { useConfirm } from '../../components/ConfirmDialog';
import { DateInput } from '../../components/DateInput';
import { Drawer } from '../../components/Drawer';
import { EmptyState } from '../../components/EmptyState';
import { IconDots, IconLink, IconTrash } from '../../components/Icons';
import { LiveSelect, LiveTextarea } from '../../components/LiveField';
import { Menu, type MenuItem } from '../../components/Menu';
import { PersonPicker } from '../../components/PersonPicker';
import { ProjectMark } from '../../components/ProjectMark';
import { RichText } from '../../components/RichText';
import { Select, optionsFrom, type Option } from '../../components/Select';
import { PriorityWord, StatusDot } from '../../components/StatusDot';
import { useAuth } from '../../lib/auth';
import { formatDateLong, relativeTime, fullTime } from '../../lib/format';
import { formatHours } from '../../lib/hours';
import { href } from '../../lib/router';
import { roleAllows, useCan, useMyRole } from '../../lib/perms';
import { toast } from '../../lib/toasts';
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
} from '../../lib/types';
import {
  assignTask,
  deleteTask,
  nameOf,
  setPresence,
  updateTask,
  useHoursOnTask,
  useLiveField,
  useProfile,
  useProjects,
  useTask,
  useTaskItems,
} from '../../lib/workspace';
import { Checklist } from './Checklist';
import { CommentComposer, CommentList } from './Comments';
import { History } from './History';
import { canDeleteTask, canEditTask } from './filters';
import { AssigneeMark, DueWords, closeTask } from './TaskBits';

export function TaskDrawer({ taskId }: { taskId: string }) {
  const task = useTask(taskId);

  useEffect(() => {
    setPresence({ task: taskId });
    return () => setPresence({ task: null });
  }, [taskId]);

  if (!task) {
    return (
      <Drawer open title="Task" onClose={closeTask} class="wb-task-drawer">
        <EmptyState
          title="This task is not here"
          body="It may have been deleted, or the link may be from an older list. Done tasks older than 90 days are not loaded."
          action={
            <Button variant="secondary" onClick={closeTask}>
              Back to the list
            </Button>
          }
        />
      </Drawer>
    );
  }

  return <TaskDetail task={task} />;
}

function TaskDetail({ task }: { task: Task }) {
  const me = useAuth().userId;
  const role = useMyRole();
  const editable = canEditTask(task, me, role);
  const deletable = canDeleteTask(task, me, role);
  const { confirm, element } = useConfirm();

  const remove = async () => {
    const yes = await confirm({
      title: 'Delete this task?',
      body: `"${task.title}" goes for everyone, with its checklist and comments. Hours logged against it stay, without the task.`,
      confirmLabel: 'Delete task',
      tone: 'danger',
    });
    if (!yes) return;
    const result = await deleteTask(task.id);
    if (result.ok) {
      toast.good('Task deleted.');
      closeTask();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.good('Link copied.');
    } catch {
      toast.warn('The link could not be copied. Copy it from the address bar.');
    }
  };

  const items: MenuItem[] = [{ key: 'link', label: 'Copy link', icon: <IconLink size={16} />, onSelect: () => void copyLink() }];
  if (deletable) {
    items.push({
      key: 'delete',
      label: 'Delete task',
      icon: <IconTrash size={16} />,
      tone: 'danger',
      divider: true,
      onSelect: () => void remove(),
    });
  }

  const title = editable ? (
    <TitleField task={task} />
  ) : (
    <h2 class="wb-drawer-title wb-task-title-read">{task.title}</h2>
  );

  return (
    <Drawer
      open
      title={title}
      label={task.title}
      onClose={closeTask}
      class="wb-task-drawer"
      actions={
        <Menu
          label="Task actions"
          items={items}
          trigger={(props) => (
            <Button {...props} variant="quiet" iconOnly aria-label="More actions" icon={<IconDots />} />
          )}
        />
      }
      footer={<CommentComposer taskId={task.id} />}
    >
      <div class="wb-task-detail">
        <TaskFields task={task} editable={editable} />
        <Description task={task} editable={editable} />
        <Checklist taskId={task.id} editable={editable} />
        <HoursLine task={task} />
        <CommentList taskId={task.id} />
        <History taskId={task.id} />
        <p class="wb-meta wb-task-made">
          Made by {task.created_by ? nameOf(task.created_by) : 'someone'},{' '}
          <time dateTime={task.created_at} title={fullTime(task.created_at)}>
            {formatDateLong(task.created_at.slice(0, 10))}
          </time>
          . Last changed{' '}
          <time dateTime={task.updated_at} title={fullTime(task.updated_at)}>
            {relativeTime(task.updated_at)}
          </time>
          .
        </p>
      </div>
      {element}
    </Drawer>
  );
}

/* -------------------------------------------------------------- title --- */

/**
 * The title, edited in place. A textarea that grows with the words rather
 * than a one-line input, so a long title is never cut off on a phone; Enter
 * saves (a title is one line), Escape puts it back.
 */
function TitleField({ task }: { task: Task }) {
  const live = useLiveField('tasks', task.id, 'title', task.title, {
    parse: (draft) => draft.replace(/\s+/g, ' ').trim(),
    equals: (a, b) => a === b || a === '',
    onError: (error) => toast.bad(error.message),
  });
  const inputId = `live-${task.id}-title`;
  return (
    <div class={`wb-live wb-task-title-field${live.saving ? ' is-saving' : ''}`}>
      <label class="wb-sr" for={inputId}>
        Title
      </label>
      <textarea
        id={inputId}
        class="wb-input wb-task-title-input"
        rows={1}
        value={live.value}
        maxLength={200}
        onInput={live.onInput}
        onFocus={live.onFocus}
        onBlur={() => {
          const empty = !live.value.trim();
          live.onBlur();
          // A task needs a title: an emptied box goes back to the saved one.
          if (empty) live.commit(task.title);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            (event.currentTarget as HTMLTextAreaElement).blur();
            return;
          }
          live.onKeyDown(event);
        }}
      />
      {live.hint ? (
        <p class="wb-live-hint" role="status">
          {live.hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- fields --- */

function TaskFields({ task, editable }: { task: Task; editable: boolean }) {
  const items = useTaskItems(task.id);
  return (
    <div class="wb-task-fields">
      {editable ? (
        <LiveSelect
          table="tasks"
          id={task.id}
          field="status"
          value={task.status}
          label="Status"
          options={optionsFrom(TASK_STATUSES, STATUS_LABEL)}
          class="wb-task-field"
        />
      ) : (
        <ReadField label="Status">
          <StatusDot status={task.status} />
        </ReadField>
      )}

      <AssigneeField task={task} editable={editable} />

      {editable ? (
        <ProjectField task={task} />
      ) : (
        <ReadField label="Project">
          <ReadProject id={task.project_id} />
        </ReadField>
      )}

      {editable ? (
        <LiveSelect
          table="tasks"
          id={task.id}
          field="priority"
          value={task.priority}
          label="Priority"
          options={optionsFrom(TASK_PRIORITIES, PRIORITY_LABEL)}
          class="wb-task-field"
        />
      ) : (
        <ReadField label="Priority">
          {task.priority === 'normal' ? <span>Normal</span> : <PriorityWord priority={task.priority} />}
        </ReadField>
      )}

      {editable ? (
        <div class="wb-task-field wb-task-field-due">
          <DateInput
            label="Due"
            value={task.due}
            shortcuts={['tomorrow', 'next-week']}
            clearable
            onChange={(due) => {
              if (due !== task.due) void updateTask(task.id, { due });
            }}
          />
          <p class="wb-hint">
            <DueWords task={task} />
          </p>
        </div>
      ) : (
        <ReadField label="Due">{task.due ? <DueWords task={task} /> : <span class="wb-meta">No date</span>}</ReadField>
      )}

      {editable && !items.length ? <ProgressField task={task} /> : null}
    </div>
  );
}

function ReadField({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="wb-task-field wb-task-field-read">
      <span class="wb-label">{label}</span>
      <div class="wb-task-field-value">{children}</div>
    </div>
  );
}

function ReadProject({ id }: { id: string | null }) {
  const projects = useProjects();
  const project = projects.find((row) => row.id === id) ?? null;
  return project ? <ProjectMark project={project} showName /> : <span class="wb-meta">No project</span>;
}

/**
 * Assigning. With tasks.assign: the picker. Without it: take an unassigned
 * task, or give back your own. Nothing else is rendered.
 */
function AssigneeField({ task, editable }: { task: Task; editable: boolean }) {
  const me = useAuth().userId;
  const role = useMyRole();
  const assignee = useProfile(task.assignee_id);
  const mayAssign = roleAllows(role, 'tasks.assign') && editable;

  if (mayAssign) {
    return (
      <div class="wb-task-field">
        <PersonPicker
          label="Assignee"
          value={task.assignee_id}
          onChange={(userId) => void assignTask(task.id, userId)}
        />
      </div>
    );
  }

  const name = assignee ? assignee.full_name || assignee.email || 'Someone' : 'Unassigned';
  return (
    <ReadField label="Assignee">
      <span class="wb-task-assignee">
        <AssigneeMark userId={task.assignee_id} size={24} />
        <span>{task.assignee_id === me ? `${name} (you)` : name}</span>
      </span>
      {!task.assignee_id && me ? (
        <Button variant="secondary" size="sm" onClick={() => void assignTask(task.id, me)}>
          Take this task
        </Button>
      ) : null}
      {task.assignee_id && task.assignee_id === me ? (
        <Button variant="quiet" size="sm" onClick={() => void assignTask(task.id, null)}>
          Give it back
        </Button>
      ) : null}
    </ReadField>
  );
}

/** A select bound to a nullable column through useLiveField, so "" saves as null. */
function LiveChoice({
  task,
  field,
  label,
  options,
  parse,
}: {
  task: Task;
  field: keyof Task;
  label: string;
  options: Array<Option<string>>;
  parse: (draft: string) => unknown;
}) {
  const live = useLiveField('tasks', task.id, field, task[field], {
    immediate: true,
    parse,
    onError: (error) => toast.bad(error.message),
  });
  const inputId = `live-${task.id}-${field}`;
  return (
    <div class={`wb-live wb-task-field${live.saving ? ' is-saving' : ''}`}>
      <label class="wb-label" for={inputId}>
        {label}
      </label>
      <Select id={inputId} value={live.value} options={options} onValue={(next) => live.commit(next)} />
      {live.hint ? (
        <p class="wb-live-hint" role="status">
          {live.hint}
        </p>
      ) : null}
    </div>
  );
}

function ProjectField({ task }: { task: Task }) {
  const projects = useProjects();
  const options = useMemo(() => {
    const list: Array<Option<string>> = [{ value: '', label: 'No project' }];
    for (const project of projects) {
      if (project.status === 'archived' && project.id !== task.project_id) continue;
      list.push({
        value: project.id,
        label: `${project.code} · ${project.name}`,
        group: project.status === 'archived' ? 'Archived' : undefined,
      });
    }
    return list;
  }, [projects, task.project_id]);
  return <LiveChoice task={task} field="project_id" label="Project" options={options} parse={(draft) => draft || null} />;
}

const PROGRESS_OPTIONS: Array<Option<string>> = Array.from({ length: 11 }, (_, index) => ({
  value: String(index * 10),
  label: `${index * 10}%`,
}));

/** Only without a checklist: with one, the ticked fraction is the progress. */
function ProgressField({ task }: { task: Task }) {
  const value = Math.round((task.progress ?? 0) / 10) * 10;
  return (
    <LiveChoice
      task={{ ...task, progress: value }}
      field="progress"
      label="Progress"
      options={PROGRESS_OPTIONS}
      parse={(draft) => Math.max(0, Math.min(100, Number(draft) || 0))}
    />
  );
}

/* -------------------------------------------------------- description --- */

/**
 * Read as rendered text (`**bold**` and bare links), edited as plain text.
 * "Edit" swaps in the textarea; leaving it saves and swaps back.
 */
function Description({ task, editable }: { task: Task; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) wrap.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }, [editing]);

  const paragraphs = task.description.split(/\n{2,}/).filter((part) => part.trim());

  return (
    <section class="wb-task-section" aria-labelledby={`description-${task.id}`}>
      <div class="wb-task-section-head">
        <h3 class="wb-task-section-title" id={`description-${task.id}`}>
          Description
        </h3>
        {editable && !editing && paragraphs.length ? (
          <Button variant="quiet" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div
          ref={wrap}
          onFocusOut={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next && (event.currentTarget as HTMLElement).contains(next)) return;
            // Let the field's own blur save first.
            window.setTimeout(() => setEditing(false), 0);
          }}
        >
          <LiveTextarea
            table="tasks"
            id={task.id}
            field="description"
            value={task.description}
            label="Description"
            hideLabel
            rows={6}
            placeholder="What needs doing, and anything that helps. **Bold** works."
          />
          <p class="wb-hint">Saves when you leave the box. Put two stars either side of a word to make it bold.</p>
        </div>
      ) : paragraphs.length ? (
        <div class="wb-task-description">
          {paragraphs.map((part, index) => (
            <RichText key={index} text={part} />
          ))}
        </div>
      ) : editable ? (
        <Button variant="secondary" size="sm" class="wb-task-add-description" onClick={() => setEditing(true)}>
          Add a description
        </Button>
      ) : (
        <p class="wb-meta">No description.</p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- hours --- */

function HoursLine({ task }: { task: Task }) {
  const taskId = task.id;
  const canLog = useCan('hours.log');
  const hours = useHoursOnTask(taskId);
  // Without hours.view_all the database only hands over your own entries.
  const everyone = useCan('hours.view_all');
  return (
    <section class="wb-task-section wb-task-hours" aria-labelledby={`hours-${taskId}`}>
      <div class="wb-task-section-head">
        <h3 class="wb-task-section-title" id={`hours-${taskId}`}>
          {everyone ? 'Hours logged' : 'Your hours on this task'}
        </h3>
        <span class="wb-task-hours-figure wb-mono">{hours > 0 ? formatHours(hours) : 'None yet'}</span>
        {canLog ? (
          <a class="wb-task-hours-log" href={href('/hours', { log: 1, task: task.id, project: task.project_id })}>
            Log hours
          </a>
        ) : null}
      </div>
    </section>
  );
}
