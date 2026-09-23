/**
 * The root of the Workbench.
 *
 * It does four things: start the auth listener, decide whether the current
 * address needs a signed-in user, render the matching screen, and keep the
 * toasts on screen. Everything else lives in the screens.
 */
import { useEffect, useState } from 'preact/hooks';
import { startAuth, touchLastSeen, useAuth } from './lib/auth';
import { getRoute, navigate, rememberDestination, useRoute } from './lib/router';
import { applyTheme } from './lib/theme';
import { AppShell, BrandContext } from './components/AppShell';
import { Toasts } from './components/Toasts';
import { SkeletonLines } from './components/Skeleton';
import { SlowNotice } from './components/SchemaNotice';
import { SLOW_LOAD_MS } from './lib/config';
import { Button } from './components/Button';
import { EmptyState } from './components/EmptyState';
import { LinkButton } from './components/Button';
import { Login } from './screens/Login';
import { Join } from './screens/Join';
import { Reset } from './screens/Reset';
import { Home } from './screens/Home';
import { HomeRedirect } from './screens/HomeRedirect';
import { DEMO } from './demo/mode';
import { Projects } from './screens/Projects';
import { Project } from './screens/Project';
import { People } from './screens/People';
import { Account } from './screens/Account';

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

export default function AdminApp({
  logoSrc = '',
  logoWidth = 366,
  logoHeight = 120,
}: AdminAppProps) {
  const auth = useAuth();
  const route = useRoute();

  // The boot splash in index.astro is ours to clear.
  useEffect(() => {
    document.getElementById('wb-boot')?.remove();
    applyTheme();
  }, []);

  // A new screen or tab starts at the top; a query-only change (filters, an
  // opened task) keeps the reader where they are.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

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
    if (auth.userId && current.name === 'login') {
      navigate('/', { replace: true });
    }
  }, [auth.ready, auth.userId, auth.recovery, route.path]);

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

function renderRoute(
  ready: boolean,
  signedIn: boolean,
  name: string,
  params: Record<string, string>
) {
  if (name === 'join') return <Join token={params.token ?? ''} />;
  if (name === 'reset') return <Reset />;

  if (!ready) return <BootFrame />;

  if (!signedIn || name === 'login') return <Login />;

  return (
    <AppShell>
      {name === 'projects' ? (
        <Projects />
      ) : name === 'project' ? (
        <Project slug={params.slug ?? ''} tab={params.tab} />
      ) : name === 'people' ? (
        <People />
      ) : name === 'account' ? (
        <Account />
      ) : name === 'today' ? (
        <Home />
      ) : name === 'home' ? (
        <HomeRedirect />
      ) : (
        <div class="wb-page">
          <EmptyState
            title="There is nothing at that address"
            body="The link may be out of date, or it may have been typed in wrong."
            action={
              <LinkButton variant="secondary" href="#/">
                Go to the home screen
              </LinkButton>
            }
          />
        </div>
      )}
    </AppShell>
  );
}

/**
 * The first few seconds of the app, before the SDK has said whether anybody is
 * signed in. It holds its tongue at first and then says what it is waiting
 * for, because a skeleton that has been there for five seconds has stopped
 * meaning "nearly there".
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
 * The session check never came back. Rather than leave the reader guessing at
 * a sign-in screen they did not ask for, say what happened and offer the one
 * thing that reliably fixes it.
 */
function StalledNote() {
  return (
    <div class="wb-notice wb-notice-warn wb-boot-notice" role="status">
      <div>
        <p class="wb-notice-title">The server did not answer</p>
        <p class="wb-notice-body">
          Your sign-in could not be checked, so this page is showing you the sign-in screen.
          Reloading usually sorts it out; if the Workbench is open in another tab, close that one
          first.
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
