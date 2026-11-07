/**
 * The role editor: name, description, and the permission catalogue as a plain
 * checklist (the sentence from types.ts beside each key), grouped Tasks /
 * Hours / Inquiries / Projects / People / Roles.
 *
 * The owner role opens read-only. Delete is offered only for a role nobody
 * holds that is not a system role.
 */
import { useId, useMemo, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Textarea } from '../../components/Field';
import { OWNER_ROLE_KEY, PERMISSIONS, type Permission, type Role } from '../../lib/types';
import { plural } from '../../lib/format';
import { saveRole, useRoles } from '../../lib/workspace';

export interface RoleDraft {
  /** The role being edited, or null for a new one. */
  role: Role | null;
  name: string;
  description: string;
  permissions: Permission[];
}

const GROUPS: Array<{ prefix: string; title: string }> = [
  { prefix: 'tasks', title: 'Tasks' },
  { prefix: 'hours', title: 'Hours' },
  { prefix: 'inquiries', title: 'Inquiries' },
  { prefix: 'projects', title: 'Projects' },
  { prefix: 'people', title: 'People' },
  { prefix: 'roles', title: 'Roles' },
];

/** A role's key is made once, from its name, and never changes after. */
function keyFor(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role';
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;
  return key;
}

interface EditorProps {
  draft: RoleDraft | null;
  open: boolean;
  usedBy: number;
  onClose: () => void;
  onDelete: (role: Role) => Promise<boolean>;
}

/** Mounted only while open, so every opening starts from the role's own values. */
export function RoleEditor(props: EditorProps) {
  const { draft, open } = props;
  return open && draft ? <RoleForm key={draft.role?.id ?? 'new'} {...props} draft={draft} /> : null;
}

function RoleForm({ draft, usedBy, onClose, onDelete }: Omit<EditorProps, 'open' | 'draft'> & { draft: RoleDraft }) {
  const roles = useRoles();
  const formId = useId();
  const role = draft.role;
  const owner = role?.key === OWNER_ROLE_KEY;
  const readOnly = Boolean(role?.is_system || owner);

  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [permissions, setPermissions] = useState<Permission[]>(draft.permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: PERMISSIONS.filter((info) => info.key.split('.')[0] === group.prefix),
      })).filter((group) => group.items.length),
    []
  );

  const toggle = (key: Permission, on: boolean) => {
    setPermissions((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      // Keep the catalogue's own order so the saved array is stable.
      return PERMISSIONS.map((info) => info.key).filter((k) => next.has(k));
    });
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    if (readOnly) return;
    if (!name.trim()) {
      setError('Give the role a name.');
      return;
    }
    setError(null);
    setBusy(true);
    const result = role
      ? await saveRole({ id: role.id, name: name.trim(), description: description.trim(), permissions })
      : await saveRole({
          key: keyFor(name, new Set(roles.map((row) => row.key))),
          name: name.trim(),
          description: description.trim(),
          permissions,
          sort: Math.max(0, ...roles.map((row) => row.sort)) + 10,
        });
    setBusy(false);
    if (result.ok) onClose();
  };

  const canDelete = Boolean(role && !role.is_system && usedBy === 0);

  const checked = owner ? new Set<Permission>(PERMISSIONS.map((info) => info.key)) : new Set(permissions);

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={owner ? role!.name : role ? `Edit ${role.name}` : 'New role'}
      description={
        owner
          ? 'The owner role always has every permission. It cannot be edited or deleted.'
          : role
            ? undefined
            : 'It starts as a copy of Team member. Change what it allows, then save.'
      }
      footer={
        <>
          {canDelete ? (
            <Button
              variant="quiet"
              class="wb-role-delete"
              onClick={async () => {
                if (role && (await onDelete(role))) onClose();
              }}
            >
              Delete role
            </Button>
          ) : null}
          <span class="wb-spacer" />
          <Button variant="quiet" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {readOnly ? null : (
            <Button variant="primary" type="submit" form={formId} busy={busy}>
              {role ? 'Save role' : 'Create role'}
            </Button>
          )}
        </>
      }
    >
      <form class="wb-form wb-role-form" id={formId} onSubmit={submit} noValidate>
        <Field label="Name" required={!readOnly} error={error}>
          {(props) => (
            <Input
              {...props}
              value={name}
              maxLength={60}
              readOnly={readOnly}
              autoComplete="off"
              onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>
        <Field label="Description (optional)">
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={description}
              readOnly={readOnly}
              onInput={(event) => setDescription((event.currentTarget as HTMLTextAreaElement).value)}
            />
          )}
        </Field>

        <div class="wb-perm-sets">
          <p class="wb-perm-intro">
            Everyone with an active account can already see tasks, projects, people and activity, comment on tasks, and see their own hours. These permissions add to that.
          </p>
          {groups.map((group) => (
            <fieldset class="wb-perm-group" key={group.prefix} disabled={readOnly}>
              <legend class="wb-perm-legend">{group.title}</legend>
              {group.items.map((info) => (
                <label class="wb-check wb-perm" key={info.key}>
                  <input
                    type="checkbox"
                    checked={checked.has(info.key)}
                    onChange={(event) => toggle(info.key, (event.currentTarget as HTMLInputElement).checked)}
                  />
                  <span class="wb-perm-text">
                    <span class="wb-perm-sentence">{info.sentence}</span>
                    <span class="wb-perm-key wb-mono">{info.key}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>

        {role && !role.is_system && usedBy > 0 ? (
          <p class="wb-hint">
            {plural(usedBy, 'person holds', 'people hold')} this role, so it cannot be deleted. Move them to another role first.
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
