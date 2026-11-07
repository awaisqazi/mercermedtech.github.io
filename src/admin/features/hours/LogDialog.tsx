/**
 * The Log hours dialog, for a new entry and for editing one.
 *
 * Four things to say (date, hours, project, task) and one sentence about the
 * work. Everything the database would refuse is said here first: a day that
 * would pass 24 hours, a date in a closed month, an empty summary.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DateInput } from '../../components/DateInput';
import { Field, Textarea } from '../../components/Field';
import { HoursInput } from '../../components/HoursInput';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { useAuth } from '../../lib/auth';
import { formatHours, formatHoursNumber, MAX_HOURS, monthLabel, sumHours } from '../../lib/hours';
import { toast } from '../../lib/toasts';
import type { Project, Task, TimeEntry } from '../../lib/types';
import {
  deleteEntry,
  logHours,
  nameOf,
  updateEntry,
  useMonthClosed,
  useProjects,
  useTasks,
  useTimeEntries,
} from '../../lib/workspace';
import { dayWording, dayWordingLong } from './shared';
import { TaskPicker } from './TaskPicker';

export interface LogDialogProps {
  /** The entry being edited, or null for a new one. */
  entry: TimeEntry | null;
  /** The date a new entry starts on. */
  initialDate: string;
  /** Preselected for a new entry, from `task=` and `project=` in the address. */
  initialTaskId?: string | null;
  initialProjectId?: string | null;
  onClose: () => void;
  /** Called with the date that was saved, so the week can follow it. */
  onSaved: (date: string) => void;
}

const SUMMARY_MAX = 1000;
const FORM_ID = 'hours-log-form';

export function LogDialog({ entry, initialDate, initialTaskId = null, initialProjectId = null, onClose, onSaved }: LogDialogProps) {
  const me = useAuth().userId;
  const owner = entry?.user_id ?? me ?? undefined;
  const allProjects = useProjects();
  const allTasks = useTasks();

  const [date, setDate] = useState<string | null>(entry?.work_date ?? initialDate);
  const [hours, setHours] = useState<number>(entry?.hours ?? 1);
  const startTask = entry ? entry.task_id : (allTasks.find((row) => row.id === initialTaskId)?.id ?? null);
  const startProject = entry
    ? entry.project_id
    : (allProjects.find((row) => row.id === initialProjectId)?.id ??
      allTasks.find((row) => row.id === startTask)?.project_id ??
      null);
  const [projectId, setProjectId] = useState<string | null>(startProject ?? null);
  const [taskId, setTaskId] = useState<string | null>(startTask ?? null);
  const someoneElse = Boolean(entry && me && entry.user_id !== me);
  const [summary, setSummary] = useState(entry?.summary ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  // The shared Modal's "first field" lookup also matches the close button, so
  // put the cursor in the date box ourselves (this effect runs after Modal's).
  useEffect(() => {
    document.querySelector<HTMLElement>(`#${FORM_ID} input[type="date"]`)?.focus();
  }, []);

  const projects = useMemo(() => {
    const live = allProjects.filter((project) => project.status === 'active' || project.id === entry?.project_id);
    return live;
  }, [allProjects, entry?.project_id]);
  const projectMap = useMemo(() => new Map<string, Project>(allProjects.map((project) => [project.id, project])), [allProjects]);

  // Tasks for the chosen project, or all of them. The task already on the
  // entry is always offered, so editing never silently drops it.
  const tasks = useMemo(
    () => allTasks.filter((task) => (projectId ? task.project_id === projectId : true) || task.id === taskId),
    [allTasks, projectId, taskId]
  );

  // What is already logged on the chosen day, to keep the day within 24 hours.
  const day = useTimeEntries({ from: date ?? initialDate, to: date ?? initialDate, userId: owner });
  const others = sumHours(day.entries.filter((row) => row.id !== entry?.id));
  const dayTotal = sumHours([{ hours: others }, { hours }]);
  const overLimit = Boolean(date) && !day.loading && dayTotal > MAX_HOURS;

  const closed = useMonthClosed(date);

  const dateError = !date
    ? tried
      ? 'Pick the day you worked.'
      : null
    : closed
      ? `${monthLabel(date)} is closed. Pick a day in an open month.`
      : null;
  const summaryError = tried && !summary.trim() ? 'Say what you worked on.' : null;
  const hoursError = overLimit
    ? `That makes ${formatHours(dayTotal)} for ${dayWording(date!)}, and a day holds ${MAX_HOURS} h. You already have ${formatHours(others)} logged that day.`
    : null;
  const blocked = Boolean(dateError && date) || overLimit;
  const hoursHint =
    date && !day.loading && !overLimit && others > 0
      ? `${formatHours(others)} already logged on ${dayWording(date)}. This makes ${formatHours(dayTotal)}.`
      : undefined;

  const pickProject = (value: string) => {
    const next = value || null;
    setProjectId(next);
    if (taskId) {
      const task = allTasks.find((row) => row.id === taskId);
      if (next && task && task.project_id !== next) setTaskId(null);
    }
  };

  const pickTask = (task: Task | null) => {
    setTaskId(task?.id ?? null);
    if (task?.project_id && !projectId) setProjectId(task.project_id);
  };

  const save = async (event: Event) => {
    event.preventDefault();
    setTried(true);
    if (!date || !summary.trim() || blocked || busy) return;
    setBusy(true);
    const clean = summary.trim();
    const result = entry
      ? await updateEntry(entry.id, {
          work_date: date,
          hours,
          summary: clean,
          project_id: projectId,
          task_id: taskId,
        })
      : await logHours({ work_date: date, hours, summary: clean, project_id: projectId, task_id: taskId });
    setBusy(false);
    if (!result.ok) return; // the store has already said why, in its own words
    toast.good(entry ? `Saved ${formatHours(hours)} for ${dayWording(date)}.` : `Logged ${formatHours(hours)} for ${dayWording(date)}.`);
    onSaved(date);
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    setBusy(true);
    const result = await deleteEntry(entry.id);
    setBusy(false);
    if (!result.ok) return;
    setAsking(false);
    toast.good('Entry deleted.');
    onClose();
  };

  const onFormKeyDown = (event: KeyboardEvent) => {
    // Enter in the hours box settles the number; it should not also send the form.
    const target = event.target as HTMLElement;
    if (event.key === 'Enter' && target.classList.contains('wb-stepper-input')) event.preventDefault();
  };

  return (
    <>
      <Modal
        open
        title={entry ? 'Edit hours' : 'Log hours'}
        onClose={onClose}
        size="md"
        class="wb-dialog hours-dialog"
        footer={
          <>
            {entry ? (
              <Button variant="quiet" class="hours-delete" disabled={busy} onClick={() => setAsking(true)}>
                Delete
              </Button>
            ) : null}
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={FORM_ID} busy={busy} disabled={blocked}>
              {entry ? 'Save' : 'Log hours'}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} class="wb-form hours-form" onSubmit={save} onKeyDown={onFormKeyDown} noValidate>
          {someoneElse && entry ? <p class="wb-meta hours-owner">These are {nameOf(entry.user_id)}'s hours.</p> : null}
          <div class="hours-form-row">
            <DateInput
              label="Date"
              value={date}
              onChange={setDate}
              shortcuts={['today', 'yesterday']}
              error={dateError}
              required
            />
            <HoursInput label="Hours" value={hours} onChange={setHours} error={hoursError} hint={hoursHint} />
          </div>

          <Field label="Project" hint="Optional.">
            {(props) => (
              <Select
                {...props}
                value={projectId ?? ''}
                placeholder="No project"
                options={projects.map((project) => ({
                  value: project.id,
                  label: `${project.code} ${project.name}`,
                }))}
                onValue={pickProject}
              />
            )}
          </Field>

          <TaskPicker
            label="Task"
            value={taskId}
            tasks={tasks}
            projects={projectMap}
            onChange={pickTask}
            hint={projectId ? 'Optional. Showing tasks in this project, open ones first.' : 'Optional. Open tasks come first.'}
          />

          <Field
            label="What did you work on?"
            required
            error={summaryError}
            hint={summary.length > SUMMARY_MAX - 150 ? `${summary.length} of ${SUMMARY_MAX} characters.` : undefined}
          >
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                maxLength={SUMMARY_MAX}
                value={summary}
                onInput={(event) => setSummary((event.currentTarget as HTMLTextAreaElement).value)}
              />
            )}
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={asking}
        tone="danger"
        busy={busy}
        title="Delete this entry?"
        body={
          entry
            ? `${formatHoursNumber(entry.hours)} h on ${dayWordingLong(entry.work_date)}: ${entry.summary}`
            : undefined
        }
        confirmLabel="Delete entry"
        cancelLabel="Keep it"
        onConfirm={remove}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
