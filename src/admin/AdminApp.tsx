/**
 * The root of the Workbench.
 *
 * It starts the auth listener, decides whether the current address needs a
 * signed-in person, opens the workspace store for that person (and closes it
 * when they leave), renders the matching screen, and keeps the toasts on
 * screen. Everything else lives in the screens.
 *
 * The feature screens are only rendered once the workspace has loaded:
 * `WorkspaceGate` owns the loading, slow, stalled, refused and "database not
 * migrated yet" states, so no feature has to repeat them.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { startAuth, touchLastSeen, useAuth } from './lib/auth';
import { getRoute, navigate, rememberDestination, useRoute } from './lib/router';
import { applyTheme } from './lib/theme';
import { SLOW_LOAD_MS } from './lib/config';
import { useCan, useCanAny } from './lib/perms';
import { MIGRATION_FILE, closeWorkspace, openWorkspace, retryWorkspace, useWorkspace } from './lib/workspace';
import { AppShell, BrandContext } from './components/AppShell';
import { Toasts } from './components/Toasts';
import { SkeletonLines } from './components/Skeleton';
import { SchemaNotice, SlowNotice } from './components/SchemaNotice';
import { Button, LinkButton } from './components/Button';
import { EmptyState } from './components/EmptyState';
import { DEMO } from './demo/mode';
import { Login } from './screens/Login';
import { Join } from './screens/Join';
import { Reset } from './screens/Reset';
import { Account } from './screens/Account';
import { Home } from './features/home';
import { Tasks } from './features/tasks';
import { Hours } from './features/hours';
import { People, Person } from './features/people';
import { Settings } from './features/settings';
import { Activity } from './features/activity';
import { Inbox } from './features/inquiries';

startAuth();

/** Addresses that work without an account. */
const PUBLIC_ROUTES = new Set(['login', 'join', 'reset']);

/**
 * The logo arrives from `src/pages/admin/index.astro`: this island is
 * `client:only`, so the Astro page resolves the image and passes the finished
 * src down rather than the bundle importing a PNG it cannot process.
 */
interface AdminAppProps {
  logoSrc?: string;
  logoWidth?: number;
  logoHeight?: number;
}

export default function AdminApp({ logoSrc = '', logoWidth = 366, logoHeight = 120 }: AdminAppProps) {
  const auth = useAuth();
  const route = useRoute();

  // The boot splash in index.astro is ours to clear.
  useEffect(() => {
    document.getElementById('wb-boot')?.remove();
    applyTheme();
  }, []);

  // A new screen starts at the top; a query-only change (filters, an open
  // drawer) keeps the reader where they are.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  // An old v1 address lands on Home instead of a dead end.
  useEffect(() => {
    if (route.name === 'legacy') navigate('/', { replace: true });
  }, [route.name]);

  // Send anyone without a session to the sign-in screen, remembering where
  // they were headed so they land there afterwards.
  useEffect(() => {
    if (!auth.ready) return;
    const current = getRoute();
    if (!auth.userId && !PUBLIC_ROUTES.has(current.name)) {
      rememberDestination(current.path);
      navigate('/login', { replace: true });
      return;
    }
    // A recovery link lands on the home address with the token in the hash.
    if (auth.recovery && current.name !== 'reset') {
      navigate('/reset', { replace: true });
      return;
    }
    if (auth.userId && current.name === 'login') navigate('/', { replace: true });
  }, [auth.ready, auth.userId, auth.recovery, route.path]);

  // One workspace per signed-in person, opened as soon as there is a session
  // (it does not wait for the profile: both load side by side).
  useEffect(() => {
    if (auth.userId && !auth.recovery) void openWorkspace();
    else if (!auth.userId) closeWorkspace();
  }, [auth.userId, auth.recovery]);

  // A light touch on the profile, at most once every ten minutes.
  useEffect(() => {
    if (!auth.userId) return undefined;
    void touchLastSeen();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void touchLastSeen();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [auth.userId]);

  return (
    <BrandContext.Provider value={{ src: logoSrc, width: logoWidth, height: logoHeight }}>
      <div class={`wb${DEMO ? ' is-demo' : ''}`}>
        {DEMO ? (
          <p class="wb-demo-ribbon" role="note">
            Demo data<span class="wb-demo-more">. Everything here is invented and nothing is saved.</span>
          </p>
        ) : null}
        {auth.stalled ? <StalledNote /> : null}
        {renderRoute(auth.ready, Boolean(auth.userId), route.name, route.params)}
        <Toasts />
      </div>
    </BrandContext.Provider>
  );
}

function renderRoute(ready: boolean, signedIn: boolean, name: string, params: Record<string, string>) {
  if (name === 'join') return <Join token={params.token ?? ''} />;
  if (name === 'reset') return <Reset />;
  if (!ready) return <BootFrame />;
  if (!signedIn || name === 'login') return <Login />;

  // Account works from the profile alone, so it does not wait for the workspace.
  if (name === 'account') {
    return (
      <AppShell>
        <Account />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <WorkspaceGate>{screenFor(name, params)}</WorkspaceGate>
    </AppShell>
  );
}

function screenFor(name: string, params: Record<string, string>) {
  switch (name) {
    case 'home':
    case 'legacy':
      return <Home />;
    case 'tasks':
      return <Tasks />;
    case 'hours':
      return <Hours tab="week" />;
    case 'hours-team':
      return <Hours tab="team" />;
    case 'inbox':
      return (
        <Gate permission="inbox">
          <Inbox />
        </Gate>
      );
    case 'people':
      return <People />;
    case 'person':
      return <Person id={params.id ?? ''} />;
    case 'activity':
      return <Activity />;
    case 'settings':
      return (
        <Gate permission="settings">
          <Settings tab={params.tab === 'roles' ? 'roles' : 'projects'} />
        </Gate>
      );
    default:
      return (
        <div class="wb-page">
          <EmptyState
            title="There is nothing at that address"
            body="The link may be out of date, or it may have been typed in wrong."
            action={
              <LinkButton variant="secondary" href="#/">
                Go to Home
              </LinkButton>
            }
          />
        </div>
      );
  }
}

/**
 * A screen a role does not reach. The address still resolves (a bookmark or a
 * shared link must not look broken); it says why and who can change it.
 */
function Gate({ permission, children }: { permission: 'inbox' | 'settings'; children: ComponentChildren }) {
  const inbox = useCan('inquiries.view');
  const settings = useCanAny('projects.manage', 'roles.manage');
  const allowed = permission === 'inbox' ? inbox : settings;
  if (allowed) return <>{children}</>;
  return (
    <div class="wb-page">
      <EmptyState
        title={permission === 'inbox' ? 'The inbox is not part of your role' : 'Settings are not part of your role'}
        body="Ask an administrator for access if you need it."
        action={
          <LinkButton variant="secondary" href="#/">
            Go to Home
          </LinkButton>
        }
      />
    </div>
  );
}

/**
 * Everything between "signed in" and "the workspace is here": a skeleton,
 * then a "still trying" line, then either the screen or a plain account of
 * what went wrong with the one action that can help.
 */
function WorkspaceGate({ children }: { children: ComponentChildren }) {
  const workspace = useWorkspace();
  const [retrying, setRetrying] = useState(false);

  if (workspace.status === 'ready') return <>{children}</>;

  if (workspace.status === 'idle' || workspace.status === 'loading') {
    return (
      <div class="wb-page" aria-busy="true">
        {workspace.slow ? <SlowNotice what="Loading the workspace" /> : null}
        <div class="wb-gate-skeleton">
          <SkeletonLines count={2} />
          <SkeletonLines count={4} />
        </div>
      </div>
    );
  }

  const error = workspace.error ?? { message: 'That did not work.', permission: false, missingSchema: false, offline: false };

  if (workspace.status === 'missing') {
    return (
      <div class="wb-page">
        <SchemaNotice
          error={error}
          what="the workspace"
          action={<p class="wb-notice-body">The file to run is {MIGRATION_FILE}.</p>}
        />
      </div>
    );
  }

  return (
    <div class="wb-page">
      <SchemaNotice
        error={error}
        action={
          workspace.status === 'denied' ? null : (
            <Button
              variant="secondary"
              busy={retrying}
              data-wb-retry
              onClick={async () => {
                setRetrying(true);
                await retryWorkspace();
                setRetrying(false);
              }}
            >
              Try again
            </Button>
          )
        }
      />
    </div>
  );
}

/**
 * The first few seconds, before the SDK has said whether anybody is signed
 * in. It holds its tongue at first and then says what it is waiting for.
 */
function BootFrame() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div class="wb-boot-frame">
      {slow ? <SlowNotice what="Checking your sign-in" /> : null}
      <SkeletonLines count={3} />
    </div>
  );
}

/**
 * The session check never came back. Say what happened and offer the one
 * thing that reliably fixes it.
 */
function StalledNote() {
  return (
    <div class="wb-notice wb-notice-warn wb-boot-notice" role="status">
      <div>
        <p class="wb-notice-title">The server did not answer</p>
        <p class="wb-notice-body">
          Your sign-in could not be checked, so this page is showing the sign-in screen. Reloading usually sorts it
          out. If the Workbench is open in another tab, close that one first.
        </p>
        <div class="wb-notice-action">
          <Button variant="secondary" onClick={() => window.location.reload()} data-wb-retry>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
