/**
 * A task's checklist: tick, add, move up or down, delete. The task's progress
 * follows the ticked fraction (useTaskProgress), so there is nothing else to
 * keep in step.
 *
 * The store has helpers for adding and ticking; moving and deleting go
 * through its generic `updateRow` and `deleteRow`, which are just as
 * optimistic and roll back the same way.
 */
import { useMemo, useRef, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { IconChevronDown, IconPlus, IconTrash } from '../../components/Icons';
import { Progress } from '../../components/Progress';
import type { TaskItem } from '../../lib/types';
import { addItem, deleteRow, toggleItem, updateRow, useTaskItems, useTaskProgress } from '../../lib/workspace';

const bySort = (a: TaskItem, b: TaskItem) => a.sort - b.sort || a.created_at.localeCompare(b.created_at);

export function Checklist({ taskId, editable }: { taskId: string; editable: boolean }) {
  const raw = useTaskItems(taskId);
  const items = useMemo(() => [...raw].sort(bySort), [raw]);
  const progress = useTaskProgress(taskId);
  const [draft, setDraft] = useState('');
  const [announce, setAnnounce] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const settled = useRef(false);

  const add = async (event: Event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const result = await addItem(taskId, text);
    if (!result.ok) setDraft(text);
    input.current?.focus();
  };

  const move = (index: number, step: -1 | 1) => {
    const item = items[index];
    const other = items[index + step];
    if (!item || !other) return;
    // Equal sorts (an old import) would swap to the same place: spread them first.
    const a = item.sort === other.sort ? item.sort + step : other.sort;
    const b = item.sort;
    void updateRow('task_items', item.id, { sort: a });
    void updateRow('task_items', other.id, { sort: b });
    setAnnounce(`${item.text} moved ${step < 0 ? 'up' : 'down'}.`);
    // Keep the keyboard on the button that was pressed, now one row along.
    window.setTimeout(() => {
      const selector = `[data-item="${item.id}"] .wb-check-move-${step < 0 ? 'up' : 'down'}`;
      const same = list.current?.querySelector<HTMLButtonElement>(selector);
      (same && !same.disabled ? same : list.current?.querySelector<HTMLElement>(`[data-item="${item.id}"] input`))?.focus();
    }, 0);
  };

  const startRename = (item: TaskItem) => {
    settled.current = false;
    setRenameDraft(item.text);
    setRenaming(item.id);
  };

  const refocusRename = (itemId: string) => {
    window.setTimeout(() => list.current?.querySelector<HTMLElement>(`[data-item="${itemId}"] .wb-checklist-rename`)?.focus(), 0);
  };

  const commitRename = (item: TaskItem) => {
    if (settled.current) return;
    settled.current = true;
    const text = renameDraft.trim();
    setRenaming(null);
    if (!text || text === item.text) return;
    void updateRow('task_items', item.id, { text });
    setAnnounce(`Step renamed to ${text}.`);
  };

  const remove = (item: TaskItem) => {
    void deleteRow('task_items', item.id);
    setAnnounce(`${item.text} deleted.`);
    window.setTimeout(() => input.current?.focus(), 0);
  };

  return (
    <section class="wb-task-section" aria-labelledby={`checklist-${taskId}`}>
      <div class="wb-task-section-head">
        <h3 class="wb-task-section-title" id={`checklist-${taskId}`}>
          Checklist
        </h3>
        {items.length ? <Progress done={progress.done} total={progress.total} class="wb-checklist-progress" /> : null}
      </div>
      {items.length ? (
        <ul class="wb-checklist" ref={list}>
          {items.map((item, index) => (
            <li key={item.id} class={`wb-checklist-item${item.done ? ' is-done' : ''}`} data-item={item.id}>
              {renaming === item.id ? (
                <input
                  class="wb-input wb-checklist-edit"
                  type="text"
                  aria-label="Step text"
                  value={renameDraft}
                  maxLength={300}
                  ref={(node) => node?.focus()}
                  onInput={(event) => setRenameDraft((event.currentTarget as HTMLInputElement).value)}
                  onBlur={() => commitRename(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitRename(item);
                      refocusRename(item.id);
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      settled.current = true;
                      setRenaming(null);
                      refocusRename(item.id);
                    }
                  }}
                />
              ) : (
                <label class="wb-check wb-checklist-check">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!editable}
                    onChange={(event) => void toggleItem(item.id, (event.currentTarget as HTMLInputElement).checked)}
                  />
                  <span
                    class={`wb-checklist-text${editable ? ' is-editable' : ''}`}
                    onClick={
                      editable
                        ? (event) => {
                            event.preventDefault();
                            startRename(item);
                          }
                        : undefined
                    }
                  >
                    {item.text}
                  </span>
                </label>
              )}
              {editable ? (
                <span class="wb-checklist-tools">
                  <Button
                    variant="quiet"
                    size="sm"
                    class="wb-checklist-rename"
                    aria-label={`Edit ${item.text}`}
                    onClick={() => startRename(item)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    iconOnly
                    class="wb-check-move-up"
                    aria-label={`Move ${item.text} up`}
                    disabled={index === 0}
                    icon={<IconChevronDown size={16} class="wb-flip" />}
                    onClick={() => move(index, -1)}
                  />
                  <Button
                    variant="quiet"
                    size="sm"
                    iconOnly
                    class="wb-check-move-down"
                    aria-label={`Move ${item.text} down`}
                    disabled={index === items.length - 1}
                    icon={<IconChevronDown size={16} />}
                    onClick={() => move(index, 1)}
                  />
                  <Button
                    variant="quiet"
                    size="sm"
                    iconOnly
                    aria-label={`Delete ${item.text}`}
                    icon={<IconTrash size={16} />}
                    onClick={() => remove(item)}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p class="wb-meta">{editable ? 'No steps yet. Break the task into steps and tick them off as you go.' : 'No steps.'}</p>
      )}
      {editable ? (
        <form class="wb-checklist-add" onSubmit={add}>
          <label class="wb-sr" for={`checklist-add-${taskId}`}>
            New step
          </label>
          <input
            id={`checklist-add-${taskId}`}
            ref={input}
            class="wb-input"
            type="text"
            placeholder="Add a step"
            value={draft}
            maxLength={300}
            onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
          />
          <Button type="submit" variant="secondary" icon={<IconPlus size={16} />}>
            Add
          </Button>
        </form>
      ) : null}
      <p class="wb-sr" role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}
