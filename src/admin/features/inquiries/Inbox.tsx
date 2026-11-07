/**
 * The Inbox: what the three public website forms sent in, to follow up and
 * close (docs/workbench-v2-plan.md, section 13.4).
 *
 *   #/inbox?status=&source=&assignee=&q=&item=<id>
 *
 * Newest first, in four sections (New, Contacted, Enrolled, Closed; the last
 * two folded). A row opens the drawer with `item=<id>`. Everyone with
 * `inquiries.view` can read; every control that changes something sits behind
 * `inquiries.manage` (the database says no again if the mirror is wrong).
 */
import { useMemo, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Field';
import { IconChevron } from '../../components/Icons';
import { PageHeader } from '../../components/PageHeader';
import { Select, type Option } from '../../components/Select';
import { StatusDot } from '../../components/StatusDot';
import { fullTime } from '../../lib/format';
import { patchQuery, useRoute } from '../../lib/router';
import {
  INQUIRY_SOURCES,
  INQUIRY_SOURCE_LABEL,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABEL,
  type Inquiry,
  type InquiryStatus,
} from '../../lib/types';
import {
  loadOlderInquiries,
  useInquiries,
  useNewInquiryCount,
  useProfile,
  useProfiles,
  useTask,
  useWorkspaceSlice,
} from '../../lib/workspace';
import { InquiryDrawer } from './InquiryDrawer';
import { filtersFrom, hasFilters, matches, receivedWord } from './helpers';

const FOLDED_BY_DEFAULT: Record<InquiryStatus, boolean> = { new: false, contacted: false, enrolled: true, closed: true };

export function Inbox() {
  const route = useRoute();
  const rows = useInquiries();
  const newCount = useNewInquiryCount();
  const done = useWorkspaceSlice((state) => state.inquiriesDone, []);
  const profiles = useProfiles();
  const filters = filtersFrom(route.query);
  const filtered = hasFilters(filters);
  const [search, setSearch] = useState(filters.q);
  const [unfolded, setUnfolded] = useState<Partial<Record<InquiryStatus, boolean>>>({});
  const [loadingOlder, setLoadingOlder] = useState(false);

  const shown = useMemo(
    () => rows.filter((row) => matches(row, filters)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, filters.source, filters.status, filters.assignee, filters.q]
  );

  const sourceOptions: Array<Option> = INQUIRY_SOURCES.map((key) => ({ value: key, label: INQUIRY_SOURCE_LABEL[key] }));
  const statusOptions: Array<Option> = INQUIRY_STATUSES.map((key) => ({ value: key, label: INQUIRY_STATUS_LABEL[key] }));
  const assigneeOptions: Array<Option> = [
    { value: 'none', label: 'Unassigned' },
    ...profiles
      .filter((person) => person.active || person.id === filters.assignee)
      .map((person) => ({ value: person.id, label: person.full_name || person.email || 'Someone' })),
  ];

  const setFilter = (key: string, value: string) => patchQuery({ [key]: value || null }, { replace: true });
  const clearAll = () => {
    setSearch('');
    patchQuery({ source: null, status: null, assignee: null, q: null }, { replace: true });
  };

  const openItem = (id: string) => patchQuery({ item: id });
  const closeItem = () => patchQuery({ item: null });

  const loadOlder = async () => {
    setLoadingOlder(true);
    await loadOlderInquiries();
    setLoadingOlder(false);
  };

  const isOpen = (status: InquiryStatus) =>
    unfolded[status] ?? (!FOLDED_BY_DEFAULT[status] || filters.status === status || Boolean(filters.q.trim()));

  const sections = INQUIRY_STATUSES.map((status) => ({
    status,
    rows: shown.filter((row) => row.status === status),
  })).filter((section) => section.rows.length > 0 || (section.status === 'new' && !filters.status && shown.length > 0));

  const itemId = route.query.item ?? '';

  return (
    <div class="wb-page wb-inbox">
      <PageHeader title="Inbox" lead={newCount ? `${newCount} new` : 'Responses from the website forms.'} />

      <div class="wb-toolbar wb-inbox-filters" role="search">
        <Input
          class="wb-inbox-search"
          type="search"
          aria-label="Search by name or contact"
          placeholder="Search name or contact"
          value={search}
          onInput={(event) => {
            const value = (event.currentTarget as HTMLInputElement).value;
            setSearch(value);
            setFilter('q', value.trim());
          }}
        />
        <Select
          aria-label="Source"
          value={filters.source}
          options={sourceOptions}
          placeholder="All forms"
          onValue={(value) => setFilter('source', value)}
        />
        <Select
          aria-label="Status"
          value={filters.status}
          options={statusOptions}
          placeholder="Any status"
          onValue={(value) => setFilter('status', value)}
        />
        <Select
          aria-label="Assignee"
          value={filters.assignee}
          options={assigneeOptions}
          placeholder="Anyone"
          onValue={(value) => setFilter('assignee', value)}
        />
        {filtered ? (
          <Button variant="quiet" onClick={clearAll}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        filtered ? (
          <EmptyState
            title="Nothing matches"
            body="No response fits those filters."
            action={
              <Button variant="secondary" onClick={clearAll}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState title="Nothing new" body="Responses from the website forms land here." />
        )
      ) : (
        <div class="wb-inbox-sections">
          {sections.map(({ status, rows: sectionRows }) => {
            const open = isOpen(status);
            const listId = `inbox-${status}`;
            return (
              <section class="wb-section wb-inbox-section" key={status} aria-labelledby={`${listId}-title`}>
                <h2 class="wb-section-head wb-inbox-section-head">
                  <button
                    type="button"
                    class="wb-inbox-fold"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => setUnfolded((current) => ({ ...current, [status]: !open }))}
                  >
                    <IconChevron size={14} class={`wb-inbox-chevron${open ? ' is-open' : ''}`} />
                    <span class="wb-section-title" id={`${listId}-title`}>
                      {INQUIRY_STATUS_LABEL[status]}
                    </span>
                    <span class="wb-inbox-section-count">{sectionRows.length}</span>
                  </button>
                </h2>
                {open ? (
                  sectionRows.length ? (
                    <ul class="wb-list wb-inbox-list" id={listId}>
                      {sectionRows.map((row) => (
                        <InquiryRow key={row.id} row={row} current={row.id === itemId} onOpen={openItem} />
                      ))}
                    </ul>
                  ) : (
                    <p class="wb-inbox-none" id={listId}>
                      Nothing new. Responses from the website forms land here.
                    </p>
                  )
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {!done ? (
        <div class="wb-inbox-older">
          <Button variant="secondary" busy={loadingOlder} onClick={() => void loadOlder()}>
            Show older
          </Button>
        </div>
      ) : null}

      {itemId ? <InquiryDrawer id={itemId} onClose={closeItem} /> : null}
    </div>
  );
}

function InquiryRow({ row, current, onOpen }: { row: Inquiry; current: boolean; onOpen: (id: string) => void }) {
  const assignee = useProfile(row.assignee_id);
  const task = useTask(row.task_id);
  return (
    <li>
      <button
        type="button"
        class={`wb-row wb-row-button wb-inbox-row${current ? ' is-current' : ''}`}
        onClick={() => onOpen(row.id)}
      >
        <span class="wb-row-main wb-inbox-main">
          <span class="wb-row-title wb-inbox-name">{row.name || 'No name given'}</span>
          <span class="wb-row-meta wb-inbox-meta">
            <span class="wb-inbox-source">{INQUIRY_SOURCE_LABEL[row.source]}</span>
            <time dateTime={row.received_at} title={fullTime(row.received_at)}>
              {receivedWord(row.received_at)}
            </time>
            {row.task_id ? (
              <span class="wb-inbox-task">
                <span class="wb-sr">Task: </span>
                {task ? <StatusDot status={task.status} /> : 'Task made'}
              </span>
            ) : null}
          </span>
        </span>
        <span class="wb-inbox-contact">{row.contact || 'No contact given'}</span>
        <span class="wb-inbox-person">
          {assignee ? (
            <Avatar
              id={assignee.id}
              name={assignee.full_name}
              email={assignee.email}
              size={26}
              title={`Assigned to ${assignee.full_name || assignee.email}`}
            />
          ) : (
            <span class="wb-sr">Unassigned</span>
          )}
        </span>
      </button>
    </li>
  );
}
