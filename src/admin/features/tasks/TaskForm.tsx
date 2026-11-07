/**
 * New task: a dialog over the list (`?new=1`). Only the title is required.
 * The current filters fill the obvious defaults (the project being looked
 * at, "mine" means assigned to me). Once saved, the task opens in the drawer
 * so a checklist can go straight on.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { Dialog } from '../../components/Dialog';
import { Checkbox, Field, Input, Textarea } from '../../components/Field';
import { PersonPicker } from '../../components/PersonPicker';
import { Select, optionsFrom, type Option } from '../../components/Select';
import { useAuth } from '../../lib/auth';
import { useCan } from '../../lib/perms';
import { patchQuery } from '../../lib/router';
import { PRIORITY_LABEL, TASK_PRIORITIES, type TaskPriority } from '../../lib/types';
import { createTask, useProjects } from '../../lib/workspace';
import { NONE, type TaskFilters } from './filters';

export function NewTask({ filters, onClose }: { filters: TaskFilters; onClose: () => void }) {
  const me = useAuth().userId;
  const mayAssign = useCan('tasks.assign');
  const projects = useProjects();

  const startAssignee = filters.person && filters.person !== NONE && mayAssign ? filters.person : filters.scope === 'mine' ? me : null;
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(filters.project && filters.project !== NONE ? filters.project : '');
  const [assignee, setAssignee] = useState<string | null>(startAssignee);
  const [mine, setMine] = useState(true);
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [due, setDue] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Modal's "first field" lookup scopes only the first selector of its list,
  // so it lands on the Close button; put the cursor in the title ourselves.
  // A timeout, so it runs after the Modal's own focus move.
  useEffect(() => {
    const timer = window.setTimeout(() => document.querySelector<HTMLInputElement>('#new-task-form input')?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const projectOptions = useMemo<Array<Option<string>>>(
    () => [
      { value: '', label: 'No project' },
      ...projects
        .filter((project) => project.status === 'active')
        .map((project) => ({ value: project.id, label: `${project.code} · ${project.name}` })),
    ],
    [projects]
  );

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setError('Give the task a title.');
      document.querySelector<HTMLInputElement>('#new-task-form input')?.focus();
      return;
    }
    setBusy(true);
    const result = await createTask({
      title,
      project_id: projectId || null,
      assignee_id: mayAssign ? assignee : mine ? me : null,
      priority,
      due,
      description: description.trim(),
    });
    setBusy(false);
    if (!result.ok || !result.row) return;
    patchQuery({ new: null, task: result.row.id }, { replace: true });
  };

  return (
    <Dialog
      open
      title="New task"
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-task-form" busy={busy}>
            Make the task
          </Button>
        </>
      }
    >
      <form id="new-task-form" class="wb-form wb-task-form" onSubmit={submit} noValidate>
        <Field label="Title" required error={error}>
          {(props) => (
            <Input
              {...props}
              type="text"
              value={title}
              maxLength={200}
              autoComplete="off"
              placeholder="What needs doing"
              onInput={(event) => {
                setTitle((event.currentTarget as HTMLInputElement).value);
                if (error) setError(null);
              }}
            />
          )}
        </Field>
        <div class="wb-task-form-grid">
          <Field label="Project">
            {(props) => <Select {...props} value={projectId} options={projectOptions} onValue={setProjectId} />}
          </Field>
          <Field label="Priority">
            {(props) => (
              <Select<TaskPriority>
                {...props}
                value={priority}
                options={optionsFrom(TASK_PRIORITIES, PRIORITY_LABEL)}
                onValue={setPriority}
              />
            )}
          </Field>
          {mayAssign ? (
            <PersonPicker label="Assignee" value={assignee} onChange={setAssignee} />
          ) : (
            <div class="wb-field wb-task-form-mine">
              <Checkbox
                label="Assign it to me"
                checked={mine}
                onChange={(event) => setMine((event.currentTarget as HTMLInputElement).checked)}
              />
            </div>
          )}
          <DateInput label="Due" value={due} onChange={setDue} shortcuts={['tomorrow', 'next-week']} clearable />
        </div>
        <Field label="Description" hint="Optional. Put two stars either side of a word to make it bold.">
          {(props) => (
            <Textarea
              {...props}
              rows={4}
              value={description}
              maxLength={8000}
              onInput={(event) => setDescription((event.currentTarget as HTMLTextAreaElement).value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
