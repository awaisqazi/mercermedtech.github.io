/**
 * The list view: tasks grouped by status (To do, In progress, Blocked, Done
 * this week), one ruled row each. A row is a link, so it can be opened in a
 * new tab; a plain click opens the drawer over the list.
 */
import type { Task } from '../../lib/types';
import type { TaskGroup } from './filters';
import { AssigneeMark, StatusMenu, TaskMeta, openTask, taskHref } from './TaskBits';

export function TaskList({ groups, canEdit }: { groups: TaskGroup[]; canEdit: (task: Task) => boolean }) {
  const shown = groups.filter((group) => group.tasks.length);
  return (
    <div class="wb-tasks-list" data-wb-tasks-list>
      {shown.map((group) => (
        <section class="wb-section wb-tasks-group" key={group.status} aria-labelledby={`tasks-group-${group.status}`}>
          <div class="wb-section-head">
            <h2 class="wb-section-title" id={`tasks-group-${group.status}`}>
              {group.label}
            </h2>
            <span class="wb-meta wb-mono">{group.tasks.length}</span>
          </div>
          <ul class="wb-list">
            {group.tasks.map((task) => (
              <li key={task.id} class="wb-task-row">
                <a class="wb-row wb-task-link" href={taskHref(task.id)} onClick={(event) => openTask(task.id, event)}>
                  <span class="wb-row-main">
                    <span class={`wb-row-title wb-task-title${task.status === 'done' ? ' is-done' : ''}`}>{task.title}</span>
                    <TaskMeta task={task} />
                  </span>
                  <AssigneeMark userId={task.assignee_id} />
                </a>
                {canEdit(task) ? (
                  <span class="wb-task-row-status">
                    <StatusMenu task={task} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
