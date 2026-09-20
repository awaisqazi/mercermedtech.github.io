/**
 * Task details in a panel beside the board.
 *
 * A board column is about 200px wide, which is the right size for a card and
 * the wrong size for a form, so on the board the details slide in from the
 * right instead of pushing the column open. On a phone the same panel covers
 * the screen. It behaves like the app's other overlays: Escape closes it, the
 * scrim closes it, Tab stays inside, and focus goes back where it came from.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { Task, WorkstreamDef } from '../../lib/types';
import { PRIORITY_LABEL } from '../../lib/types';
import { dueWording, isOverdue } from '../../lib/format';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { IconClose, IconWarning } from '../Icons';
import { TaskDetails } from './TaskDetails';
import { workstreamLabel } from './shared';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface TaskDrawerProps {
  task: Task;
  workstreams: WorkstreamDef[];
  onClose: () => void;
  onDeleted?: (task: Task) => void;
}

export function TaskDrawer({ task, workstreams, onClose, onDeleted }: TaskDrawerProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    (node?.querySelector<HTMLElement>(FOCUSABLE) ?? node)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (item) => item.offsetParent !== null
      );
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.body.classList.add('wb-no-scroll');
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.classList.remove('wb-no-scroll');
      previous?.focus?.();
    };
    // The panel stays mounted while the board switches between tasks, so the
    // trap is set up once per opened task rather than once per render.
  }, [task.id, onClose]);

  const overdue = isOverdue(task.due) && task.status !== 'done';

  return (
    <div
      class="wb-drawer-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        class="wb-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Details: ${task.title}`}
        ref={panel}
        tabIndex={-1}
      >
        <header class="wb-drawer-head">
          <div class="wb-drawer-heading">
            <h2 class="wb-drawer-title">{task.title}</h2>
            <p class="wb-drawer-meta">
              {task.ws ? <Chip tone="quiet">{workstreamLabel(task.ws, workstreams)}</Chip> : null}
              {task.pri !== 'normal' ? (
                <Chip tone={task.pri === 'critical' ? 'crit' : 'warn'}>{PRIORITY_LABEL[task.pri]}</Chip>
              ) : null}
              {task.due ? (
                <span class={`wb-task-due wb-mono-soft${overdue ? ' is-overdue' : ''}`}>
                  {overdue ? <IconWarning size={13} /> : null}
                  {dueWording(task.due)}
                </span>
              ) : null}
            </p>
          </div>
          <Button
            variant="quiet"
            iconOnly
            aria-label="Close details"
            onClick={onClose}
            icon={<IconClose />}
          />
        </header>

        <div class="wb-drawer-body">
          <TaskDetails task={task} workstreams={workstreams} onDeleted={onDeleted} />
        </div>
      </div>
    </div>
  );
}
