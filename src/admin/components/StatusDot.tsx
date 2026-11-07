/**
 * A task's status: a 7px dot and the word, never a filled pill. The word is
 * what carries the meaning; the dot is only there to be found at a glance.
 */
import { PRIORITY_LABEL, STATUS_LABEL, type TaskPriority, type TaskStatus } from '../lib/types';

export function StatusDot({
  status,
  label,
  class: className,
}: {
  status: TaskStatus;
  /** Overrides the word, e.g. "Done this week". */
  label?: string;
  class?: string;
}) {
  return (
    <span class={`wb-status wb-status-${status}${className ? ` ${className}` : ''}`}>
      <span class="wb-status-dot" aria-hidden="true" />
      <span class="wb-status-word">{label ?? STATUS_LABEL[status]}</span>
    </span>
  );
}

/** "High" or "Urgent" in ink. Nothing at all for normal. */
export function PriorityWord({ priority }: { priority: TaskPriority }) {
  if (priority === 'normal') return null;
  return <span class={`wb-priority wb-priority-${priority}`}>{PRIORITY_LABEL[priority]}</span>;
}
