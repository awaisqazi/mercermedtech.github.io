/**
 * What has happened in this project, in a drawer from the header bell.
 *
 * Changes are grouped by day, then by person, so "Sam changed six things on
 * Tuesday" reads as one block instead of six lines. The bell counts what
 * other people did since you were last here (`profiles.last_seen_at`, read
 * before this visit moved it on) and that you have not opened the drawer to
 * see yet; opening it marks them read, per project, in this browser.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useActivity, useProject } from '../lib/store';
import { useAuth } from '../lib/auth';
import { observable, useObservable } from '../lib/observable';
import { href } from '../lib/router';
import { fullTime, relativeTime } from '../lib/format';
import type { ActivityRow } from '../lib/types';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Modal } from './Modal';
import { Select } from './Select';
import { IconClock } from './Icons';

const SEEN_KEY = 'wb.seen.';

function readSeen(projectId: string): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY + projectId)) || 0;
  } catch {
    return 0;
  }
}

const seenStore = observable<Record<string, number>>({});

function markSeen(projectId: string, id: number): void {
  seenStore.update((current) => ({ ...current, [projectId]: id }));
  try {
    window.localStorage.setItem(SEEN_KEY + projectId, String(id));
  } catch {
    /* the count comes back next visit; nothing worse */
  }
}

/** New changes by other people since your last visit, not yet looked at. */
export function useUnread(): { count: number; since: string | null } {
  const { project } = useProject();
  const { rows } = useActivity();
  const auth = useAuth();
  const seen = useObservable(seenStore);
  const projectId = project?.id ?? '';
  const seenId = seen[projectId] ?? (projectId ? readSeen(projectId) : 0);
  const since = auth.lastVisit;
  const count = rows.filter(
    (row) =>
      row.user_id !== auth.userId &&
      row.id > seenId &&
      (!since || row.created_at > since)
  ).length;
  return { count, since };
}

const ENTITY_LABEL: Record<string, string> = {
  task: 'Plan',
  report: 'Reports',
  partner: 'Partners',
  doc: 'Notes',
  state: 'Numbers',
  comment: 'Comments',
};

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

interface Block {
  day: string;
  people: Array<{ userId: string | null; rows: ActivityRow[] }>;
}

function group(rows: ActivityRow[]): Block[] {
  const blocks: Block[] = [];
  for (const row of rows) {
    const day = dayLabel(row.created_at);
    let block = blocks[blocks.length - 1];
    if (!block || block.day !== day) {
      block = { day, people: [] };
      blocks.push(block);
    }
    const last = block.people[block.people.length - 1];
    if (last && last.userId === row.user_id) last.rows.push(row);
    else block.people.push({ userId: row.user_id, rows: [row] });
  }
  return blocks;
}

export function ActivityDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, profiles } = useProject();
  const { rows, done, loadMore } = useActivity();
  const auth = useAuth();
  const unread = useUnread();
  const [person, setPerson] = useState('');
  const [newestAtOpen, setNewestAtOpen] = useState(0);

  const slug = project?.slug ?? '';
  const projectId = project?.id ?? '';

  // Opening marks everything read, but the "new" marks stay for this look.
  useEffect(() => {
    if (!open || !projectId) return;
    setNewestAtOpen(readSeen(projectId));
  }, [open, projectId]);

  // Anything that arrives while the drawer is open has been seen as well.
  const newest = rows[0]?.id ?? 0;
  useEffect(() => {
    if (open && projectId && newest) markSeen(projectId, newest);
  }, [open, projectId, newest]);

  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!row.user_id) continue;
      const profile = profiles[row.user_id];
      seen.set(row.user_id, profile?.full_name?.trim() || profile?.email || 'Someone');
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rows, profiles]);

  const filtered = person ? rows.filter((row) => row.user_id === person) : rows;
  const blocks = group(filtered);

  const linkFor = (row: ActivityRow): string | null => {
    if (!row.entity_id) return null;
    if (row.entity === 'task') return href(`/p/${slug}/plan`, { task: row.entity_id });
    if (row.entity === 'report') return href(`/p/${slug}/reports`, { report: row.entity_id });
    if (row.entity === 'partner') return href(`/p/${slug}/partners`, { partner: row.entity_id });
    if (row.entity === 'state') return href(`/p/${slug}/numbers`);
    return null;
  };

  const isNew = (row: ActivityRow) =>
    row.user_id !== auth.userId && row.id > newestAtOpen && (!unread.since || row.created_at > unread.since);

  return (
    <Modal
      open={open}
      side
      size="md"
      title="Activity"
      description={
        auth.lastVisit
          ? `Marked "new" is what other people changed since you were last here, ${relativeTime(auth.lastVisit)}.`
          : 'Every change anyone makes to this project.'
      }
      onClose={onClose}
      initialFocus="panel"
      actions={
        people.length > 1 ? (
          <Select
            value={person}
            placeholder="Everyone"
            options={people}
            size="sm"
            aria-label="Show changes by"
            onValue={setPerson}
          />
        ) : null
      }
    >
      {blocks.length === 0 ? (
        <EmptyState
          icon={<IconClock size={22} />}
          title="Nothing here yet"
          body="Changes people make to this project will show up here."
        />
      ) : (
        <div class="wb-activity">
          {blocks.map((block) => (
            <section class="wb-activity-day" key={block.day}>
              <h3 class="wb-activity-day-head">{block.day}</h3>
              {block.people.map((entry, index) => {
                const profile = entry.userId ? profiles[entry.userId] : null;
                const name =
                  entry.userId === auth.userId
                    ? 'You'
                    : profile?.full_name?.trim() || profile?.email || 'Someone';
                return (
                  <div class="wb-activity-person" key={`${block.day}-${index}`}>
                    <Avatar id={entry.userId} name={profile?.full_name} email={profile?.email} size={26} />
                    <div class="wb-activity-body">
                      <p class="wb-activity-who">
                        {name}
                        <span class="wb-mono-soft"> · {entry.rows.length === 1 ? '1 change' : `${entry.rows.length} changes`}</span>
                      </p>
                      <ul class="wb-activity-rows">
                        {entry.rows.map((row) => {
                          const link = linkFor(row);
                          return (
                            <li key={row.id} class={isNew(row) ? 'is-new' : undefined}>
                              {isNew(row) ? <span class="wb-new-dot" title="New since you were here" /> : null}
                              <span class="wb-activity-what">
                                {link ? <a href={link}>{row.summary}</a> : row.summary}
                              </span>
                              <span class="wb-activity-meta wb-mono-soft" title={fullTime(row.created_at)}>
                                {ENTITY_LABEL[row.entity] ?? row.entity} · {relativeTime(row.created_at)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          {!done ? (
            <div class="wb-feed-more">
              <Button variant="quiet" onClick={loadMore}>
                Show older changes
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
