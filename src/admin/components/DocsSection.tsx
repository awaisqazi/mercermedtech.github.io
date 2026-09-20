/**
 * A set of documents from one `project_docs` section, rendered as long-form
 * reference with an optional sticky list down the side. Editors can change one
 * in place with the block editor, add another, or remove one.
 *
 * Used for the Rulebook in a grant and for Notes in a general project, and
 * available to any grant tab that wants its own `notes:<tab>` section.
 */
import { useState } from 'preact/hooks';
import { deleteRow, insertRow, updateRow, useDocs, useProject } from '../lib/store';
import { slugify } from '../lib/format';
import { toast } from '../lib/toasts';
import type { DocBlock, ProjectDoc } from '../lib/types';
import { BlockEditor } from './BlockEditor';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { DocBlocks } from './DocBlocks';
import { EmptyState } from './EmptyState';
import { SourcesList } from './SourcesList';
import { IconDocument, IconPlus, IconTrash } from './Icons';

export interface DocsSectionProps {
  section: string;
  title?: string;
  /** One sentence above the list. */
  intro?: string;
  /** Shows the sticky list of documents beside the content. */
  withIndex?: boolean;
  emptyBody?: string;
}

export function DocsSection({
  section,
  title,
  intro,
  withIndex = false,
  emptyBody = 'Nothing has been written here yet.',
}: DocsSectionProps) {
  const docs = useDocs(section);
  const { readOnly } = useProject();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ProjectDoc | null>(null);

  const addDoc = async () => {
    const result = await insertRow<ProjectDoc>('project_docs', {
      section,
      slug: `note-${Date.now().toString(36)}`,
      title: 'Untitled note',
      body: [{ t: 'p', text: '' }],
      sources: [],
      sort: docs.length * 10,
    });
    if (result.ok && result.row) setEditingId(result.row.id);
    else if (result.error) toast.bad(result.error.message);
  };

  const save = async (doc: ProjectDoc, next: { title: string; body: DocBlock[] }) => {
    setSaving(true);
    const patch: Record<string, unknown> = { title: next.title || 'Untitled note', body: next.body };
    // Keep the slug in step with the title while it is still the default one.
    if (doc.slug.startsWith('note-') && next.title) patch.slug = slugify(next.title) || doc.slug;
    const result = await updateRow('project_docs', doc.id, patch);
    setSaving(false);
    if (result.ok) {
      setEditingId(null);
      toast.good('Saved.');
    } else if (result.error) {
      toast.bad(result.error.message);
    }
  };

  return (
    <section class={`wb-docs${withIndex ? ' has-index' : ''}`}>
      {withIndex && docs.length > 1 ? (
        <nav class="wb-docs-index" aria-label={title ? `${title} contents` : 'Contents'}>
          <p class="wb-docs-index-head">On this page</p>
          <ul>
            {docs.map((doc) => (
              <li key={doc.id}>
                <a href={`#doc-${doc.slug}`}>{doc.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div class="wb-docs-body">
        {title || intro || !readOnly ? (
          <header class="wb-panel-head">
            <div>
              {title ? <h2 class="wb-panel-title">{title}</h2> : null}
              {intro ? <p class="wb-page-sub">{intro}</p> : null}
            </div>
            {readOnly ? null : (
              <Button variant="secondary" size="sm" icon={<IconPlus size={15} />} onClick={addDoc}>
                Add a note
              </Button>
            )}
          </header>
        ) : null}

        {docs.length === 0 ? (
          <EmptyState
            icon={<IconDocument size={22} />}
            title="Nothing written here yet"
            body={emptyBody}
            action={
              readOnly ? null : (
                <Button variant="primary" icon={<IconPlus size={16} />} onClick={addDoc}>
                  Add the first note
                </Button>
              )
            }
          />
        ) : (
          docs.map((doc) =>
            editingId === doc.id ? (
              <article class="wb-panel" key={doc.id}>
                <BlockEditor
                  title={doc.title}
                  blocks={doc.body ?? []}
                  saving={saving}
                  onCancel={() => setEditingId(null)}
                  onSave={(next) => save(doc, next)}
                />
              </article>
            ) : (
              <article class="wb-panel wb-doc-card" id={`doc-${doc.slug}`} key={doc.id}>
                <header class="wb-doc-card-head">
                  <h3 class="wb-panel-title">{doc.title}</h3>
                  {readOnly ? null : (
                    <div class="wb-toolbar">
                      <Button variant="quiet" size="sm" onClick={() => setEditingId(doc.id)}>
                        Edit
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        iconOnly
                        aria-label={`Delete ${doc.title}`}
                        icon={<IconTrash size={15} />}
                        onClick={() => setDeleting(doc)}
                      />
                    </div>
                  )}
                </header>

                <DocBlocks blocks={doc.body ?? []} />

                <SourcesList
                  sources={doc.sources ?? []}
                  title="Where this comes from"
                  readOnly={readOnly}
                  compact
                  onChange={async (next) => {
                    const result = await updateRow('project_docs', doc.id, { sources: next });
                    if (!result.ok && result.error) toast.bad(result.error.message);
                  }}
                />
              </article>
            )
          )
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={deleting ? `Delete "${deleting.title}"?` : 'Delete this note?'}
        body="This removes it for everyone. It cannot be undone from here."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteRow('project_docs', deleting.id);
          setDeleting(null);
          if (result.ok) toast.good('Deleted.');
          else if (result.error) toast.bad(result.error.message);
        }}
      />
    </section>
  );
}
