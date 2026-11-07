/**
 * What happened to a task, from the activity log. Collapsed by default, and
 * not fetched until someone opens it.
 */
import { useState } from 'preact/hooks';
import { SkeletonLines } from '../../components/Skeleton';
import { fullTime, relativeTime } from '../../lib/format';
import { nameOf, useTaskHistory } from '../../lib/workspace';

export function History({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      class="wb-task-history"
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="wb-task-history-summary">History</summary>
      {open ? <HistoryRows taskId={taskId} /> : null}
    </details>
  );
}

function HistoryRows({ taskId }: { taskId: string }) {
  const { rows, loading } = useTaskHistory(taskId);
  if (loading && !rows.length) return <SkeletonLines count={3} />;
  if (!rows.length) return <p class="wb-meta">Nothing recorded yet.</p>;
  return (
    <ol class="wb-history">
      {rows.map((row) => (
        <li key={row.id} class="wb-history-row">
          <p class="wb-history-head">
            <span class="wb-history-actor">{row.actor_id ? nameOf(row.actor_id) : 'The workspace'}</span>
            <time class="wb-meta" dateTime={row.created_at} title={fullTime(row.created_at)}>
              {relativeTime(row.created_at)}
            </time>
          </p>
          <p class="wb-history-text">{row.summary}</p>
        </li>
      ))}
    </ol>
  );
}
