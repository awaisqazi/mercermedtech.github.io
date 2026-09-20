/**
 * Import a whole project from a file.
 *
 * Four steps, in this order and no other: pick a file, read what is in it,
 * write it, and deal with the result. Nothing is written until the preview has
 * been shown, the slug has been checked, and the person has pressed the
 * button. If a batch fails halfway the dialog offers to delete the project it
 * just made, because half a project is worse than none.
 */
import { useState } from 'preact/hooks';
import {
  deleteProject,
  importProject,
  readProjectFile,
  slugTaken,
  type ImportProgress,
  type ValidationResult,
} from '../lib/transfer';
import { fileSize, slugify } from '../lib/format';
import { navigate } from '../lib/router';
import { toast } from '../lib/toasts';
import type { Project } from '../lib/types';
import { Dialog } from '../components/Dialog';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Bar } from '../components/Bar';
import { IconUpload, IconWarning } from '../components/Icons';

type Phase = 'pick' | 'preview' | 'working' | 'failed' | 'done';

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [filename, setFilename] = useState('');
  const [bytes, setBytes] = useState(0);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [slug, setSlug] = useState('');
  const [collision, setCollision] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ fraction: 0, label: '' });
  const [failure, setFailure] = useState<string>('');
  const [halfMade, setHalfMade] = useState<Project | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const reset = () => {
    setPhase('pick');
    setFilename('');
    setBytes(0);
    setResult(null);
    setSlug('');
    setCollision(false);
    setProgress({ fraction: 0, label: '' });
    setFailure('');
    setHalfMade(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setBytes(file.size);
    const text = await file.text();
    const parsed = readProjectFile(text);
    setResult(parsed);
    if (parsed.file) {
      setSlug(parsed.file.project.slug);
      setCollision(await slugTaken(parsed.file.project.slug));
    }
    setPhase('preview');
    input.value = '';
  };

  const checkSlug = async (next: string) => {
    const clean = slugify(next);
    setSlug(clean);
    if (clean) setCollision(await slugTaken(clean));
  };

  const run = async () => {
    if (!result?.file) return;
    setPhase('working');
    const outcome = await importProject(
      { ...result.file, project: { ...result.file.project, slug } },
      setProgress
    );
    if (outcome.ok && outcome.project) {
      setPhase('done');
      toast.good('Project imported.');
      close();
      navigate(`/p/${outcome.project.slug}/overview`);
      return;
    }
    setFailure(outcome.error?.message ?? 'The import stopped part way.');
    setHalfMade(outcome.project ?? null);
    setPhase('failed');
  };

  const rollback = async () => {
    if (!halfMade) return;
    setCleaning(true);
    const outcome = await deleteProject(halfMade.id);
    setCleaning(false);
    if (outcome.ok) {
      toast.good('The half-made project was removed.');
      close();
    } else {
      toast.bad(outcome.error?.message ?? 'It could not be removed. An owner can delete it.');
    }
  };

  const counts = result?.counts;
  const canImport = Boolean(result?.ok && result.file && slug && !collision);

  return (
    <Dialog
      open={open}
      title="Import a project from a file"
      description="A file in the mmt-project/1 format, as produced by Export JSON."
      onClose={phase === 'working' ? () => undefined : close}
      hideClose={phase === 'working'}
      size="lg"
      footer={
        phase === 'preview' ? (
          <>
            <Button variant="quiet" onClick={reset}>
              Pick another file
            </Button>
            <Button variant="primary" onClick={run} disabled={!canImport}>
              Import {counts ? `${counts.tasks + counts.reports + counts.partners + counts.docs} rows` : ''}
            </Button>
          </>
        ) : phase === 'failed' ? (
          <>
            <Button variant="quiet" onClick={close}>
              Leave it
            </Button>
            {halfMade ? (
              <Button variant="danger" busy={cleaning} onClick={rollback}>
                Delete the half-made project
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {phase === 'pick' ? (
        <div class="wb-import-pick">
          <label class="wb-dropzone">
            <IconUpload size={22} />
            <span class="wb-dropzone-title">Choose a JSON file</span>
            <span class="wb-dropzone-hint">Nothing is written until you have seen what is in it.</span>
            <input type="file" accept="application/json,.json" onChange={pick} />
          </label>
        </div>
      ) : null}

      {phase === 'preview' && result ? (
        <div class="wb-form">
          <p class="wb-mono-soft">
            {filename} · {fileSize(bytes)}
          </p>

          {result.errors.length ? (
            <div class="wb-notice wb-notice-bad">
              <span class="wb-notice-icon" aria-hidden="true">
                <IconWarning size={18} />
              </span>
              <div>
                <p class="wb-notice-title">This file cannot be imported</p>
                <ul class="wb-notice-list">
                  {result.errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {result.file ? (
            <>
              <dl class="wb-kv">
                <div>
                  <dt>Project</dt>
                  <dd>{result.file.project.name}</dd>
                </div>
                <div>
                  <dt>Kind</dt>
                  <dd>{result.file.project.kind === 'grant' ? 'Grant' : 'General project'}</dd>
                </div>
                <div>
                  <dt>Tasks</dt>
                  <dd class="wb-mono">{counts?.tasks ?? 0}</dd>
                </div>
                <div>
                  <dt>Reports</dt>
                  <dd class="wb-mono">{counts?.reports ?? 0}</dd>
                </div>
                <div>
                  <dt>Partners</dt>
                  <dd class="wb-mono">{counts?.partners ?? 0}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd class="wb-mono">{counts?.docs ?? 0}</dd>
                </div>
                <div>
                  <dt>Saved numbers</dt>
                  <dd class="wb-mono">{counts?.state ?? 0}</dd>
                </div>
              </dl>

              <Field
                label="Short name"
                error={collision ? 'A project already uses that short name. Change it.' : null}
                hint="This is the address the project will live at."
              >
                {(props) => (
                  <Input
                    {...props}
                    class="wb-mono"
                    value={slug}
                    onInput={(event) => void checkSlug((event.currentTarget as HTMLInputElement).value)}
                  />
                )}
              </Field>
            </>
          ) : null}

          {result.warnings.length ? (
            <details class="wb-details">
              <summary>{result.warnings.length} thing(s) were tidied up on the way in</summary>
              <ul class="wb-notice-list">
                {result.warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {phase === 'working' ? (
        <div class="wb-import-progress">
          <p class="wb-prose">{progress.label}</p>
          <Bar
            value={progress.fraction}
            title={`Import ${Math.round(progress.fraction * 100)} percent done`}
            height={10}
          />
          <p class="wb-hint">Leave this open until it finishes.</p>
        </div>
      ) : null}

      {phase === 'failed' ? (
        <div class="wb-notice wb-notice-bad">
          <span class="wb-notice-icon" aria-hidden="true">
            <IconWarning size={18} />
          </span>
          <div>
            <p class="wb-notice-title">The import stopped part way</p>
            <p class="wb-notice-body">{failure}</p>
            {halfMade ? (
              <p class="wb-notice-body">
                A project called {halfMade.name} was created before it stopped. Deleting it is usually
                the cleanest way to start again.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
