/**
 * The root of the Workbench.
 *
 * It does four things: start the auth listener, decide whether the current
 * address needs a signed-in user, render the matching screen, and keep the
 * toasts on screen. Everything else lives in the screens.
 */
import { useEffect } from 'preact/hooks';
import { startAuth, touchLastSeen, useAuth } from './lib/auth';
import { getRoute, navigate, rememberDestination, useRoute } from './lib/router';
import { applyTheme } from './lib/theme';
import { AppShell } from './components/AppShell';
import { Toasts } from './components/Toasts';
import { SkeletonLines } from './components/Skeleton';
import { EmptyState } from './components/EmptyState';
import { LinkButton } from './components/Button';
import { Login } from './screens/Login';
import { Join } from './screens/Join';
import { Reset } from './screens/Reset';
import { Home } from './screens/Home';
import { Projects } from './screens/Projects';
import { Project } from './screens/Project';
import { People } from './screens/People';
import { Account } from './screens/Account';

startAuth();

/** Addresses that work without an account. */
const PUBLIC_ROUTES = new Set(['login', 'join', 'reset']);

export default function AdminApp() {
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
    <div class="wb">
      {renderRoute(auth.ready, Boolean(auth.userId), route.name, route.params)}
      <Toasts />
    </div>
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

  if (!ready) {
    return (
      <div class="wb-boot-frame">
        <SkeletonLines count={3} />
      </div>
    );
  }

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
      ) : name === 'home' ? (
        <Home />
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
