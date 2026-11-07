/**
 * The People directory (#/people).
 *
 * Everyone signed in sees the directory: avatar, name, title, role, "here
 * now", last seen and how many tasks they have open. Deactivated people sit
 * in a folded group at the bottom.
 *
 * With people.manage the screen also offers Invite, a role change on each
 * row, Deactivate / Reactivate, and the list of open invitations with Revoke.
 * The database is the lock (only an owner hands out the owner role, nobody
 * changes their own role, the last owner stays); this screen only declines to
 * offer what it already knows will be refused, and shows the database's own
 * message for the rest.
 */
import { useMemo, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useConfirm } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { IconPlus } from '../../components/Icons';
import { PageHeader, PhoneAction } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { Skeleton } from '../../components/Skeleton';
import { isOwner, useAuth } from '../../lib/auth';
import { joinLink } from '../../lib/config';
import { relativeTime, fullTime } from '../../lib/format';
import { href } from '../../lib/router';
import { toast } from '../../lib/toasts';
import { useCan } from '../../lib/perms';
import { OWNER_ROLE_KEY, type Invitation, type Profile, type Role } from '../../lib/types';
import {
  loadInvitations,
  revokeInvite,
  setActive,
  setRole,
  useInvitations,
  useProfiles,
  useRoles,
  useTasks,
  useWorkspace,
} from '../../lib/workspace';
import { InviteDialog } from './InviteDialog';
import { Presence, displayName, expiryWords } from './shared';

export function People() {
  const workspace = useWorkspace();
  const profiles = useProfiles();
  const roles = useRoles();
  const tasks = useTasks();
  const auth = useAuth();
  const canManage = useCan('people.manage');
  const iAmOwner = isOwner(auth);
  const [inviting, setInviting] = useState(false);
  const { confirm, element: confirmElement } = useConfirm();

  const openTasks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (task.assignee_id && task.status !== 'done') counts.set(task.assignee_id, (counts.get(task.assignee_id) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
  const active = profiles.filter((person) => person.active);
  const inactive = profiles.filter((person) => !person.active);

  const changeActive = async (person: Profile, next: boolean) => {
    const name = displayName(person);
    const sure = await confirm(
      next
        ? {
            title: `Reactivate ${name}?`,
            body: `${name} will be able to sign in again, with the role they had.`,
            confirmLabel: 'Reactivate',
          }
        : {
            title: `Deactivate ${name}?`,
            body: `${name} will no longer be able to sign in. Their tasks and hours stay where they are, and you can reactivate them later.`,
            confirmLabel: 'Deactivate',
            tone: 'danger',
          }
    );
    if (!sure) return;
    const result = await setActive(person.id, next);
    if (result.ok) toast.good(next ? `${name} is active again.` : `${name} is deactivated.`);
  };

  const changeRole = async (person: Profile, roleId: string) => {
    const result = await setRole(person.id, roleId);
    if (result.ok) toast.good(`${displayName(person)} is now ${roleById.get(roleId)?.name ?? 'updated'}.`);
  };

  const rowProps = {
    canManage,
    iAmOwner,
    me: auth.userId,
    roles,
    roleById,
    openTasks,
    onActive: changeActive,
    onRole: changeRole,
  };

  const loading = workspace.status === 'loading' || workspace.status === 'idle';

  return (
    <div class="wb-page wb-people">
      <PageHeader
        title="People"
        count={loading ? null : active.length}
        lead="Everyone on the team, what they do, and who is here now."
        actions={
          canManage ? (
            <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setInviting(true)}>
              Invite
            </Button>
          ) : null
        }
      />
      {canManage ? <PhoneAction label="Invite" icon={<IconPlus size={18} />} onClick={() => setInviting(true)} /> : null}

      {loading ? (
        <div class="wb-people-skeleton" aria-busy="true">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} height={52} radius={8} />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState title="Nobody is here yet" body="People appear here once they have accepted an invitation." />
      ) : (
        <ul class="wb-list wb-people-list" aria-label="People">
          {active.map((person) => (
            <PersonRow key={person.id} person={person} {...rowProps} />
          ))}
        </ul>
      )}

      {inactive.length ? (
        <details class="wb-people-fold">
          <summary class="wb-people-fold-summary">
            Deactivated <span class="wb-mono wb-meta">{inactive.length}</span>
          </summary>
          <ul class="wb-list wb-people-list" aria-label="Deactivated people">
            {inactive.map((person) => (
              <PersonRow key={person.id} person={person} {...rowProps} />
            ))}
          </ul>
        </details>
      ) : null}

      {canManage ? <OpenInvitations roleById={roleById} confirm={confirm} /> : null}

      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
      {confirmElement}
    </div>
  );
}

/* --------------------------------------------------------------- one row -- */

interface RowProps {
  person: Profile;
  canManage: boolean;
  iAmOwner: boolean;
  me: string | null;
  roles: Role[];
  roleById: Map<string, Role>;
  openTasks: Map<string, number>;
  onActive: (person: Profile, next: boolean) => void;
  onRole: (person: Profile, roleId: string) => void;
}

function PersonRow({ person, canManage, iAmOwner, me, roles, roleById, openTasks, onActive, onRole }: RowProps) {
  const name = displayName(person);
  const role = roleById.get(person.role_id);
  const isMe = person.id === me;
  const count = openTasks.get(person.id) ?? 0;

  // Who may be given which role. Only an owner touches the owner role, in
  // either direction; nobody changes their own. The database refuses the rest.
  const targetIsOwner = role?.key === OWNER_ROLE_KEY;
  const canChangeRole = canManage && !isMe && (iAmOwner || !targetIsOwner);
  const roleOptions = roles
    .filter((option) => iAmOwner || option.key !== OWNER_ROLE_KEY)
    .map((option) => ({ value: option.id, label: option.name }));

  return (
    <li class={`wb-person${person.active ? '' : ' is-inactive'}`}>
      <a class="wb-person-main" href={href(`/people/${person.id}`)}>
        <Avatar id={person.id} name={person.full_name} email={person.email} size={40} />
        <span class="wb-person-text">
          <span class="wb-person-name">
            {name}
            {isMe ? <span class="wb-person-you"> (you)</span> : null}
          </span>
          <span class="wb-person-title">{person.title || 'No title yet'}</span>
          <span class="wb-person-meta">
            {person.active ? <Presence person={person} /> : <span class="wb-presence-away">Deactivated</span>}
          </span>
        </span>
        <span class="wb-person-side">
          {canChangeRole && person.active ? null : <span class="wb-person-role">{role?.name ?? 'No role'}</span>}
          <span class="wb-person-count wb-mono" title="Open tasks">
            {count} <span class="wb-person-count-word">open {count === 1 ? 'task' : 'tasks'}</span>
          </span>
        </span>
      </a>
      {canManage && !isMe ? (
        <div class="wb-person-controls">
          {canChangeRole && person.active ? (
            <Select
              size="sm"
              aria-label={`Role for ${name}`}
              value={person.role_id}
              options={roleOptions}
              onValue={(value) => value !== person.role_id && onRole(person, value)}
            />
          ) : null}
          {person.active ? (
            <Button size="sm" variant="quiet" onClick={() => onActive(person, false)} aria-label={`Deactivate ${name}`}>
              Deactivate
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => onActive(person, true)} aria-label={`Reactivate ${name}`}>
              Reactivate
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------ invitations -- */

function OpenInvitations({
  roleById,
  confirm,
}: {
  roleById: Map<string, Role>;
  confirm: ReturnType<typeof useConfirm>['confirm'];
}) {
  const { rows, loading, error, reload } = useInvitations();
  const profiles = useProfiles();
  const open = rows.filter((row) => !row.accepted_at && !row.revoked_at);

  const revoke = async (row: Invitation) => {
    const who = row.email || 'this invitation';
    const sure = await confirm({
      title: 'Revoke this invitation?',
      body: `The link for ${who} stops working at once. You can invite them again with a new link.`,
      confirmLabel: 'Revoke',
      tone: 'danger',
    });
    if (!sure) return;
    const result = await revokeInvite(row.id);
    if (result.ok) {
      toast.good('Invitation revoked.');
      void loadInvitations(true);
    }
  };

  return (
    <section class="wb-section" aria-labelledby="wb-invites-title">
      <div class="wb-section-head">
        <h2 class="wb-section-title" id="wb-invites-title">
          Open invitations
        </h2>
        {open.length ? <span class="wb-mono wb-meta">{open.length}</span> : null}
      </div>
      {error ? (
        <div class="wb-people-note">
          <p>The invitations did not load. {error.message}</p>
          <Button size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <Skeleton height={52} radius={8} />
      ) : open.length === 0 ? (
        <p class="wb-meta">No invitations are waiting. Use Invite to make one.</p>
      ) : (
        <ul class="wb-list wb-invite-list">
          {open.map((row) => {
            const when = expiryWords(row.expires_at);
            const by = profiles.find((person) => person.id === row.invited_by);
            return (
              <li class="wb-invite" key={row.id}>
                <div class="wb-invite-main">
                  <span class="wb-invite-who">{row.email || 'Anyone with the link'}</span>
                  <span class="wb-invite-meta">
                    <span>{roleById.get(row.role_id)?.name ?? 'Unknown role'}</span>
                    {by ? <span>Invited by {displayName(by)}</span> : null}
                    <span title={fullTime(row.created_at)}>Sent {relativeTime(row.created_at)}</span>
                    <span class={when.expired ? 'wb-invite-expired' : ''}>{when.text}</span>
                  </span>
                  {row.note ? <span class="wb-invite-note">{row.note}</span> : null}
                </div>
                <div class="wb-invite-actions">
                  <CopyLink token={row.token} />
                  <Button size="sm" variant="quiet" onClick={() => revoke(row)} aria-label={`Revoke the invitation for ${row.email || 'anyone with the link'}`}>
                    Revoke
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A button that copies the join link; if the browser refuses, shows the link selected. */
function CopyLink({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const link = joinLink(token);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('manual');
    }
  };

  if (state === 'manual') {
    return (
      <input
        class="wb-input wb-mono-soft wb-invite-link"
        readOnly
        aria-label="Join link"
        value={link}
        onFocus={(event) => (event.currentTarget as HTMLInputElement).select()}
        ref={(node) => node?.select()}
      />
    );
  }
  return (
    <Button size="sm" variant="secondary" onClick={copy}>
      {state === 'copied' ? 'Copied' : 'Copy link'}
    </Button>
  );
}
