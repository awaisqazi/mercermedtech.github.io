/**
 * Creating a project by hand. Everything except the name is optional and can
 * be changed later in Settings, including the grant fields, which are written
 * straight into `config` so that no grant detail is ever hardcoded in the app.
 */
import { useState } from 'preact/hooks';
import { createProject } from '../lib/queries';
import { slugify } from '../lib/format';
import { navigate } from '../lib/router';
import { toast } from '../lib/toasts';
import type { ProjectKind, Track } from '../lib/types';
import { Dialog } from '../components/Dialog';
import { Button } from '../components/Button';
import { Field, Input, Textarea } from '../components/Field';
import { Select } from '../components/Select';

const KINDS: Array<{ value: ProjectKind; label: string }> = [
  { value: 'general', label: 'General project' },
  { value: 'grant', label: 'Grant' },
];

const TRACKS: Array<{ value: Track; label: string }> = [
  { value: 'org', label: 'Organisation' },
  { value: 'med', label: 'Med' },
  { value: 'tech', label: 'Tech' },
];

export function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<ProjectKind>('general');
  const [track, setTrack] = useState<Track>('org');
  const [summary, setSummary] = useState('');
  const [funder, setFunder] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [award, setAward] = useState('');
  const [termStart, setTermStart] = useState('');
  const [termEnd, setTermEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slugify(slug) : slugify(name);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('A name is needed.');
      return;
    }
    if (!effectiveSlug) {
      setError('A short name made of letters and numbers is needed.');
      return;
    }

    const config: Record<string, unknown> = {};
    if (kind === 'grant') {
      if (funder.trim()) config.funder = funder.trim();
      if (contractNo.trim()) config.contract_no = contractNo.trim();
      const amount = Number(award);
      if (award.trim() && Number.isFinite(amount)) config.award = amount;
      if (termStart) config.term_start = termStart;
      if (termEnd) config.term_end = termEnd;
    }

    setBusy(true);
    const result = await createProject({
      slug: effectiveSlug,
      name: name.trim(),
      kind,
      track,
      summary: summary.trim(),
      config,
    });
    setBusy(false);

    if (result.ok && result.project) {
      toast.good('Project created.');
      onClose();
      navigate(`/p/${result.project.slug}/plan`);
    } else {
      setError(result.error?.message ?? 'That did not work.');
    }
  };

  return (
    <Dialog
      open={open}
      title="New project"
      description="You can change any of this later."
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={submit}>
            Create project
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
              onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>

        <Field label="Short name" hint="Used in the address. Letters, numbers and hyphens.">
          {(props) => (
            <Input
              {...props}
              class="wb-mono"
              value={slugTouched ? slug : effectiveSlug}
              onInput={(event) => {
                setSlugTouched(true);
                setSlug((event.currentTarget as HTMLInputElement).value);
              }}
            />
          )}
        </Field>

        <div class="wb-grid-2">
          <Field label="Kind">
            {(props) => (
              <Select<ProjectKind> {...props} value={kind} options={KINDS} onValue={setKind} />
            )}
          </Field>
          <Field label="Track" hint="Sets the accent colour inside the project.">
            {(props) => <Select<Track> {...props} value={track} options={TRACKS} onValue={setTrack} />}
          </Field>
        </div>

        <Field label="Summary" hint="One or two lines, shown on the project card.">
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={summary}
              onInput={(event) => setSummary((event.currentTarget as HTMLTextAreaElement).value)}
            />
          )}
        </Field>

        {kind === 'grant' ? (
          <fieldset class="wb-fieldset">
            <legend>Grant details</legend>
            <div class="wb-grid-2">
              <Field label="Funder">
                {(props) => (
                  <Input
                    {...props}
                    value={funder}
                    onInput={(event) => setFunder((event.currentTarget as HTMLInputElement).value)}
                  />
                )}
              </Field>
              <Field label="Contract number">
                {(props) => (
                  <Input
                    {...props}
                    class="wb-mono"
                    value={contractNo}
                    onInput={(event) => setContractNo((event.currentTarget as HTMLInputElement).value)}
                  />
                )}
              </Field>
              <Field label="Award">
                {(props) => (
                  <Input
                    {...props}
                    class="wb-mono"
                    type="number"
                    inputMode="decimal"
                    value={award}
                    onInput={(event) => setAward((event.currentTarget as HTMLInputElement).value)}
                  />
                )}
              </Field>
              <div />
              <Field label="Term starts">
                {(props) => (
                  <Input
                    {...props}
                    class="wb-mono"
                    type="date"
                    value={termStart}
                    onInput={(event) => setTermStart((event.currentTarget as HTMLInputElement).value)}
                  />
                )}
              </Field>
              <Field label="Term ends">
                {(props) => (
                  <Input
                    {...props}
                    class="wb-mono"
                    type="date"
                    value={termEnd}
                    onInput={(event) => setTermEnd((event.currentTarget as HTMLInputElement).value)}
                  />
                )}
              </Field>
            </div>
          </fieldset>
        ) : null}

        {error ? <p class="wb-error">{error}</p> : null}
      </div>
    </Dialog>
  );
}
