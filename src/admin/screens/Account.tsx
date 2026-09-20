/**
 * Your own settings: the name colleagues see, your title, the theme, your
 * password, and a way to sign out everywhere if a device goes missing.
 */
import { useEffect, useState } from 'preact/hooks';
import { changePassword, displayName, signOut, updateOwnProfile, useAuth } from '../lib/auth';
import { MIN_PASSWORD } from '../lib/config';
import { navigate } from '../lib/router';
import { useTheme, type ThemeChoice } from '../lib/theme';
import { relativeTime } from '../lib/format';
import { toast } from '../lib/toasts';
import { GLOBAL_ROLE_LABEL } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Field, Input } from '../components/Field';
import { Segmented } from '../components/Tabs';
import { SkeletonLines } from '../components/Skeleton';

const THEMES: Array<{ value: ThemeChoice; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function Account() {
  const auth = useAuth();
  const theme = useTheme();
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(auth.profile?.full_name ?? '');
    setTitle(auth.profile?.title ?? '');
  }, [auth.profile?.full_name, auth.profile?.title]);

  const saveProfile = async (event: Event) => {
    event.preventDefault();
    setSavingProfile(true);
    const result = await updateOwnProfile({ full_name: fullName.trim(), title: title.trim() });
    setSavingProfile(false);
    if (result.ok) toast.good('Saved.');
    else toast.bad(result.error?.message ?? 'That did not work.');
  };

  const savePassword = async (event: Event) => {
    event.preventDefault();
    setPasswordError(null);
    if (password.length < MIN_PASSWORD) {
      setPasswordError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setPasswordError('The two passwords are not the same.');
      return;
    }
    setSavingPassword(true);
    const result = await changePassword(password);
    setSavingPassword(false);
    if (result.ok) {
      setPassword('');
      setConfirm('');
      toast.good('Password changed.');
    } else {
      setPasswordError(result.error?.message ?? 'That did not work.');
    }
  };

  if (!auth.ready) return <SkeletonLines count={5} />;

  return (
    <div class="wb-page wb-page-narrow">
      <header class="wb-page-head">
        <div class="wb-person wb-person-large">
          <Avatar id={auth.userId} name={auth.profile?.full_name} email={auth.email} size={46} />
          <div>
            <h1 class="wb-page-title">{displayName(auth)}</h1>
            <p class="wb-page-sub wb-mono-soft">
              {auth.email}
              {auth.profile ? (
                <>
                  {' '}
                  <Chip tone="quiet">{GLOBAL_ROLE_LABEL[auth.profile.role]}</Chip>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      <section class="wb-panel">
        <h2 class="wb-panel-title">About you</h2>
        <form class="wb-form" onSubmit={saveProfile}>
          <Field label="Name" hint="What colleagues see beside your changes.">
            {(props) => (
              <Input
                {...props}
                value={fullName}
                autocomplete="name"
                onInput={(event) => setFullName((event.currentTarget as HTMLInputElement).value)}
              />
            )}
          </Field>
          <Field label="Title" hint="Optional.">
            {(props) => (
              <Input
                {...props}
                value={title}
                onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
              />
            )}
          </Field>
          <div class="wb-form-actions">
            <Button type="submit" variant="primary" busy={savingProfile}>
              Save
            </Button>
          </div>
        </form>
        {auth.profile?.last_seen_at ? (
          <p class="wb-hint">Last seen {relativeTime(auth.profile.last_seen_at)}.</p>
        ) : null}
      </section>

      <section class="wb-panel">
        <h2 class="wb-panel-title">Theme</h2>
        <p class="wb-prose">Remembered in this browser only.</p>
        <Segmented<ThemeChoice>
          label="Theme"
          value={theme.choice}
          onValue={theme.set}
          options={THEMES}
        />
      </section>

      <section class="wb-panel">
        <h2 class="wb-panel-title">Password</h2>
        <form class="wb-form" onSubmit={savePassword}>
          <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
            {(props) => (
              <Input
                {...props}
                type="password"
                autocomplete="new-password"
                value={password}
                onInput={(event) => setPassword((event.currentTarget as HTMLInputElement).value)}
              />
            )}
          </Field>
          <Field label="New password again" error={passwordError}>
            {(props) => (
              <Input
                {...props}
                type="password"
                autocomplete="new-password"
                value={confirm}
                onInput={(event) => setConfirm((event.currentTarget as HTMLInputElement).value)}
              />
            )}
          </Field>
          <div class="wb-form-actions">
            <Button type="submit" variant="primary" busy={savingPassword} disabled={!password}>
              Change password
            </Button>
          </div>
        </form>
      </section>

      <section class="wb-panel">
        <h2 class="wb-panel-title">Sessions</h2>
        <p class="wb-prose">
          Signing out everywhere ends every signed-in browser and phone, including this one.
        </p>
        <div class="wb-form-actions">
          <Button
            variant="secondary"
            onClick={async () => {
              const result = await signOut('local');
              if (result.ok) navigate('/login', { replace: true });
              else toast.bad(result.error?.message ?? 'That did not work.');
            }}
          >
            Sign out
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const result = await signOut('global');
              if (result.ok) navigate('/login', { replace: true });
              else toast.bad(result.error?.message ?? 'That did not work.');
            }}
          >
            Sign out everywhere
          </Button>
        </div>
      </section>
    </div>
  );
}
