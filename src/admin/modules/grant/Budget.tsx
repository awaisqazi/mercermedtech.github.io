/**
 * Budget: what was approved, what has been billed, and whether the pace of the
 * billing still fits inside the term.
 *
 * The lines and the categories are settings (`config.budget_lines`,
 * `config.budget_categories`), the money billed lives in
 * `state.budget.billed[lineId]`, and the rule on a category — whether it can
 * move both ways or only downwards — is printed in words beside its subtotal,
 * because that is the kind of thing people forget between reports.
 */
import {
  useProject,
  useProjectState,
} from '../../lib/store';
import { formatDate, formatDateLong, money, percent, ratio, today } from '../../lib/format';
import type { BudgetLineDef } from '../../lib/types';
import { Bar } from '../../components/Bar';
import { Chip } from '../../components/Chip';
import { DocsSection } from '../../components/DocsSection';
import { EmptyState } from '../../components/EmptyState';
import { IconWarning } from '../../components/Icons';
import { StateDate, StateNumber } from './StateFields';
import {
  RULE_WORDING,
  addMonths,
  budgetCategories,
  budgetLines,
  formatMonthOf,
  monthsBetween,
  numberFrom,
  objectFrom,
  termProgress,
  textFrom,
} from './shared';

interface Group {
  name: string;
  label: string;
  rule: 'flex' | 'decrease_only' | null;
  /** The agreed total for the category, falling back to the sum of its lines. */
  total: number;
  lines: BudgetLineDef[];
}

export function Budget() {
  const { config, readOnly } = useProject();
  const [budget, patchBudget] = useProjectState('budget');

  const lines = budgetLines(config);
  const categories = budgetCategories(config);
  const billed = objectFrom(budget, 'billed');
  const award = Number(config.award) || 0;
  const asOf = textFrom(budget, 'as_of');
  const paid = numberFrom(budget, 'paid');

  const billedFor = (line: BudgetLineDef) => numberFrom(billed, line.id);

  const saveBilled = (line: BudgetLineDef) => (next: unknown) =>
    patchBudget((current) => ({
      ...current,
      billed: { ...objectFrom(current, 'billed'), [line.id]: next },
    }));

  // Categories in the order the settings give, then anything left over.
  const groups: Group[] = [];
  const used = new Set<string>();
  for (const category of categories) {
    const own = lines.filter((line) => line.category === category.name);
    used.add(category.name);
    groups.push({
      name: category.name,
      label: category.name,
      rule: category.rule,
      total: category.total || own.reduce((sum, line) => sum + line.amount, 0),
      lines: own,
    });
  }
  for (const line of lines) {
    if (used.has(line.category)) continue;
    used.add(line.category);
    const own = lines.filter((entry) => entry.category === line.category);
    groups.push({
      name: line.category,
      label: line.category || 'Not in a category',
      rule: null,
      total: own.reduce((sum, entry) => sum + entry.amount, 0),
      lines: own,
    });
  }

  const approvedTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const billedTotal = lines.reduce((sum, line) => sum + billedFor(line), 0);
  const denominator = award || approvedTotal;
  const billedShare = ratio(billedTotal, denominator);

  const term = termProgress(config);
  const elapsed = term.elapsed;
  const monthsIn = term.start ? monthsBetween(term.start, today()) : null;

  const reading = (() => {
    if (!denominator) return 'No award or approved lines are recorded yet, so there is nothing to compare.';
    if (elapsed === null) {
      return `${money(billedTotal)} of ${money(denominator)} billed. No term dates are recorded, so there is nothing to compare the pace with.`;
    }
    const gap = billedShare - elapsed;
    const shape =
      gap > 0.1
        ? 'billing is running ahead of the term'
        : gap < -0.1
          ? 'billing is running behind the term'
          : 'the two are in step';
    return `${percent(billedShare)} of the money is billed against ${percent(elapsed)} of the term: ${shape}.`;
  })();

  /**
   * A category that can only shrink cannot be topped up later, so the question
   * worth asking is when the current pace would use it all up. We only say
   * anything when that lands before the end of the term.
   */
  const runway = groups
    .map((group) => {
      if (group.rule !== 'decrease_only' || !group.total) return null;
      const spent = group.lines.reduce((sum, line) => sum + billedFor(line), 0);
      const remaining = group.total - spent;
      if (spent <= 0 || remaining <= 0 || monthsIn === null || monthsIn <= 0.25) return null;
      const perMonth = spent / monthsIn;
      if (perMonth <= 0) return null;
      const exhausted = addMonths(today(), remaining / perMonth);
      if (!term.end || exhausted >= term.end) return null;
      return { group, exhausted, perMonth, remaining };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const planningNote = typeof config.planning_note === 'string' ? config.planning_note.trim() : '';

  if (!lines.length) {
    return (
      <div class="wb-stack">
        <section class="wb-panel">
          <header class="wb-panel-head">
            <h2 class="wb-panel-title">Budget</h2>
          </header>
          <EmptyState
            title="No budget lines are set up"
            body="The lines, their categories and what each one was approved for are project settings. An administrator can add them in Settings, and what has been billed can be recorded here afterwards."
          />
        </section>
        <DocsSection section="notes:budget" title="Notes on the budget" />
      </div>
    );
  }

  return (
    <div class="wb-stack">
      <section class="wb-panel">
        <header class="wb-panel-head">
          <div>
            <h2 class="wb-panel-title">Budget</h2>
            <p class="wb-page-sub">
              {award ? `${money(award)} awarded` : 'No award recorded'}
              {config.term_start && config.term_end
                ? ` · ${formatDate(config.term_start)} to ${formatDate(config.term_end)}`
                : ''}
            </p>
          </div>
          <div class="wb-grant-inline">
            <StateNumber
              label="Reimbursed to date"
              value={paid}
              min={0}
              step={0.01}
              integer={false}
              readOnly={readOnly}
              onSave={(next) => patchBudget((current) => ({ ...current, paid: next }))}
            />
            <StateDate
              label="As of"
              value={asOf}
              readOnly={readOnly}
              onSave={(next) => patchBudget((current) => ({ ...current, as_of: next }))}
            />
          </div>
        </header>

        <div class="wb-table-scroll">
          <table class="wb-table wb-stacked wb-budget-table">
            <caption class="wb-sr">Budget lines by category</caption>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">Approved</th>
                <th scope="col">Billed to date</th>
                <th scope="col">Remaining</th>
                <th scope="col">Used</th>
              </tr>
            </thead>

            {groups.map((group) => {
              const groupBilled = group.lines.reduce((sum, line) => sum + billedFor(line), 0);
              const groupRemaining = group.total - groupBilled;

              return (
                <tbody key={group.label}>
                  <tr class="wb-budget-cat">
                    <th scope="colgroup" colSpan={5} data-label="Category">
                      <span class="wb-budget-cat-name">{group.label}</span>
                      {group.rule ? (
                        <Chip tone={group.rule === 'decrease_only' ? 'warn' : 'quiet'}>
                          {RULE_WORDING[group.rule]}
                        </Chip>
                      ) : null}
                    </th>
                  </tr>

                  {group.lines.map((line) => {
                    const spent = billedFor(line);
                    const remaining = line.amount - spent;
                    const share = ratio(spent, line.amount);
                    return (
                      <tr key={line.id}>
                        <th scope="row" data-label="Line">
                          {line.label}
                        </th>
                        <td data-label="Approved" class="wb-mono">
                          {money(line.amount)}
                        </td>
                        <td data-label="Billed to date">
                          <StateNumber
                            label={`Billed to date for ${line.label}`}
                            hideLabel
                            value={spent}
                            min={0}
                            step={0.01}
                            integer={false}
                            readOnly={readOnly}
                            class="wb-budget-input"
                            onSave={saveBilled(line)}
                          />
                        </td>
                        <td data-label="Remaining" class={`wb-mono${remaining < 0 ? ' is-overdue' : ''}`}>
                          {money(remaining)}
                        </td>
                        <td data-label="Used" class="wb-budget-used">
                          <Bar
                            value={share}
                            tone={share > 1.001 ? 'crit' : share > 0.9 ? 'warn' : 'accent'}
                            title={`${line.label}: ${percent(share)} used`}
                          />
                          <span class="wb-mono-soft">{line.amount ? percent(share) : '—'}</span>
                        </td>
                      </tr>
                    );
                  })}

                  <tr class="wb-budget-subtotal">
                    <th scope="row" data-label="Subtotal">
                      {group.label} subtotal
                    </th>
                    <td data-label="Approved" class="wb-mono">
                      {money(group.total)}
                    </td>
                    <td data-label="Billed to date" class="wb-mono">
                      {money(groupBilled)}
                    </td>
                    <td data-label="Remaining" class={`wb-mono${groupRemaining < 0 ? ' is-overdue' : ''}`}>
                      {money(groupRemaining)}
                    </td>
                    <td data-label="Used" class="wb-mono-soft">
                      {group.total ? percent(ratio(groupBilled, group.total)) : '—'}
                    </td>
                  </tr>
                </tbody>
              );
            })}

            <tfoot>
              <tr class="wb-budget-grand">
                <th scope="row" data-label="Total">
                  All lines
                </th>
                <td data-label="Approved" class="wb-mono">
                  {money(approvedTotal)}
                </td>
                <td data-label="Billed to date" class="wb-mono">
                  {money(billedTotal)}
                </td>
                <td data-label="Remaining" class="wb-mono">
                  {money(denominator - billedTotal)}
                </td>
                <td data-label="Used" class="wb-mono-soft">
                  {denominator ? percent(billedShare) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {award > 0 && Math.abs(award - approvedTotal) > 0.5 ? (
          <p class="wb-hint">
            The lines add up to {money(approvedTotal)}, which is {money(Math.abs(award - approvedTotal))}{' '}
            {approvedTotal > award ? 'more than' : 'less than'} the {money(award)} award.
          </p>
        ) : null}

        <p class="wb-reading">{reading}</p>
        <p class="wb-mono-soft">
          {money(paid)} reimbursed{asOf ? ` as of ${formatDate(asOf)}` : ''}
          {billedTotal > 0 ? ` · ${money(Math.max(0, billedTotal - paid))} billed and not yet paid` : ''}
        </p>

        {runway.map((entry) => (
          <div class="wb-notice wb-notice-warn" role="note" key={entry.group.label}>
            <span class="wb-notice-icon" aria-hidden="true">
              <IconWarning size={18} />
            </span>
            <div>
              <p class="wb-notice-title">{entry.group.label} would run out before the term ends</p>
              <p class="wb-notice-body">
                {money(entry.remaining)} is left and the billing so far averages{' '}
                {money(entry.perMonth)} a month, which would use it up around{' '}
                {formatMonthOf(entry.exhausted)}
                {term.end ? `, before the term ends on ${formatDateLong(config.term_end)}` : ''}. This
                category can only decrease, so it cannot be topped up later.
              </p>
            </div>
          </div>
        ))}

        {planningNote ? <p class="wb-hint">{planningNote}</p> : null}
      </section>

      <DocsSection
        section="notes:budget"
        title="Notes on the budget"
        intro="What each line may be spent on, and anything the funder has said about moving money between them."
        emptyBody="Write down what a line covers and what it does not, so a question about an invoice can be answered without reading the contract again."
      />
    </div>
  );
}
