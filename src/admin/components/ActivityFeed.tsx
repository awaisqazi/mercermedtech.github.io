/**
 * The project's activity feed. The rows are written by database triggers, so
 * they are the same for everyone and cannot be edited from the client.
 */
import { useMemo, useState } from 'preact/hooks';
import { useActivity, useProject } from '../lib/store';
import { fullTime, relativeTime } from '../lib/format';
import type { ActivityRow } from '../lib/types';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Select } from './Select';
import { IconClock } from './Icons';

export interface ActivityFeedProps {
  /** Turns an entity row into a link inside the project, when there is one. */
  linkFor?: (row: ActivityRow) => { href: string; label: string } | null;
  title?: string;
}

const ENTITY_LABEL: Record<string, string> = {
  task: 'Tasks',
  report: 'Reports',
  partner: 'Partners',
  doc: 'Notes',
  project_state: 'Numbers',
  comment: 'Comments',
};

export function ActivityFeed({ linkFor, title = 'Activity' }: ActivityFeedProps) {
  const { profiles } = useProject();
  const { rows, done, loadMore } = useActivity();
  const [person, setPerson] = useState('');
  const [entity, setEntity] = useState('');

  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!row.user_id) continue;
      const profile = profiles[row.user_id];
      seen.set(row.user_id, profile?.full_name?.trim() || profile?.email || 'Someone');
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rows, profiles]);

  const entities = useMemo(() => {
    const seen = new Set(rows.map((row) => row.entity));
    return [...seen].map((value) => ({ value, label: ENTITY_LABEL[value] ?? value }));
  }, [rows]);

  const filtered = rows.filter(
    (row) => (!person || row.user_id === person) && (!entity || row.entity === entity)
  );

  return (
    <section class="wb-panel">
      <header class="wb-panel-head">
        <h2 class="wb-panel-title">{title}</h2>
        <div class="wb-toolbar">
          <Select
            value={person}
            placeholder="Everyone"
            options={people}
            size="sm"
            aria-label="Filter by person"
            onValue={setPerson}
          />
          <Select
            value={entity}
            placeholder="Everything"
            options={entities}
            size="sm"
            aria-label="Filter by kind"
            onValue={setEntity}
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconClock size={22} />}
          title="Nothing here yet"
          body="Changes people make to this project will show up here."
        />
      ) : (
        <ol class="wb-feed">
          {filtered.map((row) => {
            const profile = row.user_id ? profiles[row.user_id] : null;
            const link = linkFor?.(row) ?? null;
            return (
              <li class="wb-feed-row" key={row.id}>
                <Avatar id={row.user_id} name={profile?.full_name} email={profile?.email} size={26} />
                <div class="wb-feed-body">
                  <p class="wb-feed-line">
                    <span class="wb-feed-who">
                      {profile?.full_name?.trim() || profile?.email || 'Someone'}
                    </span>{' '}
                    <span class="wb-feed-what">{row.summary}</span>
                  </p>
                  <p class="wb-feed-meta">
                    <span class="wb-mono-soft" title={fullTime(row.created_at)}>
                      {relativeTime(row.created_at)}
                    </span>
                    {link ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <a href={link.href}>{link.label}</a>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!done && filtered.length > 0 ? (
        <div class="wb-feed-more">
          <Button variant="quiet" onClick={loadMore}>
            Show older
          </Button>
        </div>
      ) : null}
    </section>
  );
}
