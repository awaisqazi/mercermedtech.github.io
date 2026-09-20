/**
 * Reports: one row per reporting period, in the order they fall due.
 *
 * What a period consists of is a setting, not a fact about any grant:
 * `config.report_checks` gives the checklist, the statuses come from the
 * database's own enum, and the money claimed is whatever was claimed. The
 * table is the whole editing surface — every control writes straight through
 * to the row — and the documents underneath are the place for the wording
 * that does not fit in a cell.
 *
 * Two rows are called out, in words as well as in colour: the next one due,
 * and any that is past its due date and has not been submitted.
 */
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import {
  insertRow,
  updateRow,
  useProject,
  useReports,
} from '../../lib/store';
import { daysUntil, dueWording, formatMonth, money, plural } from '../../lib/format';
import { toast } from '../../lib/toasts';
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABEL,
  type Report,
  type ReportKind,
  type ReportStatus,
} from '../../lib/types';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DocsSection } from '../../components/DocsSection';
import { EmptyState } from '../../components/EmptyState';
import { Field, Input } from '../../components/Field';
import { LiveDate, LiveNumber, LiveSelect, LiveText } from '../../components/LiveField';
import { Select, optionsFrom } from '../../components/Select';
import { SourcesList } from '../../components/SourcesList';
import { IconDocument, IconPlus } from '../../components/Icons';
import { checkDefs, checksReady, isSettledReport as isSettled } from './shared';

const REPORT_KINDS: ReportKind[] = ['monthly', 'closeout'];
const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  monthly: 'Monthly',
  closeout: 'Closeout',
};

export function Reports() {
  const reports = useReports();
  const { config, readOnly, canManage } = useProject();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  const checks = checkDefs(config.report_checks);

  const overdueIds = new Set(
    reports
      .filter((report) => {
        if (isSettled(report)) return false;
        const days = daysUntil(report.due);
        return days !== null && days < 0;
      })
      .map((report) => report.id)
  );
  const nextDue = reports.find((report) => !isSettled(report) && !overdueIds.has(report.id)) ?? null;

  // Column count, for the full-width Files row underneath each report.
  const columns = 7 + (checks.length ? 1 : 0);

  const claimed = reports
    .filter(isSettled)
    .reduce((total, report) => total + (Number(report.amount) || 0), 0);
  const planned = reports.reduce((total, report) => total + (Number(report.amount) || 0), 0);

  const byStatus = REPORT_STATUSES.map((status) => ({
    status,
    count: reports.filter((report) => report.status === status).length,
  })).filter((entry) => entry.count > 0);

  const toggleCheck = async (report: Report, key: string, on: boolean) => {
    // The checkbox owns one key; everything else in `checks` is left alone.
    const next = { ...(report.checks ?? {}), [key]: on };
    const result = await updateRow('reports', report.id, { checks: next });
    if (!result.ok && result.error) toast.bad(result.error.message);
  };

  const saveSources = async (report: Report, sources: Report['sources']) => {
    const result = await updateRow('reports', report.id, { sources });
    if (!result.ok && result.error) toast.bad(result.error.message);
  };

  return (
    <div class="wb-stack">
      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">
            Reports
            <span class="wb-panel-count wb-mono-soft"> {reports.length}</span>
          </h2>
          {canManage && !adding ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<IconPlus size={15} />}
              onClick={() => setAdding(true)}
            >
              Add report period
            </Button>
          ) : null}
        </header>

        {adding ? (
          <AddReport
            existing={reports}
            onClose={() => setAdding(false)}
          />
        ) : null}

        {reports.length === 0 ? (
          <EmptyState
            icon={<IconDocument size={22} />}
            title="No reporting periods yet"
            body={
              canManage
                ? 'Add one period per report that is owed, with the month it is due in. The checklist comes from the project settings.'
                : 'Nobody has set up the reporting periods for this project yet.'
            }
            action={
              canManage && !adding ? (
                <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>
                  Add the first period
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div class="wb-table-scroll">
              <table class="wb-table wb-stacked wb-reports-table">
                <caption class="wb-sr">Reporting periods, earliest due first</caption>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col">Due</th>
                    <th scope="col">Covers</th>
                    <th scope="col">Status</th>
                    {checks.length ? <th scope="col">Checklist</th> : null}
                    <th scope="col">Amount</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {reports.map((report) => {
                    const overdue = overdueIds.has(report.id);
                    const next = nextDue?.id === report.id;
                    const ready = checksReady(report, checks);
                    const showFiles = Boolean(open[report.id]);
                    const rowClass = [
                      'wb-report-row',
                      overdue ? 'is-overdue-row' : '',
                      next ? 'is-next-row' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <Fragment key={report.id}>
                        <tr class={rowClass}>
                          <th scope="row" data-label="Period">
                            <span class="wb-report-period">
                              <span class="wb-report-month">{formatMonth(report.period) || report.period}</span>
                              <span class="wb-report-flags">
                                <Chip tone="quiet">{REPORT_KIND_LABEL[report.kind] ?? report.kind}</Chip>
                                {overdue ? <Chip tone="crit">Overdue</Chip> : null}
                                {next ? <Chip tone="accent">Next due</Chip> : null}
                              </span>
                            </span>
                          </th>

                          <td data-label="Due">
                            <LiveDate
                              table="reports"
                              id={report.id}
                              field="due"
                              value={report.due}
                              label={`Due date for ${report.period}`}
                              hideLabel
                              readOnly={readOnly}
                            />
                            {report.due && !isSettled(report) ? (
                              <span class={`wb-report-when wb-mono-soft${overdue ? ' is-overdue' : ''}`}>
                                {dueWording(report.due)}
                              </span>
                            ) : null}
                          </td>

                          <td data-label="Covers">
                            <LiveText
                              table="reports"
                              id={report.id}
                              field="covers"
                              value={report.covers ?? ''}
                              label={`What ${report.period} covers`}
                              hideLabel
                              placeholder="The period it reports on"
                              readOnly={readOnly}
                            />
                          </td>

                          <td data-label="Status">
                            <LiveSelect<ReportStatus>
                              table="reports"
                              id={report.id}
                              field="status"
                              value={report.status}
                              label={`Status of ${report.period}`}
                              hideLabel
                              size="sm"
                              options={optionsFrom(REPORT_STATUSES, REPORT_STATUS_LABEL)}
                              readOnly={readOnly}
                            />
                          </td>

                          {checks.length ? (
                            <td data-label="Checklist">
                              <div class="wb-checkchips">
                                {checks.map((def) => {
                                  const on = Boolean((report.checks ?? {})[def.key]);
                                  const full = `${def.label} — ${formatMonth(report.period) || report.period}`;
                                  return (
                                    <button
                                      key={def.key}
                                      type="button"
                                      class="wb-checkchip"
                                      aria-pressed={on}
                                      title={full}
                                      aria-label={full}
                                      disabled={readOnly}
                                      onClick={() => void toggleCheck(report, def.key, !on)}
                                    >
                                      <span class="wb-checkchip-tick" aria-hidden="true" />
                                      <span class="wb-checkchip-text">{def.short}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <span class="wb-report-ready wb-mono-soft">
                                {ready} of {checks.length} ready
                              </span>
                            </td>
                          ) : null}

                          <td data-label="Amount">
                            <LiveNumber
                              table="reports"
                              id={report.id}
                              field="amount"
                              value={report.amount}
                              label={`Amount claimed for ${report.period}`}
                              hideLabel
                              min={0}
                              step={0.01}
                              allowNull
                              placeholder="$"
                              readOnly={readOnly}
                            />
                          </td>

                          <td data-label="Submitted">
                            <LiveDate
                              table="reports"
                              id={report.id}
                              field="submitted_on"
                              value={report.submitted_on}
                              label={`Date ${report.period} was submitted`}
                              hideLabel
                              readOnly={readOnly}
                            />
                          </td>

                          <td data-label="Notes">
                            <LiveText
                              table="reports"
                              id={report.id}
                              field="notes"
                              value={report.notes}
                              label={`Notes on ${report.period}`}
                              hideLabel
                              placeholder="Anything worth remembering"
                              readOnly={readOnly}
                            />
                            <Button
                              variant="quiet"
                              size="sm"
                              aria-expanded={showFiles}
                              onClick={() =>
                                setOpen((current) => ({ ...current, [report.id]: !current[report.id] }))
                              }
                            >
                              {showFiles ? 'Hide files' : `Files (${(report.sources ?? []).length})`}
                            </Button>
                          </td>
                        </tr>

                        {showFiles ? (
                          <tr class="wb-report-files">
                            <td colSpan={columns} data-label="Files">
                              <SourcesList
                                sources={report.sources ?? []}
                                title={`Files for ${formatMonth(report.period) || report.period}`}
                                readOnly={readOnly}
                                onChange={(next) => void saveSources(report, next)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr class="wb-report-total">
                    <th scope="row" data-label="Totals">
                      Totals
                    </th>
                    <td data-label="Periods" class="wb-mono-soft">
                      {plural(reports.length, 'period')}
                    </td>
                    <td data-label="Claimed so far" class="wb-mono">
                      {money(claimed)} claimed
                    </td>
                    <td data-label="All periods" class="wb-mono-soft" colSpan={columns - 3}>
                      {money(planned)} across every period
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p class="wb-panel-foot">
              <span class="wb-report-counts">
                {byStatus.map((entry) => (
                  <Chip key={entry.status} tone={entry.status === 'not_started' ? 'quiet' : 'neutral'}>
                    {REPORT_STATUS_LABEL[entry.status]}: {entry.count}
                  </Chip>
                ))}
              </span>
            </p>
          </>
        )}

        {reports.length > 0 && checks.length === 0 ? (
          <p class="wb-hint">
            No checklist is set up for this project, so each period shows the money and the dates only.
            An administrator can add one in Settings.
          </p>
        ) : null}
      </section>

      <DocsSection
        section="notes:reports"
        title="Notes on reporting"
        intro="How a report is put together, and anything the funder has told us about it."
        emptyBody="Write down how a report gets built, so the next person does not have to work it out from the last one."
      />
    </div>
  );
}

/** The inline form for a new period. Managers only; the database agrees. */
function AddReport({ existing, onClose }: { existing: Report[]; onClose: () => void }) {
  const [period, setPeriod] = useState('');
  const [due, setDue] = useState('');
  const [covers, setCovers] = useState('');
  const [kind, setKind] = useState<ReportKind>('monthly');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    const month = period.trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError('Pick the month the report is due in.');
      return;
    }
    if (existing.some((report) => report.period === month)) {
      setError('There is already a period for that month.');
      return;
    }
    setError(null);
    setSaving(true);
    const result = await insertRow<Report>('reports', {
      period: month,
      due: due || null,
      covers: covers.trim(),
      kind,
      status: 'not_started',
      checks: {},
      sources: [],
      notes: '',
    });
    setSaving(false);
    if (result.ok) {
      toast.good('Period added.');
      onClose();
    } else if (result.error) {
      setError(result.error.message);
    }
  };

  return (
    <form class="wb-grant-form" onSubmit={submit}>
      <Field label="Month it is due" required error={error}>
        {(props) => (
          <Input
            {...props}
            type="month"
            class="wb-mono"
            value={period}
            onInput={(event) => setPeriod((event.currentTarget as HTMLInputElement).value)}
          />
        )}
      </Field>
      <Field label="Due date">
        {(props) => (
          <Input
            {...props}
            type="date"
            class="wb-mono"
            value={due}
            onInput={(event) => setDue((event.currentTarget as HTMLInputElement).value)}
          />
        )}
      </Field>
      <Field label="What it covers" hint="The stretch of time the report is about.">
        {(props) => (
          <Input
            {...props}
            value={covers}
            onInput={(event) => setCovers((event.currentTarget as HTMLInputElement).value)}
          />
        )}
      </Field>
      <Field label="Kind">
        {(props) => (
          <Select<ReportKind>
            {...props}
            value={kind}
            options={optionsFrom(REPORT_KINDS, REPORT_KIND_LABEL)}
            onValue={setKind}
          />
        )}
      </Field>
      <div class="wb-grant-form-actions">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving}>
          Add period
        </Button>
      </div>
    </form>
  );
}
