/**
 * Renders a document body: paragraphs, headings, bullet lists, key–value rows
 * and notes. Text goes through RichText, so `**bold**` works and nothing else
 * is interpreted.
 */
import type { ComponentChildren } from 'preact';
import type { DocBlock, ProjectDoc } from '../lib/types';
import { RichText, renderRichText } from './RichText';
import { SourcesList } from './SourcesList';

export function DocBlocks({ blocks, class: className }: { blocks: DocBlock[]; class?: string }) {
  if (!blocks?.length) return null;
  return (
    <div class={`wb-doc${className ? ` ${className}` : ''}`}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} index={index} />
      ))}
    </div>
  );
}

function Block({ block, index }: { block: DocBlock; index: number }) {
  switch (block.t) {
    case 'h':
      return <h3 class="wb-doc-h">{renderRichText(block.text, `h${index}`)}</h3>;
    case 'ul':
      return (
        <ul class="wb-doc-ul">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderRichText(item, `ul${index}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    case 'kv':
      return (
        <dl class="wb-doc-kv">
          {block.rows.map((row, rowIndex) => (
            <div class="wb-doc-kv-row" key={rowIndex}>
              <dt>{row[0]}</dt>
              <dd>{renderRichText(row[1] ?? '', `kv${index}-${rowIndex}`)}</dd>
            </div>
          ))}
        </dl>
      );
    case 'note':
      return (
        <aside class="wb-doc-note">
          <span class="wb-doc-note-tag">Note</span>
          <RichText text={block.text} class="wb-doc-note-text" />
        </aside>
      );
    case 'p':
    default:
      return <RichText text={block.text} class="wb-doc-p" />;
  }
}

/** One whole document: title, body and where it came from. */
export function DocCard({
  doc,
  headingLevel = 2,
  action,
}: {
  doc: ProjectDoc;
  headingLevel?: 2 | 3;
  action?: ComponentChildren;
}) {
  return (
    <article class="wb-panel wb-doc-card" id={`doc-${doc.slug}`}>
      <header class="wb-doc-card-head">
        {headingLevel === 2 ? (
          <h2 class="wb-panel-title">{doc.title}</h2>
        ) : (
          <h3 class="wb-panel-title">{doc.title}</h3>
        )}
        {action}
      </header>
      <DocBlocks blocks={doc.body ?? []} />
      {doc.sources?.length ? (
        <SourcesList sources={doc.sources} title="Where this comes from" readOnly />
      ) : null}
    </article>
  );
}
