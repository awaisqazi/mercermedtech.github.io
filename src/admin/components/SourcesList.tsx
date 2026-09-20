/**
 * "Where this comes from": a list of pointers to originals that live elsewhere
 * (a folder in OneDrive, a thread in email, a page on the web). The portal
 * never hosts the file itself, so a source is a name, a place and a note.
 *
 * A `web` source whose `where` is an https address renders as a link; every
 * other kind stays plain text, because "C:\Users\..." is not somewhere a
 * browser can go.
 */
import { useState } from 'preact/hooks';
import { SOURCE_KINDS, SOURCE_KIND_LABEL, type Source, type SourceKind } from '../lib/types';
import { Button } from './Button';
import { Field, Input } from './Field';
import { Select } from './Select';
import { Chip } from './Chip';
import { IconPlus, IconTrash } from './Icons';

export interface SourcesListProps {
  sources: Source[];
  title?: string;
  readOnly?: boolean;
  onChange?: (next: Source[]) => void;
  /** Collapses to a summary line until opened. */
  compact?: boolean;
}

const isWebLink = (source: Source) =>
  source.kind === 'web' && /^https:\/\//i.test((source.where ?? '').trim());

export function SourcesList({
  sources,
  title = 'Sources',
  readOnly = true,
  onChange,
  compact = false,
}: SourcesListProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Source>({ kind: 'onedrive', name: '', where: '', note: '' });

  const add = () => {
    if (!draft.name.trim()) return;
    onChange?.([...sources, { ...draft, name: draft.name.trim(), where: draft.where.trim() }]);
    setDraft({ kind: 'onedrive', name: '', where: '', note: '' });
    setAdding(false);
  };

  const remove = (index: number) => {
    onChange?.(sources.filter((_, position) => position !== index));
  };

  if (compact && !sources.length && readOnly) return null;

  return (
    <section class="wb-sources">
      <h4 class="wb-sources-title">{title}</h4>
      {sources.length ? (
        <ul class="wb-sources-list">
          {sources.map((source, index) => (
            <li class="wb-source" key={`${source.name}-${index}`}>
              <Chip tone="quiet">{SOURCE_KIND_LABEL[source.kind] ?? source.kind}</Chip>
              <span class="wb-source-body">
                <span class="wb-source-name">{source.name}</span>
                {source.where ? (
                  isWebLink(source) ? (
                    <a
                      class="wb-source-where"
                      href={source.where}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.where}
                    </a>
                  ) : (
                    <span class="wb-source-where wb-mono-soft">{source.where}</span>
                  )
                ) : null}
                {source.note ? <span class="wb-source-note">{source.note}</span> : null}
              </span>
              {readOnly ? null : (
                <Button
                  variant="quiet"
                  size="sm"
                  iconOnly
                  aria-label={`Remove source ${source.name}`}
                  icon={<IconTrash size={15} />}
                  onClick={() => remove(index)}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p class="wb-sources-empty">Nothing recorded yet.</p>
      )}

      {readOnly ? null : adding ? (
        <div class="wb-source-form">
          <Field label="Kind">
            {(props) => (
              <Select<SourceKind>
                {...props}
                value={draft.kind}
                options={SOURCE_KINDS.map((kind) => ({ value: kind, label: SOURCE_KIND_LABEL[kind] }))}
                onValue={(kind) => setDraft((current) => ({ ...current, kind }))}
              />
            )}
          </Field>
          <Field label="Name" required>
            {(props) => (
              <Input
                {...props}
                value={draft.name}
                placeholder="What the document is called"
                onInput={(event) =>
                  setDraft((current) => ({ ...current, name: (event.currentTarget as HTMLInputElement).value }))
                }
              />
            )}
          </Field>
          <Field label="Where it lives" hint="A folder path, a link, or the subject of an email.">
            {(props) => (
              <Input
                {...props}
                value={draft.where}
                onInput={(event) =>
                  setDraft((current) => ({ ...current, where: (event.currentTarget as HTMLInputElement).value }))
                }
              />
            )}
          </Field>
          <Field label="Note">
            {(props) => (
              <Input
                {...props}
                value={draft.note ?? ''}
                onInput={(event) =>
                  setDraft((current) => ({ ...current, note: (event.currentTarget as HTMLInputElement).value }))
                }
              />
            )}
          </Field>
          <div class="wb-source-form-actions">
            <Button variant="quiet" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={add} disabled={!draft.name.trim()}>
              Add source
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="quiet" size="sm" icon={<IconPlus size={15} />} onClick={() => setAdding(true)}>
          Add a source
        </Button>
      )}
    </section>
  );
}
