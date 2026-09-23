/**
 * Numbers: the two things the grant is measured by, at a glance.
 *
 *   Outcomes  the four contract targets against where the counts are now,
 *             and the pace still needed to reach enrolment in time
 *   Budget    each line's approved amount against what has been billed,
 *             category subtotals, and what has been reimbursed
 *
 * Each card has "Edit numbers", which opens the full editing tables (the
 * Outcomes and Budget views, with the funnel inputs, the targets table, the
 * billing inputs and the notes) in a panel, so the tab itself stays calm.
 * `?focus=outcomes|budget` brings a card into view (old addresses land here);
 * `?edit=outcomes|budget` opens its editor.
 */
import { useEffect, useRef } from 'preact/hooks';
import { useProject, useProjectState } from '../../lib/store';
import { setQuery, useRoute } from '../../lib/router';
import { formatDate, money, percent, plural, ratio } from '../../lib/format';
import type { BudgetLineDef } from '../../lib/types';
import { Bar } from '../../components/Bar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Outcomes } from './Outcomes';
import { Budget } from './Budget';
import {
  budgetCategories,
  budgetLines,
  funnelItems,
  metricKeys,
  monthsFromToday,
  numberFrom,
  objectFrom,
  termProgress,
  textFrom,
} from './shared';

type Card = 'outcomes' | 'budget';

export function Numbers() {
  const route = useRoute();
  const { readOnly } = useProject();
  const outcomes = useRef<HTMLElement>(null);
  const budget = useRef<HTMLElement>(null);
  const focus = route.query.focus as Card | undefined;
  const editing = route.query.edit as Card | undefined;

  useEffect(() => {
    const node = focus === 'budget' ? budget.current : focus === 'outcomes' ? outcomes.current : null;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    node.classList.add('is-focused');
    const timer = window.setTimeout(() => node.classList.remove('is-focused'), 1600);
    return () => window.clearTimeout(timer);
  }, [focus]);

  const edit = (card: Card | null) => setQuery({ ...route.query, edit: card, focus: null });
  const label = readOnly ? 'See all the numbers' : 'Edit numbers';

  return (
    <div class="wb-numbers">
      <section class="wb-card-panel" ref={outcomes} aria-labelledby="wb-outcomes-title">
        <header class="wb-card-panel-head">
          <h2 class="wb-card-panel-title" id="wb-outcomes-title">
            Outcomes
          </h2>
          <Button variant="secondary" size="sm" onClick={() => edit('outcomes')}>
            {label}
          </Button>
        </header>
        <OutcomesSummary />
      </section>

      <section class="wb-card-panel" ref={budget} aria-labelledby="wb-budget-title">
        <header class="wb-card-panel-head">
          <h2 class="wb-card-panel-title" id="wb-budget-title">
            Budget
          </h2>
          <Button variant="secondary" size="sm" onClick={() => edit('budget')}>
            {label}
          </Button>
        </header>
        <BudgetSummary />
      </section>

      <Modal
        open={editing === 'outcomes'}
        title="Outcomes"
        onClose={() => edit(null)}
        size="xl"
        initialFocus="panel"
      >
        <Outcomes />
      </Modal>
      <Modal open={editing === 'budget'} title="Budget" onClose={() => edit(null)} size="xl" initialFocus="panel">
        <Budget />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------ outcomes --- */

function standing(value: number, target: number): { word: string; tone: 'good' | 'warn' | 'crit' } {
  if (value >= target) return { word: 'On target', tone: 'good' };
  if (value >= target * 0.75) return { word: 'Close', tone: 'warn' };
  return { word: 'Behind', tone: 'crit' };
}

function OutcomesSummary() {
  const { config } = useProject();
  const [metrics] = useProjectState('metrics');
  const keys = metricKeys(config);
  const items = funnelItems(config);
  const targets = (config.targets ?? {}) as Record<string, number>;
  const milestones = (config.milestones ?? {}) as Record<string, string>;
  const labelFor = (key: string, fallback: string) => items.find((item) => item.key === key)?.label ?? fallback;
  const value = (key: string) => numberFrom(metrics, key);

  const enrolled = value(keys.enrolled);
  const enrolledTarget = Number(targets.enrolled) || 0;

  interface Measure {
    key: string;
    label: string;
    now: number;
    target: number | null;
    shown: string;
    caption: string;
  }

  const enrolledRow: Measure = {
    key: 'enrolled',
    label: labelFor(keys.enrolled, 'Enrolled'),
    now: enrolledTarget ? ratio(enrolled, enrolledTarget) : 0,
    target: enrolledTarget ? 1 : null,
    shown: enrolledTarget ? `${enrolled} of ${enrolledTarget}` : String(enrolled),
    caption: enrolledTarget ? 'people enrolled against the target' : 'no target set',
  };

  const rates = [
    {
      key: 'credential_rate',
      label: labelFor(keys.credentialed, 'Credentialed'),
      base: enrolled,
      count: value(keys.credentialed),
      baseLabel: 'enrolled',
    },
    {
      key: 'placement_rate',
      label: labelFor(keys.placed, 'Placed'),
      base: enrolled,
      count: value(keys.placed),
      baseLabel: 'enrolled',
    },
    {
      key: 'retention_rate',
      label: labelFor(keys.retained, 'Retained'),
      base: value(keys.placed),
      count: value(keys.retained),
      baseLabel: 'placed',
    },
  ].map((row): Measure => {
    const target = Number.isFinite(Number(targets[row.key])) ? Number(targets[row.key]) : null;
    const rate = ratio(row.count, row.base);
    return {
      key: row.key,
      label: row.label,
      now: rate,
      target,
      shown: row.base ? percent(rate) : 'None yet',
      caption: `${row.count} of ${row.base} ${row.baseLabel}${target !== null ? `, target ${percent(target)}` : ''}`,
    };
  });

  const rows: Measure[] = [enrolledRow, ...rates];

  const anyNumbers = items.some((item) => value(item.key) > 0);
  if (!anyNumbers && !enrolledTarget) {
    return (
      <EmptyState
        title="No numbers yet"
        body="The steps people pass through and the targets are project settings. Once they are there, the counts go in with Edit numbers."
      />
    );
  }

  const gap = Math.max(0, enrolledTarget - enrolled);
  const lastCohort = milestones.last_cohort_start ?? '';
  const monthsLeft = monthsFromToday(lastCohort);
  const pace =
    !enrolledTarget
      ? null
      : gap === 0
        ? 'The enrolment target has been met.'
        : monthsLeft === null
          ? `${plural(gap, 'person', 'people')} still to enrol. No last cohort date is recorded to pace against.`
          : monthsLeft <= 0
            ? `${plural(gap, 'person', 'people')} still to enrol, and the last cohort date has passed.`
            : `${plural(gap, 'person', 'people')} still to enrol before the last cohort starts on ${formatDate(lastCohort)}: about ${Math.ceil(gap / monthsLeft)} a month.`;
  const asOf = textFrom(metrics, 'as_of');

  return (
    <>
      <ul class="wb-measures">
        {rows.map((row) => {
          const mark = row.target !== null ? standing(row.now, row.target) : null;
          return (
            <li class="wb-measure" key={row.key}>
              <div class="wb-measure-head">
                <span class="wb-measure-label">{row.label}</span>
                <span class="wb-measure-value wb-mono">{row.shown}</span>
              </div>
              <Bar
                value={row.now}
                target={row.target}
                tone={mark ? mark.tone : 'accent'}
                title={`${row.label}: ${row.shown}${mark ? `, ${mark.word}` : ''}`}
              />
              <p class="wb-measure-caption">
                <span class="wb-mono-soft">{row.caption}</span>
                {mark ? <span class={`wb-standing is-${mark.tone}`}>{mark.word}</span> : null}
              </p>
            </li>
          );
        })}
      </ul>
      {pace ? <p class="wb-pace">{pace}</p> : null}
      {asOf ? <p class="wb-mono-soft wb-asof-line">Counts as of {formatDate(asOf)}</p> : null}
    </>
  );
}

/* -------------------------------------------------------------- budget --- */

function BudgetSummary() {
  const { config } = useProject();
  const [state] = useProjectState('budget');
  const lines = budgetLines(config);
  const categories = budgetCategories(config);
  const billed = objectFrom(state, 'billed');
  const paid = numberFrom(state, 'paid');
  const award = Number(config.award) || 0;
  const term = termProgress(config);

  if (!lines.length) {
    return (
      <EmptyState
        title="No budget lines are set up"
        body="The lines and what each was approved for are project settings. An administrator can add them in Settings."
      />
    );
  }

  const billedFor = (line: BudgetLineDef) => numberFrom(billed, line.id);
  const names = [...categories.map((category) => category.name)];
  for (const line of lines) if (!names.includes(line.category)) names.push(line.category);

  const approvedTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const billedTotal = lines.reduce((sum, line) => sum + billedFor(line), 0);
  const denominator = award || approvedTotal;
  const share = ratio(billedTotal, denominator);

  return (
    <>
      <div class="wb-budget-top">
        <div>
          <p class="wb-measure-label">Billed</p>
          <p class="wb-budget-big wb-mono">{money(billedTotal)}</p>
          <p class="wb-mono-soft">of {money(denominator)}</p>
        </div>
        <div>
          <p class="wb-measure-label">Reimbursed</p>
          <p class="wb-budget-big wb-mono">{money(paid)}</p>
          <p class="wb-mono-soft">{billedTotal > paid ? `${money(billedTotal - paid)} waiting` : 'nothing waiting'}</p>
        </div>
        <div>
          <p class="wb-measure-label">Term used</p>
          <p class="wb-budget-big wb-mono">{term.elapsed === null ? 'Not set' : percent(term.elapsed)}</p>
          <p class="wb-mono-soft">against {percent(share)} billed</p>
        </div>
      </div>

      <div class="wb-budget-lines">
        {names.map((name) => {
          const own = lines.filter((line) => line.category === name);
          if (!own.length) return null;
          const category = categories.find((entry) => entry.name === name);
          const total = category?.total || own.reduce((sum, line) => sum + line.amount, 0);
          const spent = own.reduce((sum, line) => sum + billedFor(line), 0);
          return (
            <section class="wb-budget-group" key={name || 'none'}>
              <header class="wb-budget-group-head">
                <span class="wb-budget-group-name">{name || 'Not in a category'}</span>
                <span class="wb-mono-soft">
                  {money(spent)} of {money(total)}
                  {category?.rule === 'decrease_only' ? ' · can only decrease' : ''}
                </span>
              </header>
              <ul>
                {own.map((line) => {
                  const used = ratio(billedFor(line), line.amount);
                  return (
                    <li class="wb-budget-line" key={line.id}>
                      <span class="wb-budget-line-label">{line.label}</span>
                      <Bar
                        value={used}
                        target={term.elapsed}
                        targetLabel="Term used"
                        tone={used > 1.001 ? 'crit' : used > 0.9 ? 'warn' : 'accent'}
                        title={`${line.label}: ${money(billedFor(line))} billed of ${money(line.amount)}`}
                      />
                      <span class="wb-budget-line-amount wb-mono">{percent(used)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <p class="wb-mono-soft wb-asof-line">The tick on each bar is how much of the term has gone.</p>
    </>
  );
}
