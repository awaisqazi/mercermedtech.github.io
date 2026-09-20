/**
 * Who is on this project, and what they may do here. A manager can add anyone
 * who already has an account; getting an account in the first place is the
 * People screen's job.
 */
import { useEffect, useState } from 'preact/hooks';
import { removeMember, setMember, useProject } from '../lib/store';
import { loadAllProfiles } from '../lib/queries';
import { getAuth } from '../lib/auth';
import { relativeTime } from '../lib/format';
import { toast } from '../lib/toasts';
import { PROJECT_ROLE_LABEL, type Profile, type ProjectRole } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { Select, optionsFrom } from '../components/Select';

const ROLES: ProjectRole[] = ['manager', 'editor', 'viewer'];

export function MembersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { members, profiles, canManage, project } = useProject();
  const [everyone, setEveryone] = useState<Profile[]>([]);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const me = getAuth().userId;

  useEffect(() => {
    if (!open || !canManage) return;
    void loadAllProfiles().then(setEveryone);
  }, [open, canManage]);

  const candidates = everyone.filter(
    (profile) => !members.some((member) => member.user_id === profile.id)
  );

  const add = async (userId: string) => {
    if (!userId) return;
    setBusy(true);
    const result = await setMember(userId, 'editor');
    setBusy(false);
    setAdding('');
    if (result.ok) toast.good('Added.');
    else toast.bad(result.error?.message ?? 'That did not work.');
  };

  return (
    <Dialog
      open={open}
      title="Members"
      description={project ? `Who can see and change ${project.name}.` : undefined}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {members.length ? (
        <ul class="wb-member-list">
          {members.map((member) => {
            const profile = profiles[member.user_id];
            return (
              <li class="wb-member" key={member.user_id}>
                <Avatar id={member.user_id} name={profile?.full_name} email={profile?.email} size={30} />
                <div class="wb-member-body">
                  <p class="wb-member-name">
                    {profile?.full_name?.trim() || profile?.email || 'Member'}
                    {member.user_id === me ? <Chip tone="quiet">You</Chip> : null}
                  </p>
                  <p class="wb-member-meta wb-mono-soft">
                    {profile?.email}
                    {profile?.last_seen_at ? ` · seen ${relativeTime(profile.last_seen_at)}` : ''}
                  </p>
                </div>
                {canManage ? (
                  <>
                    <Select<ProjectRole>
                      value={member.role}
                      size="sm"
                      aria-label={`Role for ${profile?.full_name || profile?.email || 'this member'}`}
                      options={optionsFrom(ROLES, PROJECT_ROLE_LABEL)}
                      onValue={async (role) => {
                        const result = await setMember(member.user_id, role);
                        if (!result.ok && result.error) toast.bad(result.error.message);
                      }}
                    />
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={async () => {
                        const result = await removeMember(member.user_id);
                        if (result.ok) toast.good('Removed.');
                        else if (result.error) toast.bad(result.error.message);
                      }}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <Chip tone="quiet">{PROJECT_ROLE_LABEL[member.role]}</Chip>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Nobody on this project yet" />
      )}

      {canManage ? (
        <div class="wb-member-add">
          {candidates.length ? (
            <Select
              value={adding}
              placeholder="Add someone who already has an account"
              options={candidates.map((profile) => ({
                value: profile.id,
                label: profile.full_name?.trim() || profile.email || 'Person',
              }))}
              disabled={busy}
              aria-label="Add a member"
              onValue={(value) => void add(value)}
            />
          ) : (
            <p class="wb-hint">
              Everyone with an account is already on this project. Invite more people from the People
              screen.
            </p>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
