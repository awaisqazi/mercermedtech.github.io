/**
 * Your own settings: the name colleagues see, your title, the theme, your
 * password, and a way to sign out everywhere if a device goes missing. Your
 * role is shown but not editable here: nobody may change their own role, and
 * the database refuses it even if the interface were to try.
 */
import { useEffect, useState } from 'preact/hooks';
import { changePassword, displayName, roleName, signOut, updateOwnProfile, useAuth } from '../lib/auth';
import { MIN_PASSWORD } from '../lib/config';
import { navigate } from '../lib/router';
import { useTheme, type ThemeChoice } from '../lib/theme';
import { relativeTime } from '../lib/format';
import { toast } from '../lib/toasts';
import { useMyRole } from '../lib/perms';
import { closeWorkspace } from '../lib/workspace';
import { leave } from '../components/AppShell';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Tabs';
import { SkeletonLines } from '../components/Skeleton';

const THEMES: Array<{ value: ThemeChoice; label: string }> = [
  { value: 'system', label: 'Same as this device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function Account() {
  const auth = useAuth();
  const theme = useTheme();
  const role = useMyRole();
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
    if (!fullName.trim()) {
      toast.bad('Your name cannot be blank. Colleagues see it beside your work.');
      return;
    }
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

  const signOutEverywhere = async () => {
    const result = await signOut('global');
    if (!result.ok) {
      toast.bad(result.error?.message ?? 'That did not work.');
      return;
    }
    closeWorkspace();
    navigate('/login', { replace: true });
  };

  if (!auth.ready) return <SkeletonLines count={5} />;

  const roleWord = role?.name ?? roleName(auth);

  return (
    <div class="wb-page wb-page-narrow">
      <PageHeader title="Account" />

      <section class="wb-panel wb-account-card" aria-label="You">
        <Avatar id={auth.userId} name={auth.profile?.full_name} email={auth.email} size={48} />
        <dl class="wb-facts">
          <div>
            <dt>Name</dt>
            <dd>{displayName(auth)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{auth.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              {roleWord || 'Not known yet'}
              <span class="wb-facts-note">An administrator changes roles on the People screen.</span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="wb-panel">
        <h2 class="wb-panel-title">About you</h2>
        <form class="wb-form" onSubmit={saveProfile}>
          <Field label="Name" hint="What colleagues see beside your work.">
            {(props) => (
              <Input
                {...props}
                value={fullName}
                autocomplete="name"
                onInput={(event) => setFullName((event.currentTarget as HTMLInputElement).value)}
              />
            )}
          </Field>
          <Field label="Title" hint="Optional. Shown on the People screen.">
            {(props) => (
              <Input
                {...props}
                value={title}
                autocomplete="organization-title"
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
        <p class="wb-prose">Kept in this browser only.</p>
        <Segmented<ThemeChoice> label="Theme" value={theme.choice} onValue={theme.set} options={THEMES} />
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
            <Button type="submit" variant="secondary" busy={savingPassword} disabled={!password}>
              Change password
            </Button>
          </div>
        </form>
      </section>

      <section class="wb-panel">
        <h2 class="wb-panel-title">Sessions</h2>
        <p class="wb-prose">Signing out everywhere ends every signed-in browser and phone, this one included.</p>
        <div class="wb-form-actions">
          <Button variant="secondary" onClick={() => void leave()}>
            Sign out
          </Button>
          <Button variant="danger" onClick={() => void signOutEverywhere()}>
            Sign out everywhere
          </Button>
        </div>
      </section>
    </div>
  );
}
