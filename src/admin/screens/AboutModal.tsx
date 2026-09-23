/**
 * About this project: the reference material that used to sit on the surface
 * (the long description, the contract number, the funding sentence, the
 * Overview's "what this grant is", the whole Rulebook tab), gathered into one
 * well-set reading panel opened from the header.
 *
 * Sections, in order: each `about` document (for a grant these are "What this
 * grant is", "How it is judged", "The four deliverables"), the Rulebook, the
 * sources behind all of them, and the contract facts from `config`. It is for
 * reading: a search box narrows every section at once, and the panel reopens
 * on the section you last read. Editors can still change the documents, from
 * the "Edit" link at the foot of a section.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useDocs, useProject } from '../lib/store';
import { formatDateLong, money } from '../lib/format';
import type { DocBlock, ProjectDoc, Source } from '../lib/types';
import { DocBlocks } from '../components/DocBlocks';
import { DocsSection } from '../components/DocsSection';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { SourcesList } from '../components/SourcesList';
import { Button } from '../components/Button';
import { IconSearch } from '../components/Icons';

const LAST_KEY = 'wb.about.';

function blockText(block: DocBlock): string {
  switch (block.t) {
    case 'ul':
      return block.items.join(' ');
    case 'kv':
      return block.rows.map((row) => row.join(' ')).join(' ');
    default:
      return block.text;
  }
}

const docText = (doc: ProjectDoc) => [doc.title, ...(doc.body ?? []).map(blockText)].join(' ').toLowerCase();

interface Section {
  key: string;
  label: string;
  /** The documents this section shows (empty for the generated ones). */
  docs: ProjectDoc[];
  /** The `project_docs` section an editor would change. */
  editSection?: string;
  text: string;
}

export function AboutModal({
  open,
  section,
  onSection,
  onClose,
}: {
  open: boolean;
  section: string;
  onSection: (key: string) => void;
  onClose: () => void;
}) {
  const { project, config, readOnly } = useProject();
  const about = useDocs('about');
  const rulebook = useDocs('rulebook');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);

  const facts = useMemo(() => {
    const rows: Array<[string, string]> = [];
    if (config.funder) rows.push(['Funder', String(config.funder)]);
    if (config.contract_no) rows.push(['Contract number', String(config.contract_no)]);
    if (config.term_start && config.term_end) {
      rows.push(['Term', `${formatDateLong(config.term_start)} to ${formatDateLong(config.term_end)}`]);
    }
    if (Number(config.award)) rows.push(['Award', money(Number(config.award))]);
    return rows;
  }, [config]);

  const fundingSentence =
    typeof config.funding_sentence === 'string' ? config.funding_sentence.trim() : '';

  const sections: Section[] = useMemo(() => {
    const list: Section[] = about.map((doc) => ({
      key: `doc-${doc.slug}`,
      label: doc.title || 'About',
      docs: [doc],
      editSection: 'about',
      text: docText(doc),
    }));
    if (!about.length && project?.summary) {
      list.push({ key: 'summary', label: 'In short', docs: [], text: project.summary.toLowerCase() });
    }
    list.push({
      key: 'rulebook',
      label: 'Rulebook',
      docs: rulebook,
      editSection: 'rulebook',
      text: rulebook.map(docText).join(' '),
    });
    list.push({
      key: 'sources',
      label: 'Sources',
      docs: [],
      text: [...about, ...rulebook]
        .flatMap((doc) => doc.sources ?? [])
        .map((source) => `${source.name} ${source.where} ${source.note ?? ''}`)
        .join(' ')
        .toLowerCase(),
    });
    list.push({
      key: 'contract',
      label: project?.kind === 'grant' ? 'Contract facts' : 'Project facts',
      docs: [],
      text: [...facts.flat(), fundingSentence, project?.summary ?? ''].join(' ').toLowerCase(),
    });
    return list;
  }, [about, rulebook, facts, fundingSentence, project?.summary, project?.kind]);

  // "start" means "wherever you were last time", or the first section.
  const remembered = () => {
    try {
      return window.localStorage.getItem(LAST_KEY + (project?.id ?? '')) ?? '';
    } catch {
      return '';
    }
  };
  const wanted = section === 'start' || !section ? remembered() : section;
  const active = sections.find((entry) => entry.key === wanted) ?? sections[0]!;

  useEffect(() => {
    if (!open || !project) return;
    try {
      window.localStorage.setItem(LAST_KEY + project.id, active.key);
    } catch {
      /* next time it opens at the top, that is all */
    }
    body.current?.scrollTo?.({ top: 0 });
  }, [open, active.key, project?.id]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setEditing(null);
    }
  }, [open]);

  const needle = query.trim().toLowerCase();
  const hits = needle ? sections.filter((entry) => entry.text.includes(needle)) : [];

  const allSources: Array<Source & { from: string }> = [...about, ...rulebook].flatMap((doc) =>
    (doc.sources ?? []).map((source) => ({ ...source, from: doc.title }))
  );

  const renderSection = (entry: Section, filtered: boolean) => {
    if (editing && entry.editSection === editing) {
      return (
        <div class="wb-about-edit">
          <DocsSection section={editing} title={entry.key === 'rulebook' ? 'Rulebook' : 'About'} />
          <Button variant="secondary" onClick={() => setEditing(null)}>
            Done editing
          </Button>
        </div>
      );
    }
    const docs = filtered ? entry.docs.filter((doc) => docText(doc).includes(needle)) : entry.docs;
    switch (entry.key) {
      case 'summary':
        return <p class="wb-about-lead">{project?.summary}</p>;
      case 'sources':
        return allSources.length ? (
          <SourcesList sources={allSources} title="Where the originals are" readOnly />
        ) : (
          <EmptyState title="No sources recorded" body="Each document can say where its original lives." />
        );
      case 'contract':
        return (
          <div class="wb-about-facts">
            {project?.summary ? <p class="wb-about-lead">{project.summary}</p> : null}
            {facts.length ? (
              <dl class="wb-kv wb-about-kv">
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd class={label === 'Contract number' ? 'wb-mono' : undefined}>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {fundingSentence ? (
              <p class="wb-about-funding">
                <span class="wb-about-kicker">Funding sentence</span>
                {fundingSentence}
              </p>
            ) : null}
            {!facts.length && !fundingSentence && !project?.summary ? (
              <EmptyState title="Nothing recorded yet" body="An administrator can add these in Project settings." />
            ) : null}
          </div>
        );
      default:
        return docs.length ? (
          <div class="wb-about-docs">
            {docs.map((doc) => (
              <article class="wb-about-doc" key={doc.id}>
                {entry.key === 'rulebook' || filtered ? <h3 class="wb-about-doc-title">{doc.title}</h3> : null}
                <DocBlocks blocks={doc.body ?? []} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing written here yet"
            body={
              entry.key === 'rulebook'
                ? 'Write down the rules that keep coming up, so nobody has to reread the contract.'
                : 'Nothing has been written here yet.'
            }
          />
        );
    }
  };

  return (
    <Modal
      open={open}
      title={project ? `About ${project.name}` : 'About'}
      onClose={onClose}
      size="xl"
      initialFocus="panel"
      class="wb-about"
    >
      <div class="wb-about-layout">
        <nav class="wb-about-nav" aria-label="About sections">
          <label class="wb-search wb-about-search">
            <IconSearch size={16} />
            <span class="wb-sr">Search these pages</span>
            <input
              class="wb-input wb-input-sm"
              type="search"
              value={query}
              placeholder="Search"
              onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <ul class="wb-about-nav-list">
            {sections.map((entry) => {
              const matched = needle && entry.text.includes(needle);
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    class={`wb-about-nav-item${!needle && entry.key === active.key ? ' is-active' : ''}${
                      needle && !matched ? ' is-dim' : ''
                    }`}
                    aria-current={!needle && entry.key === active.key ? 'true' : undefined}
                    onClick={() => {
                      setQuery('');
                      setEditing(null);
                      onSection(entry.key);
                    }}
                  >
                    {entry.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div class="wb-about-body" ref={body}>
          {needle ? (
            hits.length ? (
              hits.map((entry) => (
                <section class="wb-about-section" key={entry.key}>
                  <h2 class="wb-about-heading">{entry.label}</h2>
                  {renderSection(entry, true)}
                </section>
              ))
            ) : (
              <EmptyState title={`Nothing mentions "${query.trim()}"`} body="Try a shorter word." />
            )
          ) : (
            <section class="wb-about-section">
              <h2 class="wb-about-heading">{active.label}</h2>
              {renderSection(active, false)}
              {active.editSection && !readOnly && editing !== active.editSection ? (
                <p class="wb-about-foot">
                  <button type="button" class="wb-linkish" onClick={() => setEditing(active.editSection!)}>
                    Edit {active.key === 'rulebook' ? 'the rulebook' : 'these pages'}
                  </button>
                </p>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
}
