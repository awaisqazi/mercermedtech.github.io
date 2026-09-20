/**
 * Sign in. There is no public sign-up: an account exists only because somebody
 * sent an invitation link, so the panel says so rather than offering a form
 * that would always fail.
 */
import { useState } from 'preact/hooks';
import { requestPasswordReset, signIn } from '../lib/auth';
import { navigate, takeDestination } from '../lib/router';
import { toast } from '../lib/toasts';
import { AuthShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { IconEye, IconEyeOff } from '../components/Icons';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [sent, setSent] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setError(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Type the email address the account uses.');
        return;
      }
      setBusy(true);
      const result = await requestPasswordReset(email);
      setBusy(false);
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error?.message ?? 'That did not work.');
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('Both the email address and the password are needed.');
      return;
    }
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) {
      toast.good('Signed in.');
      navigate(takeDestination(), { replace: true });
    } else {
      setError(result.error?.message ?? 'That did not work.');
    }
  };

  if (mode === 'forgot' && sent) {
    return (
      <AuthShell title="Check your email">
        <p class="wb-prose">
          If there is an account for {email.trim()}, a link to set a new password is on its way. The
          link brings you back here.
        </p>
        <Button
          variant="secondary"
          full
          onClick={() => {
            setSent(false);
            setMode('signin');
          }}
        >
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={mode === 'forgot' ? 'Set a new password' : 'Sign in'}
      subtitle={
        mode === 'forgot'
          ? 'We will email a link that lets you choose a new one.'
          : undefined
      }
      footer={
        <p class="wb-auth-note">
          Access is by invitation. Ask an administrator for a link.
        </p>
      }
    >
      <form class="wb-form" onSubmit={submit} noValidate>
        <Field label="Email" error={error && mode === 'forgot' ? error : null}>
          {(props) => (
            <Input
              {...props}
              type="email"
              autocomplete="username"
              value={email}
              onInput={(event) => setEmail((event.currentTarget as HTMLInputElement).value)}
            />
          )}
        </Field>

        {mode === 'signin' ? (
          <Field label="Password" error={error}>
            {(props) => (
              <div class="wb-input-affix">
                <Input
                  {...props}
                  type={show ? 'text' : 'password'}
                  autocomplete="current-password"
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
        ) : null}

        <Button type="submit" variant="primary" full busy={busy}>
          {mode === 'forgot' ? 'Send the link' : 'Sign in'}
        </Button>

        <button
          type="button"
          class="wb-linkish"
          onClick={() => {
            setError(null);
            setMode((value) => (value === 'signin' ? 'forgot' : 'signin'));
          }}
        >
          {mode === 'signin' ? 'Forgot password?' : 'Back to sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
