/**
 * One inquiry in the shared drawer: what the person sent (every field, label
 * and value, in form order), then the follow-up controls (status, assignee,
 * notes, the task), then what changed on it.
 *
 * Reading needs `inquiries.view`. Everything that writes needs
 * `inquiries.manage`; without it the same facts show as plain text. Making a
 * task also needs `tasks.create`, because the task is a row in `tasks`.
 */
import { useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { EmptyState } from '../../components/EmptyState';
import { Field } from '../../components/Field';
import { LiveTextarea } from '../../components/LiveField';
import { PersonPicker } from '../../components/PersonPicker';
import { Select, type Option } from '../../components/Select';
import { StatusDot } from '../../components/StatusDot';
import { fullTime, relativeTime } from '../../lib/format';
import { can, useCan } from '../../lib/perms';
import { href } from '../../lib/router';
import {
  INQUIRY_SOURCE_LABEL,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABEL,
  type Inquiry,
  type InquiryStatus,
} from '../../lib/types';
import {
  assignInquiry,
  createTask,
  linkInquiryTask,
  nameOf,
  setInquiryStatus,
  useActivity,
  useProfile,
  useTask,
  useWorkspaceSlice,
} from '../../lib/workspace';
import { taskDescription } from './helpers';

const STATUS_OPTIONS: Array<Option<InquiryStatus>> = INQUIRY_STATUSES.map((key) => ({
  value: key,
  label: INQUIRY_STATUS_LABEL[key],
}));

export function InquiryDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const row = useWorkspaceSlice((state) => state.inquiries.find((item) => item.id === id) ?? null, [id]);

  if (!row) {
    return (
      <Drawer open title="Response not found" onClose={onClose} class="wb-inq-drawer">
        <EmptyState
          quiet
          title="This response is not in the list"
          body="It may be older than what is loaded. Close this and choose Show older."
        />
      </Drawer>
    );
  }

  return (
    <Drawer open title={row.name || 'No name given'} onClose={onClose} class="wb-inq-drawer">
      <InquiryBody row={row} />
    </Drawer>
  );
}

function InquiryBody({ row }: { row: Inquiry }) {
  const manage = useCan('inquiries.manage');
  const makeTasks = useCan('tasks.create');
  const assignee = useProfile(row.assignee_id);
  const task = useTask(row.task_id);
  const activity = useActivity();
  const [making, setMaking] = useState(false);

  const history = activity.rows.filter((item) => item.entity === 'inquiry' && item.entity_id === row.id);

  const makeTask = async () => {
    if (making || !can('inquiries.manage')) return;
    setMaking(true);
    const made = await createTask({
      title: `Follow up with ${row.name || 'this person'}`,
      description: taskDescription(row, INQUIRY_SOURCE_LABEL[row.source]),
      assignee_id: row.assignee_id,
    });
    if (made.ok && made.row) await linkInquiryTask(row.id, made.row.id);
    setMaking(false);
  };

  return (
    <div class="wb-inq">
      <p class="wb-inq-meta">
        <span>{INQUIRY_SOURCE_LABEL[row.source]}</span>
        <time dateTime={row.received_at}>{fullTime(row.received_at)}</time>
        <span>{row.lang === 'es' ? 'In Spanish' : 'In English'}</span>
        {row.page ? (
          <span>
            Page <span class="wb-mono">{row.page}</span>
          </span>
        ) : null}
      </p>

      <section class="wb-inq-block" aria-labelledby={`inq-${row.id}-sent`}>
        <h3 class="wb-inq-heading" id={`inq-${row.id}-sent`}>
          What they sent
        </h3>
        {row.fields.length ? (
          <dl class="wb-facts wb-inq-fields">
            {row.fields.map((field, index) => (
              <div key={`${index}-${field.k}`}>
                <dt>{field.k}</dt>
                <dd class="wb-inq-value">{field.v || 'Left blank'}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p class="wb-inq-quiet">{row.contact || 'No details came with this response.'}</p>
        )}
      </section>

      <section class="wb-inq-block" aria-labelledby={`inq-${row.id}-follow`}>
        <h3 class="wb-inq-heading" id={`inq-${row.id}-follow`}>
          Follow-up
        </h3>

        {manage ? (
          <div class="wb-inq-controls">
            <Field label="Status">
              {(props) => (
                <Select<InquiryStatus>
                  {...props}
                  value={row.status}
                  options={STATUS_OPTIONS}
                  onValue={(status) => void setInquiryStatus(row.id, status)}
                />
              )}
            </Field>
            <PersonPicker
              label="Assigned to"
              value={row.assignee_id}
              onChange={(userId) => void assignInquiry(row.id, userId)}
            />
            <LiveTextarea
              table="inquiries"
              id={row.id}
              field="notes"
              value={row.notes}
              label="Notes"
              rows={4}
              placeholder="Who you spoke to, what was said, what comes next."
            />
          </div>
        ) : (
          <dl class="wb-facts">
            <div>
              <dt>Status</dt>
              <dd>{INQUIRY_STATUS_LABEL[row.status]}</dd>
            </div>
            <div>
              <dt>Assigned to</dt>
              <dd class="wb-inq-person">
                {assignee ? (
                  <>
                    <Avatar id={assignee.id} name={assignee.full_name} email={assignee.email} size={22} />
                    {assignee.full_name || assignee.email}
                  </>
                ) : (
                  'Unassigned'
                )}
              </dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd class="wb-inq-value">{row.notes || 'No notes yet.'}</dd>
            </div>
          </dl>
        )}

        {row.task_id ? (
          <div class="wb-inq-task">
            <span class="wb-label">Task</span>
            <a class="wb-linkish" href={href('/tasks', { task: row.task_id })}>
              {task ? task.title : 'Open the task'}
            </a>
            {task ? <StatusDot status={task.status} /> : null}
          </div>
        ) : manage && makeTasks ? (
          <div class="wb-inq-task">
            <Button variant="secondary" busy={making} onClick={() => void makeTask()}>
              Make a task
            </Button>
          </div>
        ) : null}
      </section>

      <section class="wb-inq-block" aria-labelledby={`inq-${row.id}-activity`}>
        <h3 class="wb-inq-heading" id={`inq-${row.id}-activity`}>
          Activity
        </h3>
        {history.length ? (
          <ol class="wb-inq-activity">
            {history.map((item) => (
              <li key={item.id}>
                <span>{item.summary}</span>
                <span class="wb-inq-when" title={fullTime(item.created_at)}>
                  {item.actor_id ? `${nameOf(item.actor_id)}, ` : ''}
                  {relativeTime(item.created_at)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p class="wb-inq-quiet">No changes yet.</p>
        )}
      </section>
    </div>
  );
}
