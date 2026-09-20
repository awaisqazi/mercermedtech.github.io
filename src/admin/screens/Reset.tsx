/**
 * Where the password-reset email lands. The Supabase SDK has already turned
 * the token in the URL into a short-lived session by the time this renders,
 * so all that is left is to choose a new password.
 */
import { useState } from 'preact/hooks';
import { changePassword, useAuth } from '../lib/auth';
import { MIN_PASSWORD } from '../lib/config';
import { navigate } from '../lib/router';
import { toast } from '../lib/toasts';
import { AuthShell } from '../components/AppShell';
import { Button, LinkButton } from '../components/Button';
import { Field, Input } from '../components/Field';
import { IconEye, IconEyeOff } from '../components/Icons';

export function Reset() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords are not the same.');
      return;
    }
    setBusy(true);
    const result = await changePassword(password);
    setBusy(false);
    if (result.ok) {
      toast.good('Password changed.');
      navigate('/', { replace: true });
    } else {
      setError(result.error?.message ?? 'That did not work.');
    }
  };

  if (auth.ready && !auth.userId) {
    return (
      <AuthShell title="That link has run out">
        <p class="wb-prose">
          Reset links only last a short while. Ask for a new one from the sign-in screen.
        </p>
        <LinkButton variant="secondary" full href="#/login">
          Go to sign in
        </LinkButton>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle={auth.email ?? undefined}>
      <form class="wb-form" onSubmit={submit} noValidate>
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`} required>
          {(props) => (
            <div class="wb-input-affix">
              <Input
                {...props}
                type={show ? 'text' : 'password'}
                autocomplete="new-password"
                value={password}
                onInput={(event) => setPassword((event.currentTarget as HTMLInputElement).value)}
              />
              <button
                type="button"
                class="wb-affix-button"
                onClick={() => setShow((value) => !value)}
                aria-label={show ? 'Hide the password' : 'Show the password'}
              >
                {show ? <IconEyeOff size={17} /> : <IconEye size={17} />}
              </button>
            </div>
          )}
        </Field>

        <Field label="New password again" error={error} required>
          {(props) => (
            <Input
              {...props}
              type={show ? 'text' : 'password'}
              autocomplete="new-password"
              value={confirm}
              onInput={(event) => setConfirm((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" full busy={busy}>
          Save the new password
        </Button>
      </form>
    </AuthShell>
  );
}
