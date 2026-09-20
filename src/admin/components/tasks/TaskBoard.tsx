/**
 * Four status columns with drag and drop between them.
 *
 * Dragging is a convenience, never the only way: every card also carries a
 * status select, which is what a keyboard or a screen reader uses. The drop
 * target is announced by a class change and each column is a labelled region.
 *
 * Details do not open inside a column — a column is about 200px wide — so the
 * open card lights up here and its details appear in the drawer beside the
 * board. A `?task=<id>` link therefore opens the drawer when the board is the
 * view somebody left switched on.
 */
import { useCallback, useState } from 'preact/hooks';
import type { Task, TaskStatus, WorkstreamDef } from '../../lib/types';
import { STATUS_LABEL, TASK_STATUSES } from '../../lib/types';
import { updateRow, useProject } from '../../lib/store';
import { toast } from '../../lib/toasts';
import { TaskCard } from './TaskCard';
import { TaskDrawer } from './TaskDrawer';

export interface TaskBoardProps {
  tasks: Task[];
  workstreams: WorkstreamDef[];
  openId: string | null;
  onOpen: (id: string | null) => void;
}

export function TaskBoard({ tasks, workstreams, openId, onOpen }: TaskBoardProps) {
  const { readOnly } = useProject();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const openTask = openId ? (tasks.find((task) => task.id === openId) ?? null) : null;
  // Stable, so the drawer's key handling is not torn down on every render.
  const closeDrawer = useCallback(() => onOpen(null), [onOpen]);

  const drop = async (status: TaskStatus) => {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id) return;
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === status) return;
    const result = await updateRow('tasks', id, { status });
    if (!result.ok && result.error) toast.bad(result.error.message);
  };

  return (
    <>
    <div class="wb-board">
      {TASK_STATUSES.map((status) => {
        const column = tasks.filter((task) => task.status === status);
        return (
          <section
            class={`wb-board-column${over === status ? ' is-over' : ''}`}
            key={status}
            aria-label={`${STATUS_LABEL[status]}, ${column.length}`}
            onDragOver={(event) => {
              if (readOnly || !dragging) return;
              event.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((current) => (current === status ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              void drop(status);
            }}
          >
            <header class="wb-board-head">
              <span class={`wb-board-dot wb-tone-${status}`} aria-hidden="true" />
              <h3 class="wb-board-title">{STATUS_LABEL[status]}</h3>
              <span class="wb-board-count wb-mono">{column.length}</span>
            </header>

            <div class="wb-board-stack">
              {column.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  workstreams={workstreams}
                  compact
                  draggable
                  inlineDetails={false}
                  open={openId === task.id}
                  autoScroll={openId === task.id}
                  onToggle={(next) => onOpen(next ? task.id : null)}
                  onDelete={() => onOpen(null)}
                  onDragStart={(event) => {
                    setDragging(task.id);
                    event.dataTransfer?.setData('text/plain', task.id);
                    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                />
              ))}
              {column.length === 0 ? (
                <p class="wb-board-empty">
                  {readOnly ? 'Nothing here.' : 'Drop a card here, or use a card’s status picker.'}
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>

    {openTask ? (
      <TaskDrawer
        key={openTask.id}
        task={openTask}
        workstreams={workstreams}
        onClose={closeDrawer}
        onDeleted={closeDrawer}
      />
    ) : null}
    </>
  );
}
