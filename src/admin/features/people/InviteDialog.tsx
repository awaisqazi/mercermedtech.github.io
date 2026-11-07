/**
 * Invite someone: pick a role, optionally an email and a note, and how long
 * the link lasts. The database makes the token; after creating, the join link
 * is shown once in a CopyField. The link is the only way in, so the dialog
 * says so.
 */
import { useId, useMemo, useState } from 'preact/hooks';
import { Button } from '../../components/Button';
import { CopyField } from '../../components/CopyField';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Textarea } from '../../components/Field';
import { Select } from '../../components/Select';
import { joinLink } from '../../lib/config';
import { formatDateLong } from '../../lib/format';
import { createInvite, useRoles } from '../../lib/workspace';
import { DEFAULT_ROLE_KEY, OWNER_ROLE_KEY } from '../../lib/types';

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

/** Mounted only while open, so every opening starts from a fresh form. */
export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <InviteForm onClose={onClose} /> : null;
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const roles = useRoles();
  const offered = useMemo(() => roles.filter((role) => role.key !== OWNER_ROLE_KEY), [roles]);
  const formId = useId();

  const [roleId, setRoleId] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [days, setDays] = useState(String(DEFAULT_DAYS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string; expiresAt: string } | null>(null);

  const chosenId = roleId || (offered.find((role) => role.key === DEFAULT_ROLE_KEY) ?? offered[0])?.id || '';
  const chosen = offered.find((role) => role.id === chosenId);

  const submit = async (event: Event) => {
    event.preventDefault();
    const count = Number(days);
    if (!Number.isInteger(count) || count < 1 || count > MAX_DAYS) {
      setError(`Use a whole number of days, from 1 to ${MAX_DAYS}.`);
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('That email address does not look right.');
      return;
    }
    if (!chosenId) {
      setError('Choose a role.');
      return;
    }
    setError(null);
    setBusy(true);
    const expires = new Date(Date.now() + count * 86_400_000).toISOString();
    const result = await createInvite({ role_id: chosenId, email, note, expires_at: expires });
    setBusy(false);
    if (!result.ok) return; // The store has toasted the database's own words.
    const token = result.row?.token;
    if (!token) {
      setError('The invitation was saved, but its link did not come back. Close this and find it under open invitations.');
      return;
    }
    setCreated({ token, expiresAt: result.row?.expires_at ?? expires });
  };

  const again = () => {
    setEmail('');
    setNote('');
    setCreated(null);
    setError(null);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={created ? 'Invitation ready' : 'Invite someone'}
      description={created ? undefined : 'You get a link to send. They set their own password when they open it.'}
      footer={
        created ? (
          <>
            <Button variant="quiet" onClick={again}>
              Invite another person
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={formId} busy={busy}>
              Create invitation
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div class="wb-invite-done">
          <CopyField label="Join link" value={joinLink(created.token)} />
          <p class="wb-hint">
            This link is the only way in. Send it to the person yourself. It expires on {formatDateLong(created.expiresAt)}.
          </p>
        </div>
      ) : (
        <form class="wb-form" id={formId} onSubmit={submit} noValidate>
          <Field label="Role" hint={chosen?.description || undefined}>
            {(props) => (
              <Select
                {...props}
                value={chosenId}
                onValue={setRoleId}
                options={offered.map((role) => ({ value: role.id, label: role.name }))}
              />
            )}
          </Field>
          <Field label="Email (optional)" hint="Only used to match the link to the person. We do not send anything.">
            {(props) => (
              <Input
                {...props}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onInput={(event) => setEmail((event.currentTarget as HTMLInputElement).value)}
              />
            )}
          </Field>
          <Field label="Note (optional)" hint="Shown to you in the list of open invitations.">
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={note}
                onInput={(event) => setNote((event.currentTarget as HTMLTextAreaElement).value)}
              />
            )}
          </Field>
          <Field label="Link lasts (days)">
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_DAYS}
                step={1}
                value={days}
                onInput={(event) => setDays((event.currentTarget as HTMLInputElement).value)}
              />
            )}
          </Field>
          {error ? (
            <p class="wb-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </Dialog>
  );
}
