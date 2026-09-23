/**
 * Reports: one line per reporting month, in the order they fall due, drawn
 * as a timeline. The next one due stands out; sent ones shrink to a line;
 * ones still to come stay quiet. Each line opens the report's panel, which
 * holds the checklist, the money, the dates, the notes, the files, the
 * comments and the history, plus a read-only "pre-submission check".
 *
 * What a report consists of is a setting, not a fact about any grant:
 * `config.report_checks` gives the checklist, the statuses come from the
 * database's own enum, and the money claimed is whatever was claimed.
 */
import { useEffect, useState } from 'preact/hooks';
import { insertRow, setPresence, updateRow, useProject, useReports } from '../../lib/store';
import { setQuery, useRoute } from '../../lib/router';
import { daysUntil, dueWording, formatDate, formatMonth, money, plural } from '../../lib/format';
import { toast } from '../../lib/toasts';
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABEL,
  type Report,
  type ReportKind,
  type ReportStatus,
} from '../../lib/types';
import { Button } from '../../components/Button';
import { CommentThread } from '../../components/CommentThread';
import { Dialog } from '../../components/Dialog';
import { DocsSection } from '../../components/DocsSection';
import { EmptyState } from '../../components/EmptyState';
import { Field, Input } from '../../components/Field';
import { History } from '../../components/History';
import { LiveDate, LiveNumber, LiveSelect, LiveText, LiveTextarea } from '../../components/LiveField';
import { Modal } from '../../components/Modal';
import { ProgressRing } from '../../components/ProgressRing';
import { Select, optionsFrom } from '../../components/Select';
import { SourcesList } from '../../components/SourcesList';
import { IconCheck, IconClose, IconDocument, IconPlus } from '../../components/Icons';
import { checkDefs, checksReady, isSettledReport as isSettled, type ReportCheckItem } from './shared';

const REPORT_KINDS: ReportKind[] = ['monthly', 'closeout'];
const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  monthly: 'Monthly',
  closeout: 'Closeout',
};

const STATUS_TONE: Record<ReportStatus, string> = {
  not_started: 'quiet',
  preparing: 'accent',
  submitted: 'neutral',
  returned: 'warn',
  approved: 'good',
  paid: 'good',
};

function isOverdue(report: Report): boolean {
  if (isSettled(report)) return false;
  const days = daysUntil(report.due);
  return days !== null && days < 0;
}

const lowerFirst = (text: string) => (text ? text[0]!.toLowerCase() + text.slice(1) : text);

/** "September 2026", from what it covers when that is set, else its due month. */
const monthOf = (report: Report) => report.covers?.trim() || formatMonth(report.period) || report.period;

export function Reports() {
  const reports = useReports();
  const route = useRoute();
  const { config, canManage } = useProject();
  const [adding, setAdding] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const checks = checkDefs(config.report_checks);
  const nextDue = reports.find((report) => !isSettled(report) && !isOverdue(report)) ?? null;
  const overdue = reports.filter(isOverdue);
  const claimed = reports.filter(isSettled).reduce((sum, report) => sum + (Number(report.amount) || 0), 0);
  const settledCount = reports.filter(isSettled).length;

  const openId = route.query.report || null;
  const open = (id: string | null) => setQuery({ ...route.query, report: id, check: null });
  const openReport = openId ? (reports.find((report) => report.id === openId) ?? null) : null;

  return (
    <section class="wb-reports" aria-label="Reports">
      <div class="wb-section-bar">
        <p class="wb-section-summary">
          {nextDue ? (
            <>
              <strong>Next:</strong> {monthOf(nextDue)}
              {nextDue.due ? `, ${lowerFirst(dueWording(nextDue.due))}` : ''}
              {checks.length ? `, ${checksReady(nextDue, checks)} of ${checks.length} ready` : ''}
            </>
          ) : (
            'Nothing waiting to be sent.'
          )}
          <span class="wb-mono-soft">
            {' '}
            · {settledCount} of {reports.length} sent · {money(claimed) || '$0'} claimed
          </span>
        </p>
        <div class="wb-toolbar">
          <button type="button" class="wb-linkish" onClick={() => setNotesOpen(true)}>
            How we report
          </button>
          {canManage ? (
            <Button variant="secondary" size="sm" icon={<IconPlus size={15} />} onClick={() => setAdding(true)}>
              Add a reporting month
            </Button>
          ) : null}
        </div>
      </div>

      {overdue.length ? (
        <p class="wb-callout is-crit" role="status">
          {plural(overdue.length, 'report is', 'reports are')} past the due date and not sent:{' '}
          {overdue.map((report, index) => (
            <span key={report.id}>
              {index ? ', ' : ''}
              <button type="button" class="wb-linkish" onClick={() => open(report.id)}>
                {monthOf(report)}
              </button>
            </span>
          ))}
          .
        </p>
      ) : null}

      {reports.length === 0 ? (
        <EmptyState
          icon={<IconDocument size={22} />}
          title="No reporting months yet"
          body={
            canManage
              ? 'Add one line per report that is owed, with the month it is due in. The checklist comes from the project settings.'
              : 'Nobody has set up the reporting months for this project yet.'
          }
          action={
            canManage ? (
              <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>
                Add the first month
              </Button>
            ) : null
          }
        />
      ) : (
        <ol class="wb-timeline">
          {reports.map((report) => {
            const settled = isSettled(report);
            const late = isOverdue(report);
            const next = nextDue?.id === report.id;
            const ready = checksReady(report, checks);
            const state = late ? 'is-late' : next ? 'is-next' : settled ? 'is-past' : 'is-future';
            return (
              <li class={`wb-tl-row ${state}${openId === report.id ? ' is-open' : ''}`} key={report.id}>
                <span class="wb-tl-marker" aria-hidden="true">
                  {settled ? <IconCheck size={11} /> : null}
                </span>
                <button
                  type="button"
                  class="wb-tl-main"
                  onClick={() => open(report.id)}
                  aria-label={`${monthOf(report)} report, ${REPORT_STATUS_LABEL[report.status]}. Open it`}
                >
                  <span class="wb-tl-month">
                    {monthOf(report)}
                    {report.kind === 'closeout' ? <span class="wb-tl-kind">Closeout</span> : null}
                    {next ? <span class="wb-tl-flag">Next due</span> : null}
                    {late ? <span class="wb-tl-flag is-crit">Overdue</span> : null}
                  </span>
                  <span class="wb-tl-due wb-mono-soft">
                    {settled
                      ? report.submitted_on
                        ? `Sent ${formatDate(report.submitted_on)}`
                        : 'Sent'
                      : report.due
                        ? next || late
                          ? dueWording(report.due)
                          : `Due ${formatDate(report.due)}`
                        : 'No due date'}
                  </span>
                </button>
                <span class={`wb-pill wb-pill-${STATUS_TONE[report.status]}`}>
                  {REPORT_STATUS_LABEL[report.status]}
                </span>
                {checks.length && !settled ? (
                  <ProgressRing
                    value={ready / checks.length}
                    size={34}
                    thickness={3}
                    label={`${ready}/${checks.length}`}
                    title={`${ready} of ${checks.length} ready`}
                  />
                ) : (
                  <span class="wb-tl-ring-space" aria-hidden="true" />
                )}
                <span class="wb-tl-amount wb-mono">{report.amount !== null ? money(Number(report.amount)) : ''}</span>
              </li>
            );
          })}
        </ol>
      )}

      <ReportModal report={openReport} checks={checks} onClose={() => open(null)} />

      <Dialog open={adding} title="Add a reporting month" onClose={() => setAdding(false)} size="sm">
        <AddReport existing={reports} onClose={() => setAdding(false)} />
      </Dialog>

      <Modal open={notesOpen} title="How we report" onClose={() => setNotesOpen(false)} size="lg" initialFocus="panel">
        <DocsSection
          section="notes:reports"
          intro="How a report is put together, and anything the funder has told us about it."
          emptyBody="Write down how a report gets built, so the next person does not have to work it out from the last one."
        />
      </Modal>
    </section>
  );
}

/* ----------------------------------------------------------- the panel --- */

function ReportModal({
  report,
  checks,
  onClose,
}: {
  report: Report | null;
  checks: ReportCheckItem[];
  onClose: () => void;
}) {
  const { readOnly } = useProject();
  const route = useRoute();
  const checking = route.query.check === '1';
  const id = report?.id ?? '';

  useEffect(() => {
    if (!id) return;
    setPresence({ editing: `report:${id}` });
    return () => setPresence({ editing: '' });
  }, [id]);

  if (!report) return null;

  const ready = checksReady(report, checks);
  const toggle = async (key: string, on: boolean) => {
    const result = await updateRow('reports', report.id, { checks: { ...(report.checks ?? {}), [key]: on } });
    if (!result.ok && result.error) toast.bad(result.error.message);
  };
  const setChecking = (on: boolean) => setQuery({ ...route.query, check: on ? '1' : null });

  const missing = [
    ...checks.filter((def) => !(report.checks ?? {})[def.key]).map((def) => def.label),
    ...(report.amount === null || report.amount === undefined ? ['The amount claimed'] : []),
    ...(!report.due ? ['A due date'] : []),
  ];

  return (
    <Modal
      open
      side
      size="lg"
      title={`${monthOf(report)} report`}
      description={
        <span class="wb-mono-soft">
          {REPORT_KIND_LABEL[report.kind]} · due {report.due ? formatDate(report.due) : 'date not set'} · {REPORT_STATUS_LABEL[report.status]}
        </span>
      }
      onClose={onClose}
      initialFocus="panel"
      actions={
        <Button variant="quiet" size="sm" onClick={() => setChecking(!checking)}>
          {checking ? 'Back to the report' : 'Pre-submission check'}
        </Button>
      }
    >
      {checking ? (
        <section class="wb-precheck" aria-label="Pre-submission check">
          <p class={`wb-callout ${missing.length ? 'is-warn' : 'is-good'}`}>
            {missing.length
              ? `${plural(missing.length, 'thing')} still to do before this can go.`
              : 'Everything on the list is done. It is ready to send.'}
          </p>
          <ul class="wb-precheck-list">
            {checks.map((def) => {
              const on = Boolean((report.checks ?? {})[def.key]);
              return (
                <li key={def.key} class={on ? 'is-done' : 'is-missing'}>
                  {on ? <IconCheck size={15} /> : <IconClose size={15} />}
                  <span>{def.label}</span>
                </li>
              );
            })}
            <li class={report.amount !== null && report.amount !== undefined ? 'is-done' : 'is-missing'}>
              {report.amount !== null && report.amount !== undefined ? <IconCheck size={15} /> : <IconClose size={15} />}
              <span>
                Amount claimed{report.amount !== null && report.amount !== undefined ? `: ${money(Number(report.amount))}` : ''}
              </span>
            </li>
          </ul>
          <p class="wb-hint">This is a read-only look. Tick things off on the report itself.</p>
        </section>
      ) : (
        <>
          {checks.length ? (
            <section class="wb-checklist" aria-label="Checklist">
              <h4 class="wb-comments-title">
                Checklist <span class="wb-mono-soft">{ready} of {checks.length}</span>
              </h4>
              <ul>
                {checks.map((def) => {
                  const on = Boolean((report.checks ?? {})[def.key]);
                  return (
                    <li key={def.key}>
                      <label class={`wb-check wb-check-row${on ? ' is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={readOnly}
                          onChange={(event) => void toggle(def.key, (event.currentTarget as HTMLInputElement).checked)}
                        />
                        <span>{def.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <p class="wb-hint">No checklist is set up for this project. An administrator can add one in Settings.</p>
          )}

          <div class="wb-props">
            <LiveSelect<ReportStatus>
              table="reports"
              id={report.id}
              field="status"
              value={report.status}
              label="Status"
              options={optionsFrom(REPORT_STATUSES, REPORT_STATUS_LABEL)}
              readOnly={readOnly}
            />
            <LiveNumber
              table="reports"
              id={report.id}
              field="amount"
              value={report.amount}
              label="Amount claimed"
              min={0}
              step={0.01}
              allowNull
              placeholder="$"
              readOnly={readOnly}
            />
            <LiveDate table="reports" id={report.id} field="due" value={report.due} label="Due" readOnly={readOnly} />
            <LiveDate
              table="reports"
              id={report.id}
              field="submitted_on"
              value={report.submitted_on}
              label="Submitted on"
              readOnly={readOnly}
            />
            <LiveText
              table="reports"
              id={report.id}
              field="covers"
              value={report.covers ?? ''}
              label="Covers"
              placeholder="The month it reports on"
              readOnly={readOnly}
            />
          </div>

          <LiveTextarea
            table="reports"
            id={report.id}
            field="notes"
            value={report.notes}
            label="Notes"
            placeholder="Anything worth remembering"
            readOnly={readOnly}
          />

          <SourcesList
            sources={report.sources ?? []}
            title="Files"
            readOnly={readOnly}
            onChange={async (next) => {
              const result = await updateRow('reports', report.id, { sources: next });
              if (!result.ok && result.error) toast.bad(result.error.message);
            }}
          />

          <CommentThread entity="report" id={report.id} />
          <History entityId={report.id} />
        </>
      )}
    </Modal>
  );
}

/* --------------------------------------------------------- add a month --- */

/** The form for a new reporting month. Managers only; the database agrees. */
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
      setError('There is already a report for that month.');
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
      toast.good('Added.');
      onClose();
    } else if (result.error) {
      setError(result.error.message);
    }
  };

  return (
    <form class="wb-form" onSubmit={submit}>
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
      <Field label="What it covers" hint="The month or stretch of time the report is about.">
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
      <div class="wb-form-actions">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving}>
          Add the month
        </Button>
      </div>
    </form>
  );
}
