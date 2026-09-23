/**
 * Project settings, including the JSON editor for `config`.
 *
 * `config` is where everything a grant view needs lives: targets, milestones,
 * workstreams, budget lines, funnel steps. It is edited as JSON on purpose —
 * it is the one place where the shape can grow without a code change, and the
 * people who touch it are administrators. The text is checked before it is
 * saved, and the error says which line is wrong.
 */
import { useEffect, useState } from 'preact/hooks';
import { patchOpenProject, updateProject, useProject } from '../lib/store';
import { isAdmin, useAuth } from '../lib/auth';
import { pickPrimary, setPrimaryProject, useProjectList } from '../lib/projects';
import { toast } from '../lib/toasts';
import type { ProjectConfig, ProjectStatus, Track } from '../lib/types';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Field, Input, Textarea } from '../components/Field';
import { Select } from '../components/Select';

const TRACKS: Array<{ value: Track; label: string }> = [
  { value: 'org', label: 'Organisation (slate)' },
  { value: 'med', label: 'Med (teal)' },
  { value: 'tech', label: 'Tech (indigo)' },
];

const STATUSES: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, canManage } = useProject();
  const auth = useAuth();
  const list = useProjectList();
  const [homeBusy, setHomeBusy] = useState(false);
  const isHome = Boolean(project && pickPrimary(list.projects)?.id === project.id);

  const makeHome = async () => {
    if (!project) return;
    setHomeBusy(true);
    const result = await setPrimaryProject(project.id);
    setHomeBusy(false);
    if (result.ok) {
      patchOpenProject(project.id, { config: { ...project.config, primary: true } });
      setConfigText(JSON.stringify({ ...project.config, primary: true }, null, 2));
      toast.good(`${project.name} is now the home project.`);
    } else {
      toast.bad(result.error?.message ?? 'That did not work.');
    }
  };
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [track, setTrack] = useState<Track>('org');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [configText, setConfigText] = useState('{}');
  const [configError, setConfigError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!project || !open) return;
    setName(project.name);
    setSummary(project.summary ?? '');
    setTrack(project.track);
    setStatus(project.status);
    setConfigText(JSON.stringify(project.config ?? {}, null, 2));
    setConfigError(null);
  }, [project, open]);

  const checkConfig = (text: string): ProjectConfig | null => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setConfigError('Settings have to be a JSON object, starting with { and ending with }.');
        return null;
      }
      setConfigError(null);
      return parsed as ProjectConfig;
    } catch (error) {
      setConfigError(`That is not valid JSON: ${(error as Error).message}`);
      return null;
    }
  };

  const save = async () => {
    if (!project) return;
    const config = checkConfig(configText);
    if (!config) return;
    if (!name.trim()) {
      toast.bad('A name is needed.');
      return;
    }
    setBusy(true);
    const result = await updateProject({
      name: name.trim(),
      summary: summary.trim(),
      track,
      status,
      config,
    });
    setBusy(false);
    if (result.ok) {
      toast.good('Settings saved.');
      onClose();
    } else {
      toast.bad(result.error?.message ?? 'That did not work.');
    }
  };

  const tidy = () => {
    const config = checkConfig(configText);
    if (config) setConfigText(JSON.stringify(config, null, 2));
  };

  return (
    <Dialog
      open={open}
      title="Project settings"
      description={canManage ? undefined : 'You can look, but only a manager can change these.'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!canManage || Boolean(configError)}
            onClick={save}
          >
            Save settings
          </Button>
        </>
      }
    >
      <div class="wb-form">
        <Field label="Name" required>
          {(props) => (
            <Input
              {...props}
              value={name}
              disabled={!canManage}
              onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>

        <Field label="Summary">
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={summary}
              disabled={!canManage}
              onInput={(event) => setSummary((event.currentTarget as HTMLTextAreaElement).value)}
            />
          )}
        </Field>

        <div class="wb-grid-2">
          <Field label="Track" hint="Sets the accent colour inside this project.">
            {(props) => (
              <Select<Track>
                {...props}
                value={track}
                options={TRACKS}
                disabled={!canManage}
                onValue={setTrack}
              />
            )}
          </Field>
          <Field label="Status">
            {(props) => (
              <Select<ProjectStatus>
                {...props}
                value={status}
                options={STATUSES}
                disabled={!canManage}
                onValue={setStatus}
              />
            )}
          </Field>
        </div>

        <div class="wb-home-setting">
          <div>
            <p class="wb-label">Home project</p>
            <p class="wb-hint">
              {isHome
                ? 'This is the home project: the Workbench opens on its Plan and it sits at the top of the sidebar.'
                : 'The Workbench opens on the home project and keeps it at the top of the sidebar.'}
            </p>
          </div>
          {!isHome && isAdmin(auth) && project?.status === 'active' ? (
            <Button variant="secondary" size="sm" busy={homeBusy} onClick={makeHome}>
              Make this the home project
            </Button>
          ) : null}
        </div>

        <Field
          label="Settings (JSON)"
          hint="Targets, milestones, workstreams, report checks, budget lines and funnel steps. The views read this, so nothing about the grant is written into the app itself."
          error={configError}
        >
          {(props) => (
            <Textarea
              {...props}
              class="wb-mono wb-json"
              rows={16}
              spellcheck={false}
              value={configText}
              disabled={!canManage}
              onInput={(event) => {
                const text = (event.currentTarget as HTMLTextAreaElement).value;
                setConfigText(text);
                checkConfig(text);
              }}
            />
          )}
        </Field>

        {canManage ? (
          <div class="wb-form-actions">
            <Button variant="quiet" size="sm" onClick={tidy} disabled={Boolean(configError)}>
              Tidy the JSON
            </Button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
