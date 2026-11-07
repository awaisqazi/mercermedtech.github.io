/**
 * New project / edit project. The code is 2 to 6 capital letters or digits;
 * it is upper-cased as you type. The lead is any active person.
 */
import { useId, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Textarea } from '../../components/Field';
import { PersonPicker } from '../../components/PersonPicker';
import { Select } from '../../components/Select';
import { PROJECT_STATUS_LABEL, TRACKS, TRACK_LABEL, type Project, type ProjectStatus, type Track } from '../../lib/types';
import { saveProject, useProjects } from '../../lib/workspace';

const CODE = /^[A-Z0-9]{2,6}$/;

/** Mounted only while open, so every opening starts from the project's own values. */
export function ProjectDialog({ project, open, onClose }: { project: Project | null; open: boolean; onClose: () => void }) {
  return open ? <ProjectForm key={project?.id ?? 'new'} project={project} onClose={onClose} /> : null;
}

function ProjectForm({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const projects = useProjects();
  const formId = useId();

  const [name, setName] = useState(project?.name ?? '');
  const [code, setCode] = useState(project?.code ?? '');
  const [track, setTrack] = useState<Track>(project?.track ?? 'org');
  const [summary, setSummary] = useState(project?.summary ?? '');
  const [leadId, setLeadId] = useState<string | null>(project?.lead_id ?? null);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'active');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});

  const submit = async (event: Event) => {
    event.preventDefault();
    const next: { name?: string; code?: string } = {};
    const cleanCode = code.trim().toUpperCase();
    if (!name.trim()) next.name = 'Give the project a name.';
    if (!CODE.test(cleanCode)) next.code = 'Use 2 to 6 capital letters or digits, like WEB or DLT2.';
    else if (projects.some((row) => row.code === cleanCode && row.id !== project?.id)) {
      next.code = 'Another project already uses that code.';
    }
    setErrors(next);
    if (next.name || next.code) return;

    setBusy(true);
    const result = await saveProject({
      id: project?.id,
      name: name.trim(),
      code: cleanCode,
      track,
      summary: summary.trim(),
      lead_id: leadId,
      status,
    });
    setBusy(false);
    if (result.ok) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} busy={busy}>
            {project ? 'Save project' : 'Create project'}
          </Button>
        </>
      }
    >
      <form class="wb-form" id={formId} onSubmit={submit} noValidate>
        <Field label="Name" required error={errors.name}>
          {(props) => (
            <Input
              {...props}
              value={name}
              maxLength={80}
              autoComplete="off"
              onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>
        <div class="wb-form-pair">
          <Field label="Code" required hint="2 to 6 capital letters or digits." error={errors.code}>
            {(props) => (
              <Input
                {...props}
                class="wb-input-code"
                value={code}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                spellcheck={false}
                onInput={(event) => setCode((event.currentTarget as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
            )}
          </Field>
          <Field label="Track">
            {(props) => (
              <Select
                {...props}
                value={track}
                onValue={setTrack}
                options={TRACKS.map((key) => ({ value: key, label: TRACK_LABEL[key] }))}
              />
            )}
          </Field>
        </div>
        <Field label="Summary (optional)">
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={summary}
              onInput={(event) => setSummary((event.currentTarget as HTMLTextAreaElement).value)}
            />
          )}
        </Field>
        <PersonPicker label="Lead" value={leadId} onChange={setLeadId} noneLabel="No lead" />
        <Field label="Status">
          {(props) => (
            <Select
              {...props}
              value={status}
              onValue={setStatus}
              options={(['active', 'archived'] as const).map((key) => ({ value: key, label: PROJECT_STATUS_LABEL[key] }))}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
