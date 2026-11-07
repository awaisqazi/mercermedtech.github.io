/**
 * The board: four columns, one card per task. On a desktop a card can be
 * dragged to another column; everywhere, and by keyboard, the status menu on
 * the card does the same job. Columns stack on a phone.
 */
import { useState } from 'preact/hooks';
import type { Task, TaskStatus } from '../../lib/types';
import { STATUS_LABEL } from '../../lib/types';
import { setTaskStatus } from '../../lib/workspace';
import type { TaskGroup } from './filters';
import { AssigneeMark, StatusMenu, TaskMeta, openTask, taskHref } from './TaskBits';

const DRAG_TYPE = 'text/x-wb-task';

export function TaskBoard({
  groups,
  canEdit,
  phone,
}: {
  groups: TaskGroup[];
  canEdit: (task: Task) => boolean;
  phone: boolean;
}) {
  const [dragging, setDragging] = useState<Task | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [announce, setAnnounce] = useState('');

  const drop = (status: TaskStatus) => {
    const task = dragging;
    setDragging(null);
    setOver(null);
    if (!task || task.status === status) return;
    void setTaskStatus(task.id, status);
    setAnnounce(`${task.title} moved to ${STATUS_LABEL[status]}.`);
  };

  return (
    <div class={`wb-tasks-board${dragging ? ' is-dragging' : ''}`} data-wb-tasks-board>
      {groups.map((group) => (
        <section
          key={group.status}
          class={`wb-board-col${over === group.status ? ' is-over' : ''}`}
          aria-labelledby={`board-col-${group.status}`}
          data-status={group.status}
          onDragOver={(event) => {
            if (!dragging || !event.dataTransfer?.types.includes(DRAG_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (over !== group.status) setOver(group.status);
          }}
          onDragLeave={(event) => {
            const next = event.relatedTarget as Node | null;
            if (!next || !(event.currentTarget as HTMLElement).contains(next)) setOver(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            drop(group.status);
          }}
        >
          <header class="wb-board-col-head">
            <h2 class="wb-board-col-title" id={`board-col-${group.status}`}>
              {group.label}
            </h2>
            <span class="wb-meta wb-mono">{group.tasks.length}</span>
          </header>
          {group.tasks.length ? (
            <ul class="wb-board-cards">
              {group.tasks.map((task) => {
                const editable = canEdit(task);
                const draggable = editable && !phone;
                return (
                  <li
                    key={task.id}
                    class={`wb-task-card${dragging?.id === task.id ? ' is-lifted' : ''}`}
                    data-task={task.id}
                    draggable={draggable}
                    onDragStart={
                      draggable
                        ? (event) => {
                            event.dataTransfer?.setData(DRAG_TYPE, task.id);
                            event.dataTransfer?.setData('text/plain', task.title);
                            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                            setDragging(task);
                          }
                        : undefined
                    }
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  >
                    <a
                      class="wb-task-card-link"
                      href={taskHref(task.id)}
                      draggable={false}
                      onClick={(event) => openTask(task.id, event)}
                    >
                      {task.title}
                    </a>
                    <TaskMeta task={task} />
                    <div class="wb-task-card-foot">
                      <AssigneeMark userId={task.assignee_id} size={24} />
                      {editable ? <StatusMenu task={task} onChanged={(status) => setAnnounce(`${task.title} moved to ${STATUS_LABEL[status]}.`)} /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p class="wb-board-empty">Nothing here.</p>
          )}
        </section>
      ))}
      <p class="wb-sr" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
