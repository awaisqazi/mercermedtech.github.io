/**
 * Settings, Roles tab: every role with its description and how many people
 * hold it. Opening one shows the editor; the owner role opens read-only.
 * "New role" starts from a copy of Team member's permissions.
 */
import { useMemo, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconPlus } from '../../components/Icons';
import { PhoneAction } from '../../components/PageHeader';
import { Skeleton } from '../../components/Skeleton';
import { plural } from '../../lib/format';
import { toast } from '../../lib/toasts';
import { OWNER_ROLE_KEY, DEFAULT_ROLE_KEY, PERMISSION_KEYS, type Role } from '../../lib/types';
import { deleteRole, useProfiles, useRoles, useWorkspace } from '../../lib/workspace';
import { RoleEditor, type RoleDraft } from './RoleEditor';

export function Roles() {
  const workspace = useWorkspace();
  const roles = useRoles();
  const profiles = useProfiles();
  const { confirm, element } = useConfirm();
  const [editing, setEditing] = useState<RoleDraft | null>(null);

  const usedBy = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of profiles) counts.set(person.role_id, (counts.get(person.role_id) ?? 0) + 1);
    return counts;
  }, [profiles]);

  const loading = workspace.status === 'loading' || workspace.status === 'idle';

  const startNew = () => {
    const base = roles.find((role) => role.key === DEFAULT_ROLE_KEY);
    setEditing({ role: null, name: '', description: '', permissions: [...(base?.permissions ?? [])] });
  };

  const remove = async (role: Role) => {
    const sure = await confirm({
      title: `Delete ${role.name}?`,
      body: 'This cannot be undone. Nobody holds this role, so no one loses access.',
      confirmLabel: 'Delete role',
      tone: 'danger',
    });
    if (!sure) return false;
    const result = await deleteRole(role.id);
    if (result.ok) toast.good(`${role.name} is deleted.`);
    return result.ok;
  };

  return (
    <section class="wb-section wb-settings-panel" aria-label="Roles">
      <div class="wb-settings-bar">
        <p class="wb-prose">
          A role is a set of permissions. Everyone has exactly one. The database enforces them.
        </p>
        <Button variant="primary" icon={<IconPlus size={16} />} onClick={startNew}>
          New role
        </Button>
      </div>
      <PhoneAction label="New role" icon={<IconPlus size={18} />} onClick={startNew} />

      {loading ? (
        <Skeleton height={64} radius={8} />
      ) : (
        <ul class="wb-list wb-role-list" aria-label="Roles">
          {roles.map((role) => {
            const count = usedBy.get(role.id) ?? 0;
            const owner = role.key === OWNER_ROLE_KEY;
            return (
              <li class="wb-role-row" key={role.id}>
                <div class="wb-role-main">
                  <span class="wb-role-name">
                    {role.name}
                    {role.is_system ? <Chip tone="quiet">System</Chip> : null}
                  </span>
                  {role.description ? <span class="wb-role-desc">{role.description}</span> : null}
                  <span class="wb-role-meta">
                    <span>Used by {plural(count, 'person', 'people')}</span>
                    <span>{owner ? 'Every permission' : `${role.permissions.length} of ${PERMISSION_KEYS.length} permissions`}</span>
                  </span>
                </div>
                <div class="wb-role-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditing({ role, name: role.name, description: role.description, permissions: [...role.permissions] })}
                    aria-label={`${owner ? 'View' : 'Edit'} ${role.name}`}
                  >
                    {owner ? 'View' : 'Edit'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RoleEditor
        draft={editing}
        open={editing !== null}
        usedBy={editing?.role ? (usedBy.get(editing.role.id) ?? 0) : 0}
        onClose={() => setEditing(null)}
        onDelete={remove}
      />
      {element}
    </section>
  );
}
