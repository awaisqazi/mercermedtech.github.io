/**
 * Initials in a circle, coloured from the person's id so the same person is
 * the same colour on every screen and in every browser without storing a
 * preference anywhere.
 */
import { initials, userColor, userTint } from '../lib/format';
import type { Profile } from '../lib/types';

export interface AvatarProps {
  id: string | null | undefined;
  name?: string | null;
  email?: string | null;
  size?: number;
  /** Draws the presence ring, for "this person is editing here". */
  active?: boolean;
  title?: string;
  class?: string;
}

export function Avatar({ id, name, email, size = 28, active = false, title, class: className }: AvatarProps) {
  const label = name?.trim() || email || 'Unknown person';
  return (
    <span
      class={`wb-avatar${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.max(9, Math.round(size * 0.38))}px`,
        color: userColor(id),
        background: userTint(id),
        borderColor: active ? userColor(id) : undefined,
      }}
      title={title ?? label}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {initials(name, email)}
    </span>
  );
}

export interface AvatarStackProps {
  people: Array<{ id: string; name?: string | null; email?: string | null; note?: string }>;
  max?: number;
  size?: number;
  /** Ids that get the presence ring. */
  activeIds?: string[];
  /** Read out before the names. */
  label?: string;
}

/** Overlapping avatars with a "+N" chip once the row gets long. */
export function AvatarStack({
  people,
  max = 5,
  size = 26,
  activeIds = [],
  label = 'People here',
}: AvatarStackProps) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const active = new Set(activeIds);

  return (
    <span class="wb-avatar-stack" role="group" aria-label={`${label}: ${people.length}`}>
      {shown.map((person) => (
        <Avatar
          key={person.id}
          id={person.id}
          name={person.name}
          email={person.email}
          size={size}
          active={active.has(person.id)}
          title={person.note ? `${person.name || person.email || 'Someone'} · ${person.note}` : undefined}
        />
      ))}
      {extra > 0 ? (
        <span class="wb-avatar wb-avatar-more" style={{ width: `${size}px`, height: `${size}px` }}>
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

/** Convenience for the common `profiles[id]` case. */
export function ProfileAvatar({
  profile,
  id,
  ...rest
}: Omit<AvatarProps, 'name' | 'email'> & { profile: Profile | null | undefined }) {
  return <Avatar {...rest} id={id ?? profile?.id} name={profile?.full_name} email={profile?.email} />;
}
