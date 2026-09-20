/**
 * Tasks grouped by horizon: what is on now, what is next, what is later.
 * Long lists are paged rather than virtualised — a person scanning a work list
 * wants to find things with the browser's own find, and 200 at a time keeps
 * that useful while staying well inside the performance budget.
 */
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Task, WorkstreamDef } from '../../lib/types';
import { HORIZONS } from '../../lib/types';
import { plural } from '../../lib/format';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { TaskCard } from './TaskCard';
import { HORIZON_HEADING } from './shared';

const PAGE = 200;

export interface TaskListProps {
  tasks: Task[];
  workstreams: WorkstreamDef[];
  openId: string | null;
  onOpen: (id: string | null) => void;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: ComponentChildren;
}

export function TaskList({
  tasks,
  workstreams,
  openId,
  onOpen,
  emptyTitle = 'Nothing here',
  emptyBody = 'Nothing matches those filters yet.',
  emptyAction,
}: TaskListProps) {
  const [limit, setLimit] = useState(PAGE);

  if (!tasks.length) {
    return <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />;
  }

  const shown = tasks.slice(0, limit);

  return (
    <div class="wb-task-groups">
      {HORIZONS.map((horizon) => {
        const group = shown.filter((task) => task.horizon === horizon);
        if (!group.length) return null;
        return (
          <section class="wb-task-group" key={horizon}>
            <h3 class="wb-task-group-head">
              {HORIZON_HEADING[horizon]}
              <span class="wb-task-group-count wb-mono-soft">{plural(group.length, 'item')}</span>
            </h3>
            <div class="wb-task-stack">
              {group.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  workstreams={workstreams}
                  open={openId === task.id}
                  autoScroll={openId === task.id}
                  onToggle={(next) => onOpen(next ? task.id : null)}
                  onDelete={() => onOpen(null)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {tasks.length > limit ? (
        <div class="wb-task-more">
          <Button variant="quiet" onClick={() => setLimit((value) => value + PAGE)}>
            Show {Math.min(PAGE, tasks.length - limit)} more of {tasks.length}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
