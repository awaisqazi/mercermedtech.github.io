/**
 * Everything that has happened to one task, report or partner: the same rows
 * as the project's activity drawer, narrowed to this item. Loaded when the
 * panel opens, kept live by the project's realtime channel.
 */
import { useState } from 'preact/hooks';
import { useHistory, useProject } from '../lib/store';
import { getAuth } from '../lib/auth';
import { fullTime, relativeTime } from '../lib/format';
import { Avatar } from './Avatar';
import { Skeleton } from './Skeleton';

const SHOWN = 6;

export function History({ entityId }: { entityId: string }) {
  const { profiles } = useProject();
  const { rows, loading } = useHistory(entityId.startsWith('temp-') ? null : entityId);
  const [all, setAll] = useState(false);
  const me = getAuth().userId;
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <section class="wb-history">
      <h4 class="wb-comments-title">
        History
        {rows.length ? <span class="wb-mono-soft"> {rows.length}</span> : null}
      </h4>
      {loading && !rows.length ? (
        <div class="wb-comments-loading">
          <Skeleton width="70%" />
          <Skeleton width="45%" />
        </div>
      ) : rows.length ? (
        <ol class="wb-history-list">
          {shown.map((row) => {
            const profile = row.user_id ? profiles[row.user_id] : null;
            const who =
              row.user_id === me ? 'You' : profile?.full_name?.trim() || profile?.email || 'Someone';
            return (
              <li class="wb-history-row" key={row.id}>
                <Avatar id={row.user_id} name={profile?.full_name} email={profile?.email} size={20} />
                <span class="wb-history-text">
                  <span class="wb-history-who">{who}</span> {row.summary}
                </span>
                <span class="wb-mono-soft wb-history-when" title={fullTime(row.created_at)}>
                  {relativeTime(row.created_at)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p class="wb-comments-empty">No changes recorded yet.</p>
      )}
      {rows.length > SHOWN ? (
        <button type="button" class="wb-linkish" onClick={() => setAll((value) => !value)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      ) : null}
    </section>
  );
}
