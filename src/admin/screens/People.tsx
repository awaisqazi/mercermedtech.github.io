/**
 * Members and invitations. Administrators only; the database checks again.
 *
 * Invitations are the whole account-creation story, because the project's
 * email budget is a handful of messages an hour: an administrator creates an
 * invitation here, copies the link and the prewritten message, and sends them
 * however they normally talk to that person.
 */
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { isOwner, useAuth } from '../lib/auth';
import {
  createInvitation,
  loadPeople,
  revokeInvitation,
  setGlobalRole,
  type PeopleData,
} from '../lib/queries';
import { APP_NAME, joinLink } from '../lib/config';
import { formatDate, relativeTime } from '../lib/format';
import { toast } from '../lib/toasts';
import {
  GLOBAL_ROLE_LABEL,
  PROJECT_ROLE_LABEL,
  type GlobalRole,
  type Invitation,
  type ProjectGrant,
  type ProjectRole,
} from '../lib/types';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { CopyField } from '../components/CopyField';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { Field, Input, Textarea } from '../components/Field';
import { Select, optionsFrom } from '../components/Select';
import { SkeletonLines } from '../components/Skeleton';
import { SchemaNotice } from '../components/SchemaNotice';
import { Segmented } from '../components/Tabs';
import { IconLink, IconPlus } from '../components/Icons';

const GLOBAL_ROLES: GlobalRole[] = ['member', 'admin', 'owner'];
const PROJECT_ROLES: ProjectRole[] = ['manager', 'editor', 'viewer'];
const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
];

type InviteBucket = 'pending' | 'accepted' | 'finished';

function bucketOf(invitation: Invitation): InviteBucket {
  if (invitation.accepted_at) return 'accepted';
  if (invitation.revoked_at) return 'finished';
  if (new Date(invitation.expires_at).getTime() < Date.now()) return 'finished';
  return 'pending';
}

export function People() {
  const auth = useAuth();
  const owner = isOwner(auth);
  const [data, setData] = useState<PeopleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [bucket, setBucket] = useState<InviteBucket>('pending');
  const [madeToken, setMadeToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setData(await loadPeople());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const invitations = useMemo(
    () => (data?.invitations ?? []).filter((invitation) => bucketOf(invitation) === bucket),
    [data, bucket]
  );

  const changeRole = async (userId: string, role: GlobalRole) => {
    const result = await setGlobalRole(userId, role);
    if (result.ok) {
      toast.good('Role changed.');
      void refresh();
    } else {
      toast.bad(result.error?.message ?? 'That did not work.');
    }
  };

  const revoke = async (id: string) => {
    const result = await revokeInvitation(id);
    if (result.ok) {
      toast.good('Invitation withdrawn.');
      void refresh();
    } else {
      toast.bad(result.error?.message ?? 'That did not work.');
    }
  };

  return (
    <div class="wb-page">
      <header class="wb-page-head">
        <div>
          <h1 class="wb-page-title">People</h1>
          <p class="wb-page-sub">Who is in the Workbench, and who has been invited.</p>
        </div>
        <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setInviting(true)}>
          Invite someone
        </Button>
      </header>

      {data?.error ? <SchemaNotice error={data.error} what="the people list" /> : null}

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Members</h2>
          <span class="wb-mono-soft">{data?.profiles.length ?? 0}</span>
        </header>

        {loading ? (
          <SkeletonLines count={4} />
        ) : data?.profiles.length ? (
          <div class="wb-table-scroll">
            <table class="wb-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Projects</th>
                  <th scope="col">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data.profiles.map((profile) => (
                  <tr key={profile.id}>
                    <th scope="row">
                      <span class="wb-person">
                        <Avatar id={profile.id} name={profile.full_name} email={profile.email} size={26} />
                        <span>
                          <span class="wb-person-name">{profile.full_name || 'No name yet'}</span>
                          {profile.title ? <span class="wb-person-title">{profile.title}</span> : null}
                        </span>
                      </span>
                    </th>
                    <td class="wb-mono-soft">{profile.email}</td>
                    <td>
                      {owner && profile.id !== auth.userId ? (
                        <Select<GlobalRole>
                          value={profile.role}
                          size="sm"
                          aria-label={`Role for ${profile.full_name || profile.email}`}
                          options={optionsFrom(GLOBAL_ROLES, GLOBAL_ROLE_LABEL)}
                          onValue={(role) => void changeRole(profile.id, role)}
                        />
                      ) : (
                        <Chip tone={profile.role === 'member' ? 'quiet' : 'accent'}>
                          {GLOBAL_ROLE_LABEL[profile.role]}
                        </Chip>
                      )}
                    </td>
                    <td class="wb-mono">{data.projectCounts[profile.id] ?? 0}</td>
                    <td class="wb-mono-soft">{relativeTime(profile.last_seen_at) || 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nobody yet" body="Invitations are the only way in." />
        )}
        {owner ? null : (
          <p class="wb-hint">Only the owner can change someone&rsquo;s role.</p>
        )}
      </section>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">Invitations</h2>
          <Segmented<InviteBucket>
            label="Which invitations"
            value={bucket}
            onValue={setBucket}
            options={[
              { value: 'pending', label: 'Open' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'finished', label: 'Expired or withdrawn' },
            ]}
          />
        </header>

        {loading ? (
          <SkeletonLines count={3} />
        ) : invitations.length ? (
          <ul class="wb-invite-list">
            {invitations.map((invitation) => (
              <li class="wb-invite" key={invitation.id}>
                <div class="wb-invite-body">
                  <p class="wb-invite-who">
                    {invitation.email || 'Anyone with the link'}
                    <Chip tone="quiet">{GLOBAL_ROLE_LABEL[invitation.role]}</Chip>
                    {invitation.project_grants?.length ? (
                      <Chip tone="quiet">
                        {invitation.project_grants.length} project
                        {invitation.project_grants.length === 1 ? '' : 's'}
                      </Chip>
                    ) : null}
                  </p>
                  <p class="wb-invite-meta wb-mono-soft">
                    {bucket === 'accepted'
                      ? `Accepted ${relativeTime(invitation.accepted_at)}`
                      : invitation.revoked_at
                        ? `Withdrawn ${relativeTime(invitation.revoked_at)}`
                        : `Good until ${formatDate(invitation.expires_at)}`}
                    {invitation.note ? ` · ${invitation.note}` : ''}
                  </p>
                </div>
                {bucket === 'pending' ? (
                  <div class="wb-invite-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<IconLink size={15} />}
                      onClick={() => setMadeToken(invitation.token)}
                    >
                      Link
                    </Button>
                    <Button variant="quiet" size="sm" onClick={() => void revoke(invitation.id)}>
                      Withdraw
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={
              bucket === 'pending'
                ? 'No open invitations'
                : bucket === 'accepted'
                  ? 'None accepted yet'
                  : 'Nothing expired or withdrawn'
            }
            body={bucket === 'pending' ? 'Invite someone and the link shows up here.' : undefined}
          />
        )}
      </section>

      <InviteDialog
        open={inviting}
        people={data}
        onClose={() => setInviting(false)}
        onCreated={(token) => {
          setInviting(false);
          setMadeToken(token);
          void refresh();
        }}
      />

      <LinkDialog token={madeToken} onClose={() => setMadeToken(null)} />
    </div>
  );
}

/* ------------------------------------------------------------- the form --- */

function InviteDialog({
  open,
  people,
  onClose,
  onCreated,
}: {
  open: boolean;
  people: PeopleData | null;
  onClose: () => void;
  onCreated: (token: string) => void;
}) {
  const auth = useAuth();
  const owner = isOwner(auth);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<GlobalRole>('member');
  const [note, setNote] = useState('');
  const [days, setDays] = useState('14');
  const [grants, setGrants] = useState<ProjectGrant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projects = people?.projects ?? [];
  const available = projects.filter(
    (project) => !grants.some((grant) => grant.project_id === project.id)
  );

  const submit = async () => {
    setError(null);
    setBusy(true);
    const result = await createInvitation({
      email: email.trim() ? email.trim() : null,
      role,
      project_grants: grants,
      note: note.trim() || null,
      days: Number(days) || 14,
    });
    setBusy(false);
    if (result.ok && result.invitation) {
      setEmail('');
      setNote('');
      setGrants([]);
      onCreated(result.invitation.token);
    } else {
      setError(result.error?.message ?? 'That did not work.');
    }
  };

  return (
    <Dialog
      open={open}
      title="Invite someone"
      description="This makes a link. Send it however you normally talk to that person."
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={submit}>
            Make the link
          </Button>
        </>
      }
    >
      <div class="wb-form">
        <Field
          label="Email"
          hint="Optional. With an address, only that person can use the link."
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              value={email}
              onInput={(event) => setEmail((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>

        <div class="wb-grid-2">
          <Field
            label="Role in the Workbench"
            hint={owner ? undefined : 'Only the owner can invite another administrator.'}
          >
            {(props) => (
              <Select<GlobalRole>
                {...props}
                value={role}
                options={[
                  { value: 'member', label: GLOBAL_ROLE_LABEL.member },
                  { value: 'admin', label: GLOBAL_ROLE_LABEL.admin, disabled: !owner },
                ]}
                onValue={setRole}
              />
            )}
          </Field>
          <Field label="Good for">
            {(props) => (
              <Select {...props} value={days} options={EXPIRY_OPTIONS} onValue={setDays} />
            )}
          </Field>
        </div>

        <fieldset class="wb-fieldset">
          <legend>Projects to put them on</legend>
          {grants.length ? (
            <ul class="wb-grant-list">
              {grants.map((grant) => {
                const project = projects.find((entry) => entry.id === grant.project_id);
                return (
                  <li class="wb-grant" key={grant.project_id}>
                    <span class="wb-grant-name">{project?.name ?? 'Project'}</span>
                    <Select<ProjectRole>
                      value={grant.role}
                      size="sm"
                      aria-label={`Role on ${project?.name ?? 'the project'}`}
                      options={optionsFrom(PROJECT_ROLES, PROJECT_ROLE_LABEL)}
                      onValue={(next) =>
                        setGrants((current) =>
                          current.map((entry) =>
                            entry.project_id === grant.project_id ? { ...entry, role: next } : entry
                          )
                        )
                      }
                    />
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() =>
                        setGrants((current) =>
                          current.filter((entry) => entry.project_id !== grant.project_id)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p class="wb-hint">None yet. A member with no projects will see an empty Workbench.</p>
          )}

          {available.length ? (
            <Select
              value=""
              placeholder="Add a project"
              options={available.map((project) => ({ value: project.id, label: project.name }))}
              size="sm"
              aria-label="Add a project to this invitation"
              onValue={(projectId) =>
                projectId &&
                setGrants((current) => [...current, { project_id: projectId, role: 'editor' }])
              }
            />
          ) : null}
        </fieldset>

        <Field label="Note to yourself" hint="Not shown to the person you invite.">
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={note}
              onInput={(event) => setNote((event.currentTarget as HTMLTextAreaElement).value)}
            />
          )}
        </Field>

        {error ? <p class="wb-error">{error}</p> : null}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------- the link to send --- */

function LinkDialog({ token, onClose }: { token: string | null; onClose: () => void }) {
  if (!token) return null;
  const link = joinLink(token);
  const message = [
    `You have been invited to ${APP_NAME}, the Mercer Med Tech staff workspace.`,
    '',
    `Open this link to set up your account: ${link}`,
    '',
    'The link works once and runs out after a while, so use it soon. Do not forward it.',
  ].join('\n');

  return (
    <Dialog
      open
      title="Send this"
      description="The link is the invitation. Anyone who has it can use it, so send it to one person."
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div class="wb-form">
        <CopyField label="Join link" value={link} />
        <CopyField label="Message to paste" value={message} multiline rows={6} />
      </div>
    </Dialog>
  );
}
