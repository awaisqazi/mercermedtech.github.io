/**
 * Activity (#/activity): everything that changed, newest first, grouped by
 * day. Filters live in the query string (person=<id>, kind=<entity>), so a
 * filtered feed can be linked to. "Since you were here" is drawn at
 * auth.lastVisit. "Show more" asks the store for the next page; the filters
 * apply to what has loaded, and Show more keeps working underneath them.
 *
 * Person means the actor or the person a row is about (time entries), so
 * picking Sam shows what Sam did and the hours logged for Sam.
 */
import { Fragment } from 'preact';
import { useMemo } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { Select, type Option } from '../../components/Select';
import { SkeletonLines } from '../../components/Skeleton';
import { useAuth } from '../../lib/auth';
import { fullTime, parseLocalDate, relativeTime } from '../../lib/format';
import { addDays, todayKey } from '../../lib/hours';
import { href, patchQuery, useRoute } from '../../lib/router';
import { ACTIVITY_ENTITY_LABEL, type ActivityEntity, type ActivityRow, type Profile } from '../../lib/types';
import { nameOf, useActivity, useProfiles } from '../../lib/workspace';

const KINDS = Object.keys(ACTIVITY_ENTITY_LABEL) as ActivityEntity[];

/** The local calendar day of a timestamp, as YYYY-MM-DD. */
function dayOf(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayHeading(day: string): string {
  const today = todayKey();
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  const date = parseLocalDate(day);
  if (!date) return day;
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
}

interface Group {
  day: string;
  rows: ActivityRow[];
}

export function Activity() {
  const route = useRoute();
  const auth = useAuth();
  const { rows, done, loading, loadMore } = useActivity();
  const profiles = useProfiles();

  const person = route.query.person ?? '';
  const kind = KINDS.includes(route.query.kind as ActivityEntity) ? (route.query.kind as ActivityEntity) : '';

  const profileById = useMemo(() => new Map<string, Profile>(profiles.map((row) => [row.id, row])), [profiles]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!person || row.actor_id === person || row.subject_id === person) && (!kind || row.entity === kind)
      ),
    [rows, person, kind]
  );

  const groups = useMemo(() => {
    const out: Group[] = [];
    for (const row of filtered) {
      const day = dayOf(row.created_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.rows.push(row);
      else out.push({ day, rows: [row] });
    }
    return out;
  }, [filtered]);

  // The first row (newest first) that is not newer than the last visit. The
  // divider goes above it. A visit time of nothing means no divider at all.
  const visit = auth.lastVisit ? new Date(auth.lastVisit).getTime() : null;
  const hasVisit = visit !== null && !Number.isNaN(visit);
  const dividerBefore = hasVisit ? filtered.find((row) => new Date(row.created_at).getTime() <= visit!)?.id : undefined;
  const newCount = hasVisit ? filtered.filter((row) => new Date(row.created_at).getTime() > visit!).length : 0;

  const personOptions: Array<Option<string>> = profiles.map((profile) => ({
    value: profile.id,
    label: `${profile.full_name?.trim() || profile.email || 'Someone'}${profile.active ? '' : ' (inactive)'}`,
  }));
  const kindOptions: Array<Option<string>> = KINDS.map((key) => ({ value: key, label: ACTIVITY_ENTITY_LABEL[key] }));
  const filtering = Boolean(person || kind);

  return (
    <div class="wb-page act-page">
      <PageHeader title="Activity" lead="Everything that changed, newest first." />

      <div class="act-filters" role="group" aria-label="Filter the feed">
        <label class="act-filter">
          <span class="act-filter-label">Person</span>
          <Select
            size="sm"
            value={person}
            options={personOptions}
            placeholder="Everyone"
            aria-label="Person"
            onValue={(value) => patchQuery({ person: value || null }, { replace: true })}
          />
        </label>
        <label class="act-filter">
          <span class="act-filter-label">Kind</span>
          <Select
            size="sm"
            value={kind}
            options={kindOptions}
            placeholder="All kinds"
            aria-label="Kind"
            onValue={(value) => patchQuery({ kind: value || null }, { replace: true })}
          />
        </label>
        {filtering ? (
          <Button variant="quiet" size="sm" onClick={() => patchQuery({ person: null, kind: null }, { replace: true })}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {groups.length ? (
        <div class="act-feed">
          {hasVisit && filtered.length > 0 && filtered[0] && new Date(filtered[0].created_at).getTime() <= visit! ? (
            <p class="act-nothing-new">Nothing has changed since you were here, {relativeTime(auth.lastVisit)}.</p>
          ) : null}
          {groups.map((group) => (
            <section class="act-day" key={group.day} aria-label={dayHeading(group.day)}>
              <h2 class="act-day-title">{dayHeading(group.day)}</h2>
              <ul class="wb-list">
                {group.rows.map((row) => (
                  <Fragment key={row.id}>
                    {row.id === dividerBefore && row !== filtered[0] ? (
                      <li class="act-divider" key={`since-${row.id}`} role="separator" aria-label="Since you were here">
                        <span>Since you were here{newCount ? `: ${newCount} new above` : ''}</span>
                      </li>
                    ) : null}
                    <li key={row.id}>
                      <FeedRow row={row} actor={row.actor_id ? profileById.get(row.actor_id) : undefined} />
                    </li>
                  </Fragment>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : loading && !rows.length ? (
        <SkeletonLines count={5} />
      ) : rows.length ? (
        <EmptyState
          quiet
          title="Nothing in the loaded feed matches."
          body={done ? 'Try another person or kind.' : 'Show more to look further back, or try another person or kind.'}
        />
      ) : (
        <EmptyState title="Nothing has happened yet." body="Changes to tasks, hours and people will show here." />
      )}

      {rows.length ? (
        <div class="act-foot">
          {done ? (
            <p class="act-done">That is everything.</p>
          ) : (
            <Button variant="secondary" busy={loading} onClick={loadMore}>
              {loading ? 'Loading' : 'Show more'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FeedRow({ row, actor }: { row: ActivityRow; actor: Profile | undefined }) {
  const inner = (
    <>
      <Avatar id={row.actor_id} name={actor?.full_name} email={actor?.email} size={28} />
      <span class="act-main">
        <span class="act-text">
          <strong>{nameOf(row.actor_id)}</strong> {row.summary}
        </span>
        <span class="act-meta">
          <span>{ACTIVITY_ENTITY_LABEL[row.entity] ?? row.entity}</span>
          <span title={`${fullTime(row.created_at)}, ${relativeTime(row.created_at)}`}>
            {new Date(row.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </span>
      </span>
    </>
  );
  return row.task_id ? (
    <a class="act-row" href={href('/tasks', { task: row.task_id })}>
      {inner}
    </a>
  ) : (
    <div class="act-row">{inner}</div>
  );
}
