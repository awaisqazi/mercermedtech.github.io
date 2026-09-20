/**
 * What a general project looks like at a glance: what it is, what needs
 * attention, and how far along it is.
 */
import { useProject, useTasks } from '../../lib/store';
import { href } from '../../lib/router';
import { dueWording, plural, ratio } from '../../lib/format';
import { STATUS_LABEL } from '../../lib/types';
import { needsAttention } from '../../components/tasks';
import { Bar } from '../../components/Bar';
import { Chip } from '../../components/Chip';
import { DocsSection } from '../../components/DocsSection';
import { EmptyState } from '../../components/EmptyState';
import { ProgressRing } from '../../components/ProgressRing';

export function Overview() {
  const { project } = useProject();
  const tasks = useTasks();

  const open = tasks.filter((task) => task.status !== 'done');
  const done = tasks.length - open.length;
  const blocked = open.filter((task) => task.status === 'blocked');
  const attention = tasks.filter(needsAttention).slice(0, 8);
  const slug = project?.slug ?? '';

  return (
    <div class="wb-stack">
      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Where this stands</h2>
        </header>
        <div class="wb-stat-row">
          <div class="wb-stat">
            <ProgressRing
              size={56}
              value={ratio(done, tasks.length)}
              title={`${done} of ${tasks.length} done`}
            />
            <div>
              <p class="wb-stat-value wb-mono">
                {done}/{tasks.length}
              </p>
              <p class="wb-stat-label">Done</p>
            </div>
          </div>
          <div class="wb-stat">
            <p class="wb-stat-value wb-mono">{open.length}</p>
            <p class="wb-stat-label">Still open</p>
          </div>
          <div class="wb-stat">
            <p class="wb-stat-value wb-mono">{blocked.length}</p>
            <p class="wb-stat-label">Blocked</p>
          </div>
          <div class="wb-stat">
            <p class="wb-stat-value wb-mono">
              {open.filter((task) => task.pri === 'critical').length}
            </p>
            <p class="wb-stat-label">Critical</p>
          </div>
        </div>
        <Bar
          value={ratio(done, tasks.length)}
          title={`${Math.round(ratio(done, tasks.length) * 100)} percent done`}
          height={10}
        />
      </section>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Needs attention</h2>
          <span class="wb-mono-soft">{plural(attention.length, 'item')}</span>
        </header>
        {attention.length ? (
          <ul class="wb-minilist">
            {attention.map((task) => (
              <li key={task.id}>
                <a class="wb-minirow" href={href(`/p/${slug}/tasks`, { task: task.id })}>
                  <span class="wb-minirow-title">{task.title}</span>
                  <span class="wb-minirow-meta">
                    <Chip tone={task.pri === 'critical' ? 'crit' : 'quiet'}>
                      {STATUS_LABEL[task.status]}
                    </Chip>
                    {task.due ? <span class="wb-mono-soft">{dueWording(task.due)}</span> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing urgent" body="Nothing is overdue, blocked or critical." />
        )}
      </section>

      <DocsSection
        section="about"
        title="What this project is"
        emptyBody="Write down what this project is for, so the next person does not have to ask."
      />
    </div>
  );
}
