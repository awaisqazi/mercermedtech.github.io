/**
 * A plain block editor: paragraph, heading, bullet list, key–value rows, note.
 * Add, remove, move up, move down. No rich-text surface and no HTML — every
 * block is a small form over the JSON shape stored in `project_docs.body`.
 *
 * It keeps a local draft and hands the whole body back through `onSave`, so
 * the caller decides when to write. That suits a document, which is edited in
 * a burst and saved once, rather than field by field like a task.
 */
import { useEffect, useState } from 'preact/hooks';
import type { DocBlock, DocBlockType } from '../lib/types';
import { Button } from './Button';
import { Input, Textarea } from './Field';
import { Select } from './Select';
import { IconPlus, IconTrash } from './Icons';

const TYPE_OPTIONS: Array<{ value: DocBlockType; label: string }> = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h', label: 'Heading' },
  { value: 'ul', label: 'Bullet list' },
  { value: 'kv', label: 'Key and value rows' },
  { value: 'note', label: 'Note' },
];

function emptyBlock(type: DocBlockType): DocBlock {
  switch (type) {
    case 'h':
      return { t: 'h', text: '' };
    case 'ul':
      return { t: 'ul', items: [''] };
    case 'kv':
      return { t: 'kv', rows: [['', '']] };
    case 'note':
      return { t: 'note', text: '' };
    default:
      return { t: 'p', text: '' };
  }
}

/** Keeps whatever text it can when someone changes a block's type. */
function convert(block: DocBlock, type: DocBlockType): DocBlock {
  if (block.t === type) return block;
  const text =
    block.t === 'ul'
      ? block.items.join('\n')
      : block.t === 'kv'
        ? block.rows.map((row) => `${row[0]}: ${row[1]}`).join('\n')
        : block.text;
  if (type === 'ul') return { t: 'ul', items: text.split('\n').filter(Boolean) };
  if (type === 'kv') {
    return {
      t: 'kv',
      rows: text
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const at = line.indexOf(':');
          return at === -1
            ? ([line, ''] as [string, string])
            : ([line.slice(0, at).trim(), line.slice(at + 1).trim()] as [string, string]);
        }),
    };
  }
  return { t: type, text } as DocBlock;
}

export interface BlockEditorProps {
  title: string;
  blocks: DocBlock[];
  onSave: (next: { title: string; body: DocBlock[] }) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
}

export function BlockEditor({ title, blocks, onSave, onCancel, saving = false }: BlockEditorProps) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [body, setBody] = useState<DocBlock[]>(() => (blocks?.length ? blocks : [emptyBlock('p')]));

  useEffect(() => {
    setDraftTitle(title);
    setBody(blocks?.length ? blocks : [emptyBlock('p')]);
  }, [title, blocks]);

  const replace = (index: number, next: DocBlock) =>
    setBody((current) => current.map((block, position) => (position === index ? next : block)));

  const move = (index: number, step: number) =>
    setBody((current) => {
      const target = index + step;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });

  const remove = (index: number) =>
    setBody((current) => (current.length === 1 ? current : current.filter((_, p) => p !== index)));

  return (
    <div class="wb-editor">
      <label class="wb-label" for="wb-doc-title">
        Title
      </label>
      <Input
        id="wb-doc-title"
        value={draftTitle}
        onInput={(event) => setDraftTitle((event.currentTarget as HTMLInputElement).value)}
      />

      <ol class="wb-editor-blocks">
        {body.map((block, index) => (
          <li class="wb-editor-block" key={index}>
            <div class="wb-editor-block-bar">
              <Select<DocBlockType>
                value={block.t}
                size="sm"
                options={TYPE_OPTIONS}
                aria-label={`Block ${index + 1} type`}
                onValue={(type) => replace(index, convert(block, type))}
              />
              <span class="wb-spacer" />
              <Button
                variant="quiet"
                size="sm"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move block ${index + 1} up`}
              >
                Up
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => move(index, 1)}
                disabled={index === body.length - 1}
                aria-label={`Move block ${index + 1} down`}
              >
                Down
              </Button>
              <Button
                variant="quiet"
                size="sm"
                iconOnly
                icon={<IconTrash size={15} />}
                onClick={() => remove(index)}
                disabled={body.length === 1}
                aria-label={`Remove block ${index + 1}`}
              />
            </div>
            <BlockFields block={block} index={index} onChange={(next) => replace(index, next)} />
          </li>
        ))}
      </ol>

      <div class="wb-editor-add">
        {TYPE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant="quiet"
            size="sm"
            icon={<IconPlus size={14} />}
            onClick={() => setBody((current) => [...current, emptyBlock(option.value)])}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div class="wb-editor-actions">
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          busy={saving}
          onClick={() => void onSave({ title: draftTitle.trim(), body: clean(body) })}
        >
          Save note
        </Button>
      </div>
      <p class="wb-hint">Two stars around a phrase make it **bold**. Nothing else is interpreted.</p>
    </div>
  );
}

/** Drops blocks that ended up empty, so a stray add does not persist. */
function clean(blocks: DocBlock[]): DocBlock[] {
  return blocks.filter((block) => {
    if (block.t === 'ul') return block.items.some((item) => item.trim());
    if (block.t === 'kv') return block.rows.some((row) => row[0]?.trim() || row[1]?.trim());
    return Boolean(block.text.trim());
  });
}

function BlockFields({
  block,
  index,
  onChange,
}: {
  block: DocBlock;
  index: number;
  onChange: (next: DocBlock) => void;
}) {
  if (block.t === 'h') {
    return (
      <Input
        value={block.text}
        aria-label={`Heading ${index + 1}`}
        placeholder="Heading"
        onInput={(event) => onChange({ t: 'h', text: (event.currentTarget as HTMLInputElement).value })}
      />
    );
  }

  if (block.t === 'p' || block.t === 'note') {
    return (
      <Textarea
        value={block.text}
        rows={3}
        aria-label={`${block.t === 'note' ? 'Note' : 'Paragraph'} ${index + 1}`}
        placeholder={block.t === 'note' ? 'Something to watch out for' : 'Write here'}
        onInput={(event) =>
          onChange({ t: block.t, text: (event.currentTarget as HTMLTextAreaElement).value } as DocBlock)
        }
      />
    );
  }

  if (block.t === 'ul') {
    return (
      <div class="wb-editor-rows">
        {block.items.map((item, itemIndex) => (
          <div class="wb-editor-row" key={itemIndex}>
            <Input
              value={item}
              aria-label={`Bullet ${itemIndex + 1}`}
              onInput={(event) =>
                onChange({
                  t: 'ul',
                  items: block.items.map((value, position) =>
                    position === itemIndex ? (event.currentTarget as HTMLInputElement).value : value
                  ),
                })
              }
            />
            <Button
              variant="quiet"
              size="sm"
              iconOnly
              icon={<IconTrash size={14} />}
              aria-label={`Remove bullet ${itemIndex + 1}`}
              onClick={() =>
                onChange({ t: 'ul', items: block.items.filter((_, position) => position !== itemIndex) })
              }
            />
          </div>
        ))}
        <Button
          variant="quiet"
          size="sm"
          icon={<IconPlus size={14} />}
          onClick={() => onChange({ t: 'ul', items: [...block.items, ''] })}
        >
          Add a bullet
        </Button>
      </div>
    );
  }

  return (
    <div class="wb-editor-rows">
      {block.rows.map((row, rowIndex) => (
        <div class="wb-editor-row wb-editor-kv" key={rowIndex}>
          <Input
            value={row[0]}
            aria-label={`Label ${rowIndex + 1}`}
            placeholder="Label"
            onInput={(event) =>
              onChange({
                t: 'kv',
                rows: block.rows.map((entry, position) =>
                  position === rowIndex
                    ? [(event.currentTarget as HTMLInputElement).value, entry[1]]
                    : entry
                ),
              })
            }
          />
          <Input
            value={row[1]}
            aria-label={`Value ${rowIndex + 1}`}
            placeholder="Value"
            onInput={(event) =>
              onChange({
                t: 'kv',
                rows: block.rows.map((entry, position) =>
                  position === rowIndex
                    ? [entry[0], (event.currentTarget as HTMLInputElement).value]
                    : entry
                ),
              })
            }
          />
          <Button
            variant="quiet"
            size="sm"
            iconOnly
            icon={<IconTrash size={14} />}
            aria-label={`Remove row ${rowIndex + 1}`}
            onClick={() =>
              onChange({ t: 'kv', rows: block.rows.filter((_, position) => position !== rowIndex) })
            }
          />
        </div>
      ))}
      <Button
        variant="quiet"
        size="sm"
        icon={<IconPlus size={14} />}
        onClick={() => onChange({ t: 'kv', rows: [...block.rows, ['', '']] })}
      >
        Add a row
      </Button>
    </div>
  );
}
