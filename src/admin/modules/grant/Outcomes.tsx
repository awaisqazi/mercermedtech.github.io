/**
 * Outcomes: how many people have reached each step, what was promised, and
 * whether the pace still adds up.
 *
 * The steps come from `config.funnel`, the promises from `config.targets`, the
 * dates from `config.milestones`, and the numbers themselves from
 * `state.metrics` — so this file describes a funnel in general and no grant in
 * particular. An entry may say `side: true` to mean "a count worth keeping,
 * but not a step people pass through"; when it does not, a key ending in
 * `_late`, `exited` or `not_enrolled` is treated the same way.
 *
 * Counts only. The standing note says so, because the rule matters more than
 * the layout.
 */
import {
  useProject,
  useProjectState,
} from '../../lib/store';
import {
  formatDate,
  formatDateLong,
  humanize,
  percent,
  plural,
  ratio,
} from '../../lib/format';
import { Bar } from '../../components/Bar';
import { Chip } from '../../components/Chip';
import { DocsSection } from '../../components/DocsSection';
import { EmptyState } from '../../components/EmptyState';
import { IconWarning } from '../../components/Icons';
import { StateDate, StateNumber } from './StateFields';
import {
  funnelItems,
  isSideStep,
  metricKeys,
  monthsFromToday,
  numberFrom,
  textFrom,
} from './shared';

/** The rates a grant is usually judged on, each with the count underneath it. */
interface RateRow {
  targetKey: string;
  label: string;
  /** The metric that counts the people who got there. */
  metric: string;
  /** The metric it is measured against. */
  base: string;
  baseLabel: string;
}

export function Outcomes() {
  const { config, readOnly } = useProject();
  const [metrics, patchMetrics] = useProjectState('metrics');

  const items = funnelItems(config);
  const steps = items.filter((item) => !isSideStep(item));
  const sides = items.filter((item) => isSideStep(item));
  const keys = metricKeys(config);
  const targets = (config.targets ?? {}) as Record<string, number>;
  const milestones = (config.milestones ?? {}) as Record<string, string>;

  const labelFor = (key: string) => items.find((item) => item.key === key)?.label ?? humanize(key);
  const valueOf = (key: string) => numberFrom(metrics, key);

  const save = (key: string) => (next: unknown) =>
    patchMetrics((current) => ({ ...current, [key]: next }));

  const largest = steps.reduce((high, step) => Math.max(high, valueOf(step.key)), 0);

  const enrolled = valueOf(keys.enrolled);
  const enrolledTarget = Number(targets.enrolled) || 0;
  const enrolmentGap = Math.max(0, enrolledTarget - enrolled);

  const rateRows: RateRow[] = [
    {
      targetKey: 'credential_rate',
      label: labelFor(keys.credentialed),
      metric: keys.credentialed,
      base: keys.enrolled,
      baseLabel: 'enrolled',
    },
    {
      targetKey: 'placement_rate',
      label: labelFor(keys.placed),
      metric: keys.placed,
      base: keys.enrolled,
      baseLabel: 'enrolled',
    },
    {
      targetKey: 'retention_rate',
      label: labelFor(keys.retained),
      metric: keys.retained,
      base: keys.placed,
      baseLabel: 'placed',
    },
  ].filter((row) => Number.isFinite(Number(targets[row.targetKey])));

  /**
   * How big the base would be if the enrolment target were met. For a rate
   * measured against placements that means "the placement target applied to
   * the enrolment target", which is the only honest way to chain the two.
   */
  const baseAtTarget = (row: RateRow): number | null => {
    if (!enrolledTarget) return null;
    if (row.base === keys.enrolled) return enrolledTarget;
    if (row.base === keys.placed) {
      const placementTarget = Number(targets.placement_rate);
      if (!Number.isFinite(placementTarget)) return null;
      return Math.ceil(placementTarget * enrolledTarget);
    }
    return null;
  };

  const asOf = textFrom(metrics, 'as_of');
  const lastCohort = milestones.last_cohort_start ?? '';
  const monthsLeft = monthsFromToday(lastCohort);
  const perMonth =
    monthsLeft !== null && monthsLeft > 0.05 && enrolmentGap > 0 ? enrolmentGap / monthsLeft : null;

  return (
    <div class="wb-stack">
      <div class="wb-notice wb-notice-warn" role="note">
        <span class="wb-notice-icon" aria-hidden="true">
          <IconWarning size={18} />
        </span>
        <div>
          <p class="wb-notice-title">Counts only</p>
          <p class="wb-notice-body">
            Never enter participant names or case numbers here. This page holds how many people, not
            which people.
          </p>
        </div>
      </div>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <div>
            <h2 class="wb-panel-title">The funnel</h2>
            <p class="wb-page-sub">Each step is a count of people who have reached it.</p>
          </div>
          <StateDate
            label="As of"
            value={asOf}
            readOnly={readOnly}
            class="wb-asof"
            onSave={save('as_of')}
          />
        </header>

        {steps.length === 0 ? (
          <EmptyState
            title="No funnel has been set up"
            body="The steps people pass through are a project setting. An administrator can add them in Settings, and the numbers will appear here."
          />
        ) : (
          <ol class="wb-funnel">
            {steps.map((step, index) => {
              const value = valueOf(step.key);
              const previous = index > 0 ? steps[index - 1]! : null;
              const previousValue = previous ? valueOf(previous.key) : 0;
              const conversion = previous && previousValue > 0 ? ratio(value, previousValue) : null;

              return (
                <li class="wb-funnel-row" key={step.key}>
                  <div class="wb-funnel-head">
                    <span class="wb-funnel-label">{step.label}</span>
                    <StateNumber
                      label={`${step.label} count`}
                      hideLabel
                      value={value}
                      min={0}
                      step={1}
                      readOnly={readOnly}
                      class="wb-funnel-input"
                      onSave={save(step.key)}
                    />
                  </div>
                  <Bar
                    value={largest ? value / largest : 0}
                    tone="accent"
                    title={`${step.label}: ${value}`}
                    height={10}
                  />
                  <p class="wb-funnel-conv wb-mono-soft">
                    {conversion === null
                      ? index === 0
                        ? 'The top of the funnel'
                        : `No ${previous?.label.toLowerCase() ?? 'earlier'} count yet`
                      : `${percent(conversion)} of ${previous!.label.toLowerCase()}`}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {sides.length ? (
          <div class="wb-sides">
            <h3 class="wb-sides-title">Counted separately</h3>
            <p class="wb-page-sub">
              These sit beside the funnel rather than inside it, so they are not part of the
              step-to-step conversion.
            </p>
            <div class="wb-sides-grid">
              {sides.map((item) => (
                <StateNumber
                  key={item.key}
                  label={item.label}
                  value={valueOf(item.key)}
                  min={0}
                  step={1}
                  readOnly={readOnly}
                  onSave={save(item.key)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Targets</h2>
          {asOf ? <span class="wb-mono-soft">As of {formatDate(asOf)}</span> : null}
        </header>

        {!enrolledTarget && rateRows.length === 0 ? (
          <EmptyState
            title="No targets recorded"
            body="Targets are a project setting: an enrolment number and the rates that go with it. An administrator can add them in Settings."
          />
        ) : (
          <>
            {enrolledTarget ? (
              <div class="wb-target-headline">
                <div>
                  <p class="wb-tile-label">{labelFor(keys.enrolled)}</p>
                  <p class="wb-tile-value wb-mono">
                    {enrolled} <span class="wb-target-of">of {enrolledTarget}</span>
                  </p>
                </div>
                <Bar
                  value={ratio(enrolled, enrolledTarget)}
                  target={1}
                  tone={enrolled >= enrolledTarget ? 'good' : 'accent'}
                  title={`${labelFor(keys.enrolled)}: ${enrolled} of ${enrolledTarget}`}
                  targetLabel="Target"
                />
                <p class="wb-reading">
                  {enrolmentGap === 0
                    ? 'The enrolment target has been met.'
                    : `${plural(enrolmentGap, 'person', 'people')} still to enrol.`}
                </p>
              </div>
            ) : null}

            {rateRows.length ? (
              <div class="wb-table-scroll">
                <table class="wb-table wb-stacked">
                  <caption class="wb-sr">Rate targets, with the counts behind them</caption>
                  <thead>
                    <tr>
                      <th scope="col">Measure</th>
                      <th scope="col">Target</th>
                      <th scope="col">Now</th>
                      <th scope="col">Needed at today&rsquo;s numbers</th>
                      <th scope="col">Needed if the target is met</th>
                      <th scope="col">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateRows.map((row) => {
                      const target = Number(targets[row.targetKey]);
                      const value = valueOf(row.metric);
                      const base = valueOf(row.base);
                      const rate = ratio(value, base);
                      const neededNow = base ? Math.ceil(target * base) : null;
                      const projected = baseAtTarget(row);
                      const neededAtTarget = projected === null ? null : Math.ceil(target * projected);
                      const gap = neededNow === null ? 0 : Math.max(0, neededNow - value);

                      return (
                        <tr key={row.targetKey}>
                          <th scope="row" data-label="Measure">
                            {row.label}
                            <span class="wb-target-base wb-mono-soft"> of {row.baseLabel}</span>
                          </th>
                          <td data-label="Target" class="wb-mono">
                            {percent(target)}
                          </td>
                          <td data-label="Now" class="wb-mono">
                            {base ? percent(rate) : 'None'}
                            <span class="wb-mono-soft"> ({value} of {base})</span>
                          </td>
                          <td data-label="Needed at today's numbers" class="wb-mono">
                            {neededNow === null ? 'None' : neededNow}
                          </td>
                          <td data-label="Needed if the target is met" class="wb-mono">
                            {neededAtTarget === null ? 'None' : neededAtTarget}
                          </td>
                          <td data-label="Gap" class="wb-mono">
                            {neededNow === null ? (
                              'None'
                            ) : gap === 0 ? (
                              <Chip tone="good">On target</Chip>
                            ) : (
                              <Chip tone="warn">{plural(gap, 'person', 'people')} short</Chip>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Pace</h2>
        </header>

        {lastCohort ? (
          <p class="wb-reading">
            {monthsLeft === null ? (
              'The last cohort start date is not a date we can read.'
            ) : monthsLeft <= 0 ? (
              <>The last cohort could start on {formatDateLong(lastCohort)}, which has passed.</>
            ) : enrolmentGap === 0 ? (
              <>
                {monthsLeft.toFixed(1)} months until the last cohort can start, and the enrolment
                target is already met.
              </>
            ) : perMonth === null ? (
              <>{monthsLeft.toFixed(1)} months until the last cohort can start.</>
            ) : (
              <>
                {plural(enrolmentGap, 'person', 'people')} still to enrol in {monthsLeft.toFixed(1)}{' '}
                months: about {Math.ceil(perMonth)} a month.
              </>
            )}
          </p>
        ) : (
          <p class="wb-hint">
            No last-cohort date is recorded, so there is nothing to pace against. An administrator
            can add the milestones in Settings.
          </p>
        )}

        {Object.keys(milestones).length ? (
          <dl class="wb-kv">
            {Object.entries(milestones).map(([key, value]) => (
              <div key={key}>
                <dt>{humanize(key)}</dt>
                <dd class="wb-mono">{formatDateLong(value) || value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <DocsSection
        section="notes:outcomes"
        title="Notes on outcomes"
        intro="How each of these counts is defined, and where the number comes from."
        emptyBody="Write down what counts as enrolled, credentialed or placed, so the same number means the same thing every month."
      />
    </div>
  );
}
