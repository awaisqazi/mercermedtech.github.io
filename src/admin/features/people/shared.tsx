/**
 * Small pieces the directory and the person page share: the "here now" word
 * with its dot, the last-seen wording, and the expiry wording for invitations.
 */
import { useIsHere } from '../../lib/workspace';
import { relativeTime, fullTime } from '../../lib/format';
import type { Profile } from '../../lib/types';

export function displayName(person: Pick<Profile, 'full_name' | 'email'> | null | undefined): string {
  return person?.full_name?.trim() || person?.email || 'Unnamed person';
}

/** "Here now" with a dot, or "Last seen 3 h ago", or "Has not signed in yet". */
export function Presence({ person }: { person: Profile }) {
  const here = useIsHere(person.id);
  if (here && person.active) {
    return (
      <span class="wb-presence-here">
        <span class="wb-presence-dot" aria-hidden="true" />
        Here now
      </span>
    );
  }
  if (!person.last_seen_at) return <span class="wb-presence-away">Has not signed in yet</span>;
  return (
    <span class="wb-presence-away" title={fullTime(person.last_seen_at)}>
      Last seen {relativeTime(person.last_seen_at)}
    </span>
  );
}

const DAY = 86_400_000;

/** "Expires in 9 days", "Expires today", "Expired 2 days ago". */
export function expiryWords(expiresAt: string): { text: string; expired: boolean } {
  const ends = new Date(expiresAt).getTime();
  if (Number.isNaN(ends)) return { text: '', expired: false };
  const diff = ends - Date.now();
  if (diff <= 0) {
    const days = Math.floor(-diff / DAY);
    return { text: days < 1 ? 'Expired today' : days === 1 ? 'Expired yesterday' : `Expired ${days} days ago`, expired: true };
  }
  const days = Math.ceil(diff / DAY);
  if (days <= 1) return { text: 'Expires today', expired: false };
  return { text: `Expires in ${days} days`, expired: false };
}
