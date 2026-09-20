/**
 * The grant at a glance.
 *
 * Every number here comes from `project.config` (what was agreed) and
 * `project_state` (what has happened): the targets, the term dates, the
 * milestones and the funnel are all settings, so this file knows about grants
 * in general and about no grant in particular.
 *
 * Which metric feeds which headline is itself a setting — see `metric_map` in
 * `shared.ts` — so a project that counts "hired" rather than "placed" needs no
 * code change.
 */
import {
  useDocs,
  useProject,
  useProjectState,
  useReports,
  useTasks,
} from '../../lib/store';
import { href } from '../../lib/router';
import {
  daysUntil,
  dueWording,
  formatDate,
  formatMonth,
  money,
  percent,
  plural,
  ratio,
} from '../../lib/format';
import {
  REPORT_STATUS_LABEL,
  STATUS_LABEL,
  type Task,
} from '../../lib/types';
import { isOverdueTask, needsAttention } from '../../components/tasks';
import { Bar, TwinBars } from '../../components/Bar';
import { Chip } from '../../components/Chip';
import { DocBlocks } from '../../components/DocBlocks';
import { EmptyState } from '../../components/EmptyState';
import {
  budgetLines,
  checkDefs,
  checksReady,
  isSettledReport,
  metricKeys,
  numberFrom,
  objectFrom,
  termProgress,
} from './shared';

interface Tile {
  label: string;
  value: string;
  caption: string;
  progress: number;
  target: number | null;
  word: string;
  tone: 'good' | 'warn' | 'crit' | 'accent';
}

/** A status word, so the tile never relies on colour alone. */
function standing(progress: number, target: number | null): { word: string; tone: Tile['tone'] } {
  if (target === null) return { word: 'No target set', tone: 'accent' };
  if (progress >= target) return { word: 'On target', tone: 'good' };
  if (progress >= target * 0.75) return { word: 'Close', tone: 'warn' };
  return { word: 'Behind', tone: 'crit' };
}

/** Critical, blocked, overdue, or due inside a week: worth looking at today. */
function wantsAttention(task: Task): boolean {
  if (task.status === 'done') return false;
  if (needsAttention(task)) return true;
  const days = daysUntil(task.due);
  return days !== null && days <= 7;
}

export function Overview() {
  const { project, config } = useProject();
  const tasks = useTasks();
  const reports = useReports();
  const about = useDocs('about');
  const [metrics] = useProjectState('metrics');
  const [budget] = useProjectState('budget');

  const slug = project?.slug ?? '';
  const workstreams = Array.isArray(config.workstreams) ? config.workstreams : [];
  const targets = (config.targets ?? {}) as Record<string, number>;
  const keys = metricKeys(config);

  const enrolled = numberFrom(metrics, keys.enrolled);
  const credentialed = numberFrom(metrics, keys.credentialed);
  const placed = numberFrom(metrics, keys.placed);
  const retained = numberFrom(metrics, keys.retained);

  const enrolledTarget = Number(targets.enrolled ?? 0);

  const tiles: Tile[] = [
    (() => {
      const progress = enrolledTarget ? ratio(enrolled, enrolledTarget) : 0;
      const mark = standing(progress, enrolledTarget ? 1 : null);
      return {
        label: 'Enrolled',
        value: String(enrolled),
        caption: enrolledTarget ? `of ${enrolledTarget}` : 'no target set',
        progress,
        target: enrolledTarget ? 1 : null,
        ...mark,
      };
    })(),
    (() => {
      const rate = ratio(credentialed, enrolled);
      const target = Number.isFinite(Number(targets.credential_rate))
        ? Number(targets.credential_rate)
        : null;
      const mark = standing(rate, target);
      return {
        label: 'Credentialed',
        value: percent(rate),
        caption: `${credentialed} of ${enrolled} enrolled`,
        progress: rate,
        target,
        ...mark,
      };
    })(),
    (() => {
      const rate = ratio(placed, enrolled);
      const target = Number.isFinite(Number(targets.placement_rate))
        ? Number(targets.placement_rate)
        : null;
      const mark = standing(rate, target);
      return {
        label: 'Placed',
        value: percent(rate),
        caption: `${placed} of ${enrolled} enrolled`,
        progress: rate,
        target,
        ...mark,
      };
    })(),
    (() => {
      const rate = ratio(retained, placed);
      const target = Number.isFinite(Number(targets.retention_rate))
        ? Number(targets.retention_rate)
        : null;
      const mark = standing(rate, target);
      return {
        label: 'Retained at 90 days',
        value: percent(rate),
        caption: `${retained} of ${placed} placed`,
        progress: rate,
        target,
        ...mark,
      };
    })(),
  ];

  // Term elapsed against money billed: the two lines that tend to drift apart.
  const term = termProgress(config);
  const elapsed = term.elapsed ?? 0;

  const award = Number(config.award ?? 0);
  const billedMap = objectFrom(budget, 'billed');
  const lines = budgetLines(config);
  const approved = lines.reduce((total, line) => total + line.amount, 0);
  const billed = lines.reduce((total, line) => total + numberFrom(billedMap, line.id), 0);
  const denominator = award || approved;
  const billedShare = ratio(billed, denominator);

  const moneyReading = (() => {
    if (!denominator) return 'No award or budget lines are recorded yet, so there is nothing to compare.';
    if (term.elapsed === null) return `${money(billed)} of ${money(denominator)} billed. No term dates are recorded.`;
    const gap = billedShare - elapsed;
    if (gap > 0.1) return 'Billing is running ahead of the term. Worth a look on the Budget tab.';
    if (gap < -0.1) return 'Billing is running behind the term, so money is building up unclaimed.';
    return 'Billing and the term are in step.';
  })();

  const attention = tasks.filter(wantsAttention).slice(0, 8);

  const checks = checkDefs(config.report_checks);
  const nextReport = reports.find((report) => !isSettledReport(report)) ?? null;
  const ready = nextReport ? checksReady(nextReport, checks) : 0;

  const wsRows = workstreams.map((ws) => {
    const own = tasks.filter((task) => task.ws === ws.key);
    const open = own.filter((task) => task.status !== 'done');
    return {
      ...ws,
      open: open.length,
      blocked: open.filter((task) => task.status === 'blocked').length,
      overdue: open.filter(isOverdueTask).length,
      done: own.length - open.length,
    };
  });

  return (
    <div class="wb-stack">
      {about.length ? (
        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">What this grant is</h2>
          </header>
          {about.map((doc) => (
            <DocBlocks key={doc.id} blocks={doc.body ?? []} />
          ))}
        </section>
      ) : null}

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Outcomes so far</h2>
          <span class="wb-mono-soft">
            {config.term_start && config.term_end
              ? `${formatDate(config.term_start)} to ${formatDate(config.term_end)}`
              : ''}
          </span>
        </header>

        <div class="wb-tiles">
          {tiles.map((tile) => (
            <div class="wb-tile" key={tile.label}>
              <p class="wb-tile-label">{tile.label}</p>
              <p class="wb-tile-value wb-mono">{tile.value}</p>
              <Bar
                value={tile.progress}
                target={tile.target}
                tone={tile.tone === 'accent' ? 'accent' : tile.tone}
                title={`${tile.label}: ${tile.value}, ${tile.word}`}
              />
              <p class="wb-tile-caption">
                <span class="wb-mono-soft">{tile.caption}</span>
                <Chip tone={tile.tone === 'accent' ? 'quiet' : tile.tone}>{tile.word}</Chip>
              </p>
            </div>
          ))}
        </div>

        {enrolled === 0 ? (
          <p class="wb-hint">
            No numbers recorded yet. They live on the{' '}
            <a class="wb-linkish" href={href(`/p/${slug}/outcomes`)}>
              Outcomes tab
            </a>
            , and only ever as counts.
          </p>
        ) : null}
      </section>

      <div class="wb-grid-2">
        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">Term against money</h2>
          </header>
          <TwinBars
            rows={[
              {
                label: 'Term elapsed',
                value: elapsed,
                caption: term.elapsed === null ? 'no dates recorded' : percent(elapsed),
                tone: 'neutral',
              },
              {
                label: 'Billed to date',
                value: billedShare,
                caption: denominator ? `${money(billed)} of ${money(denominator)}` : 'no award recorded',
                tone: billedShare > elapsed + 0.1 ? 'warn' : 'accent',
              },
            ]}
          />
          <p class="wb-reading">{moneyReading}</p>
          <a class="wb-linkish" href={href(`/p/${slug}/budget`)}>
            Open the budget
          </a>
        </section>

        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">Next report</h2>
          </header>
          {nextReport ? (
            <div class="wb-next-report">
              <p class="wb-next-report-period">{formatMonth(nextReport.period) || nextReport.period}</p>
              <p class="wb-next-report-meta">
                <Chip tone={nextReport.status === 'not_started' ? 'warn' : 'quiet'}>
                  {REPORT_STATUS_LABEL[nextReport.status]}
                </Chip>
                {nextReport.due ? (
                  <span class="wb-mono-soft">{dueWording(nextReport.due)}</span>
                ) : null}
              </p>
              {checks.length ? (
                <>
                  <Bar
                    value={ratio(ready, checks.length)}
                    tone={ready === checks.length ? 'good' : 'accent'}
                    title={`${ready} of ${checks.length} parts ready`}
                  />
                  <p class="wb-mono-soft">
                    {ready} of {checks.length} parts ready
                  </p>
                </>
              ) : (
                <p class="wb-mono-soft">No checklist is set up for this project.</p>
              )}
              <a class="wb-linkish" href={href(`/p/${slug}/reports`)}>
                Open reports
              </a>
            </div>
          ) : (
            <EmptyState title="Nothing outstanding" body="No report is waiting on anybody." />
          )}
        </section>
      </div>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Needs attention</h2>
          <span class="wb-mono-soft">{plural(attention.length, 'item')}</span>
        </header>
        {attention.length ? (
          <ul class="wb-minilist">
            {attention.map((task) => (
              <li key={task.id}>
                <a class="wb-minirow" href={href(`/p/${slug}/deliverables`, { task: task.id })}>
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
          <EmptyState
            title="Nothing urgent"
            body="Nothing is critical, blocked, overdue or due inside a week."
          />
        )}
      </section>

      {wsRows.length ? (
        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">Workstream health</h2>
            <span class="wb-mono-soft">Open one to see only its deliverables</span>
          </header>
          <div class="wb-table-scroll">
            <table class="wb-table wb-stacked">
              <thead>
                <tr>
                  <th scope="col">Workstream</th>
                  <th scope="col">Open</th>
                  <th scope="col">Blocked</th>
                  <th scope="col">Overdue</th>
                  <th scope="col">Done</th>
                </tr>
              </thead>
              <tbody>
                {wsRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" data-label="Workstream">
                      <a href={href(`/p/${slug}/deliverables`, { ws: row.key })}>{row.label}</a>
                    </th>
                    <td data-label="Open" class="wb-mono">
                      {row.open}
                    </td>
                    <td data-label="Blocked" class={`wb-mono${row.blocked ? ' is-warn' : ''}`}>
                      {row.blocked}
                    </td>
                    <td data-label="Overdue" class={`wb-mono${row.overdue ? ' is-overdue' : ''}`}>
                      {row.overdue}
                    </td>
                    <td data-label="Done" class="wb-mono">
                      {row.done}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
