/**
 * Accepting an invitation.
 *
 * `invite_preview(token)` is readable without an account, so the screen can
 * greet the person by the name of whoever invited them and lock the email
 * field when the invitation was addressed to one person. The real check
 * happens in the database: the trigger on `auth.users` rolls the signup back
 * if the token is not live, which is why a failure here reads as "this
 * invitation isn't valid" rather than "something went wrong".
 */
import { useEffect, useState } from 'preact/hooks';
import { joinWithInvite, previewInvite } from '../lib/auth';
import { MIN_PASSWORD } from '../lib/config';
import { navigate } from '../lib/router';
import { formatDateLong } from '../lib/format';
import { GLOBAL_ROLE_LABEL, type InvitePreview } from '../lib/types';
import { toast } from '../lib/toasts';
import { AuthShell } from '../components/AppShell';
import { Button, LinkButton } from '../components/Button';
import { Field, Input } from '../components/Field';
import { IconEye, IconEyeOff } from '../components/Icons';
import { Skeleton } from '../components/Skeleton';

export function Join({ token }: { token: string }) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void previewInvite(token).then((result) => {
      if (cancelled) return;
      setPreview(result);
      if (result.email) setEmail(result.email);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (event: Event) => {
    event.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Please put in the name colleagues will see.');
      return;
    }
    if (!email.trim()) {
      setError('An email address is needed to sign in with.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for the password.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords are not the same.');
      return;
    }

    setBusy(true);
    const result = await joinWithInvite({ token, email, password, fullName });
    setBusy(false);
    if (result.ok) {
      toast.good('Welcome aboard.');
      navigate('/', { replace: true });
    } else {
      setError(result.error?.message ?? 'That did not work.');
    }
  };

  if (loading) {
    return (
      <AuthShell title="Checking the invitation">
        <div class="wb-skeleton-lines">
          <Skeleton width="70%" height={18} />
          <Skeleton width="100%" height={40} />
          <Skeleton width="100%" height={40} />
        </div>
      </AuthShell>
    );
  }

  if (!preview?.valid) {
    return (
      <AuthShell title="That invitation is not usable">
        <p class="wb-prose">
          It may have been used already, withdrawn, or it may have run out. Ask whoever sent it for a
          fresh link.
        </p>
        <LinkButton variant="secondary" full href="#/login">
          Go to sign in
        </LinkButton>
      </AuthShell>
    );
  }

  const roleWord = preview.role ? GLOBAL_ROLE_LABEL[preview.role].toLowerCase() : 'member';

  return (
    <AuthShell
      title="Set up your account"
      subtitle={
        preview.role === 'owner'
          ? 'You are setting up the workspace as its owner.'
          : preview.inviter && preview.inviter !== 'A teammate'
            ? `${preview.inviter} invited you as ${/^[aeiou]/.test(roleWord) ? 'an' : 'a'} ${roleWord}.`
            : `You have been invited as ${/^[aeiou]/.test(roleWord) ? 'an' : 'a'} ${roleWord}.`
      }
      footer={
        preview.expires_at ? (
          <p class="wb-auth-note">This invitation is good until {formatDateLong(preview.expires_at)}.</p>
        ) : null
      }
    >
      <form class="wb-form" onSubmit={submit} noValidate>
        <Field label="Your name" hint="What colleagues will see beside your changes." required>
          {(props) => (
            <Input
              {...props}
              autocomplete="name"
              value={fullName}
              onInput={(event) => setFullName((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>

        <Field
          label="Email"
          hint={preview.email ? 'This invitation is for that address only.' : undefined}
          required
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              autocomplete="username"
              value={email}
              readOnly={Boolean(preview.email)}
              onInput={(event) => setEmail((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>

        <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`} required>
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

        <Field label="Password again" error={error} required>
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
          Create the account
        </Button>
      </form>
    </AuthShell>
  );
}
