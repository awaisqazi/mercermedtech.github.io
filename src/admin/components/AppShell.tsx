/**
 * The frame every signed-in screen sits in.
 *
 * Desktop: a left rail, 232px, collapsible to icons.
 *
 *   [logo]
 *   Home · Tasks · Hours · Inbox · People · Settings
 *                     (Inbox only with inquiries.view, with the count of new
 *                     ones; Settings only with projects.manage or roles.manage)
 *   who is here now   presence, from the workspace channel
 *   you               avatar, name, role · theme · sign out · narrow the rail
 *
 * Phone: a top bar (logo mark, the page title, one action the screen hands
 * over through PhoneAction) and a bottom bar (Home · Tasks · Hours · More);
 * More opens a sheet with everything else.
 *
 * The split hairline (Med teal, then Tech indigo, hard stop) along the very
 * top of the shell and the logo are the whole brand presence.
 */
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { APP_NAME } from '../lib/config';
import { displayName, roleName, signOut, useAuth } from '../lib/auth';
import { href, navigate, useRoute, type RouteName } from '../lib/router';
import { useTheme } from '../lib/theme';
import { toast } from '../lib/toasts';
import { useShellChrome } from '../lib/ui';
import { useCan, useCanAny, useMyRole } from '../lib/perms';
import { closeWorkspace, setPresence, useNewInquiryCount, usePresence, useWorkspace } from '../lib/workspace';
import { Avatar, AvatarStack } from './Avatar';
import { Button } from './Button';
import { Modal } from './Modal';
import { ConnectionBanner } from './SchemaNotice';
import {
  IconAccount,
  IconActivity,
  IconBell,
  IconChevron,
  IconClock,
  IconHome,
  IconMenu,
  IconMoon,
  IconPeople,
  IconSettings,
  IconSignOut,
  IconSun,
  IconTasks,
} from './Icons';

const RAIL_KEY = 'wb.rail';

/**
 * The school logo, resolved by the Astro page and handed to the island as a
 * prop: the bundle is `client:only`, so importing the PNG in here would give
 * an unprocessed path. `src/pages/admin/index.astro` is the one place that
 * knows the file.
 */
export interface Brand {
  src: string;
  width: number;
  height: number;
}

export const BrandContext = createContext<Brand>({ src: '', width: 366, height: 120 });

/**
 * `mark` crops the lockup down to the badge on its left, for the narrow rail
 * and the phone top bar. The badge is the first 550 of the 1830 source
 * pixels, which is the box the stylesheet gives `.wb-logo-mark`.
 */
export function Logo({ height, mark = false }: { height: number; mark?: boolean }) {
  const brand = useContext(BrandContext);
  if (!brand.src) return null;
  const width = Math.round((brand.width / brand.height) * height);
  const image = (
    <img
      class="wb-logo"
      src={brand.src}
      alt="Mercer Med Tech"
      width={width}
      height={height}
      style={{ height: `${height}px` }}
      decoding="async"
    />
  );
  if (!mark) return image;
  return (
    <span class="wb-logo-mark" style={{ height: `${height}px`, width: `${Math.round(width * (550 / 1830))}px` }}>
      {image}
    </span>
  );
}

function remembered(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

function remember(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* nothing to remember, no harm done */
  }
}

/** Sign out, close the workspace, then the sign-in screen. */
export async function leave(): Promise<void> {
  const result = await signOut();
  if (!result.ok && result.error) {
    toast.bad(result.error.message);
    return;
  }
  closeWorkspace();
  navigate('/login', { replace: true });
}

interface Place {
  key: string;
  label: string;
  path: string;
  icon: ComponentChildren;
  /** Route names that light this place up. */
  routes: RouteName[];
  count?: number;
}

export function AppShell({ children }: { children: ComponentChildren }) {
  const auth = useAuth();
  const route = useRoute();
  const theme = useTheme();
  const chrome = useShellChrome();
  const workspace = useWorkspace();
  const role = useMyRole();
  const presence = usePresence();
  const newInquiries = useNewInquiryCount();
  const showInbox = useCan('inquiries.view');
  const showSettings = useCanAny('projects.manage', 'roles.manage');
  const [collapsed, setCollapsed] = useState(() => remembered(RAIL_KEY, false));
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => remember(RAIL_KEY, collapsed), [collapsed]);

  // Moving anywhere closes the phone sheet, and tells the others where we are.
  useEffect(() => {
    setMoreOpen(false);
    setPresence({ where: route.name });
  }, [route.path]);

  const home: Place = { key: 'home', label: 'Home', path: '/', icon: <IconHome />, routes: ['home'] };
  const tasks: Place = { key: 'tasks', label: 'Tasks', path: '/tasks', icon: <IconTasks />, routes: ['tasks'] };
  const hours: Place = { key: 'hours', label: 'Hours', path: '/hours', icon: <IconClock />, routes: ['hours', 'hours-team'] };
  const inbox: Place = {
    key: 'inbox',
    label: 'Inbox',
    path: '/inbox',
    icon: <IconBell />,
    routes: ['inbox'],
    count: newInquiries,
  };
  const people: Place = { key: 'people', label: 'People', path: '/people', icon: <IconPeople />, routes: ['people', 'person'] };
  const settings: Place = { key: 'settings', label: 'Settings', path: '/settings', icon: <IconSettings />, routes: ['settings'] };
  const activity: Place = { key: 'activity', label: 'Activity', path: '/activity', icon: <IconActivity />, routes: ['activity'] };
  const account: Place = { key: 'account', label: 'Account', path: '/account', icon: <IconAccount />, routes: ['account'] };

  const rail: Place[] = [home, tasks, hours, ...(showInbox ? [inbox] : []), people, ...(showSettings ? [settings] : [])];
  const bottom: Place[] = [home, tasks, hours];
  const more: Place[] = [...(showInbox ? [inbox] : []), people, activity, ...(showSettings ? [settings] : []), account];

  const isActive = (place: Place) => place.routes.includes(route.name);
  const moreActive = more.some(isActive);
  const others = presence.filter((peer) => peer.user_id !== auth.userId);
  const name = displayName(auth);
  const roleWord = role?.name ?? roleName(auth);

  const countLabel = (place: Place) =>
    place.count ? (
      <span class="wb-nav-count">
        <span class="wb-sr">, </span>
        {place.count}
        <span class="wb-sr"> new</span>
      </span>
    ) : null;

  return (
    <div class={`wb-shell${collapsed ? ' is-collapsed' : ''}`}>
      <div class="wb-split" aria-hidden="true" />
      <a class="wb-skip" href="#wb-main">
        Skip to the page
      </a>

      {/* Phone: top bar */}
      <header class="wb-topbar">
        <a class="wb-topbar-brand" href={href('/')} aria-label={`${APP_NAME}, home`}>
          <Logo height={28} mark />
        </a>
        <p class="wb-topbar-title">{chrome.title}</p>
        <div class="wb-topbar-action">
          {chrome.action ? (
            <Button variant="primary" size="sm" icon={chrome.action.icon} onClick={chrome.action.onClick}>
              {chrome.action.label}
            </Button>
          ) : null}
        </div>
      </header>

      {/* Desktop: left rail */}
      <nav class="wb-rail" aria-label="Main">
        <a class="wb-rail-brand" href={href('/')} aria-label={`${APP_NAME}, home`}>
          {collapsed ? <Logo height={30} mark /> : <Logo height={34} />}
        </a>

        <ul class="wb-rail-nav">
          {rail.map((place) => {
            const active = isActive(place);
            return (
              <li key={place.key}>
                <a
                  class={`wb-rail-link${active ? ' is-active' : ''}`}
                  href={href(place.path)}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? place.label : undefined}
                >
                  <span class="wb-rail-icon">{place.icon}</span>
                  <span class="wb-rail-label">{place.label}</span>
                  {countLabel(place)}
                </a>
              </li>
            );
          })}
        </ul>

        <div class="wb-rail-foot">
          {others.length && !collapsed ? (
            <div class="wb-rail-here">
              <span class="wb-rail-here-label">Here now</span>
              <AvatarStack
                label="Here now"
                size={24}
                max={6}
                activeIds={others.map((peer) => peer.user_id)}
                people={others.map((peer) => ({ id: peer.user_id, name: peer.name }))}
              />
            </div>
          ) : null}

          <a
            class={`wb-rail-person${route.name === 'account' ? ' is-active' : ''}`}
            href={href('/account')}
            aria-current={route.name === 'account' ? 'page' : undefined}
            title={collapsed ? `${name}, account` : undefined}
          >
            <Avatar id={auth.userId} name={auth.profile?.full_name} email={auth.email} size={30} />
            <span class="wb-rail-person-text">
              <span class="wb-rail-person-name">{name}</span>
              {roleWord ? <span class="wb-rail-person-role">{roleWord}</span> : null}
            </span>
          </a>

          <div class="wb-rail-tools">
            <button
              type="button"
              class="wb-rail-tool"
              onClick={theme.toggle}
              aria-label={theme.dark ? 'Use the light theme' : 'Use the dark theme'}
              title={theme.dark ? 'Light theme' : 'Dark theme'}
            >
              {theme.dark ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>
            <button
              type="button"
              class="wb-rail-tool"
              onClick={() => void leave()}
              aria-label="Sign out"
              title="Sign out"
            >
              <IconSignOut size={17} />
            </button>
            <button
              type="button"
              class="wb-rail-tool wb-rail-collapse"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Widen the sidebar' : 'Narrow the sidebar'}
              aria-pressed={collapsed}
              title={collapsed ? 'Widen the sidebar' : 'Narrow the sidebar'}
            >
              <IconChevron size={16} class={collapsed ? '' : 'wb-flip'} />
            </button>
          </div>
        </div>
      </nav>

      <main class="wb-main" id="wb-main" tabIndex={-1}>
        {workspace.connection === 'reconnecting' || workspace.connection === 'offline' ? (
          <ConnectionBanner state={workspace.connection} />
        ) : null}
        <div class="wb-main-inner">{children}</div>
      </main>

      {/* Phone: bottom bar */}
      <nav class="wb-bottombar" aria-label="Main">
        {bottom.map((place) => {
          const active = isActive(place);
          return (
            <a
              key={place.key}
              class={`wb-bottom-link${active ? ' is-active' : ''}`}
              href={href(place.path)}
              aria-current={active ? 'page' : undefined}
            >
              <span class="wb-bottom-icon">{place.icon}</span>
              <span class="wb-bottom-label">{place.label}</span>
            </a>
          );
        })}
        <button
          type="button"
          class={`wb-bottom-link${moreOpen || moreActive ? ' is-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span class="wb-bottom-icon">
            <IconMenu />
            {showInbox && newInquiries ? <span class="wb-bottom-dot" aria-hidden="true" /> : null}
          </span>
          <span class="wb-bottom-label">More</span>
        </button>
      </nav>

      <Modal open={moreOpen} title="More" onClose={() => setMoreOpen(false)} size="sm" class="wb-more" initialFocus="panel">
        <div class="wb-more-person">
          <Avatar id={auth.userId} name={auth.profile?.full_name} email={auth.email} size={36} />
          <span class="wb-rail-person-text">
            <span class="wb-rail-person-name">{name}</span>
            {roleWord ? <span class="wb-rail-person-role">{roleWord}</span> : null}
          </span>
        </div>
        <ul class="wb-more-list">
          {more.map((place) => (
            <li key={place.key}>
              <a
                class={`wb-more-link${isActive(place) ? ' is-active' : ''}`}
                href={href(place.path)}
                aria-current={isActive(place) ? 'page' : undefined}
              >
                <span class="wb-rail-icon">{place.icon}</span>
                <span class="wb-rail-label">{place.label}</span>
                {countLabel(place)}
              </a>
            </li>
          ))}
        </ul>
        <div class="wb-more-tools">
          <Button variant="secondary" icon={theme.dark ? <IconSun size={16} /> : <IconMoon size={16} />} onClick={theme.toggle}>
            {theme.dark ? 'Use the light theme' : 'Use the dark theme'}
          </Button>
          <Button variant="quiet" icon={<IconSignOut size={16} />} onClick={() => void leave()}>
            Sign out
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/**
 * The frame the sign-in, join and reset screens sit in: paper, the split
 * hairline along the top, and one white panel inside the bracket.
 */
export function AuthShell({
  title,
  subtitle,
  notice,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  /** A message above the form, e.g. why the person was signed out. */
  notice?: ComponentChildren;
  children: ComponentChildren;
  footer?: ComponentChildren;
}) {
  const theme = useTheme();
  return (
    <div class="wb-auth">
      <div class="wb-split" aria-hidden="true" />
      <main class="wb-auth-main">
        <div class="wb-auth-panel wb-bracket">
          <div class="wb-auth-brand">
            <Logo height={52} />
            <p class="wb-auth-sub">{APP_NAME}</p>
          </div>
          <h1 class="wb-auth-title">{title}</h1>
          {subtitle ? <p class="wb-auth-lead">{subtitle}</p> : null}
          {notice}
          {children}
        </div>
        {footer ? <div class="wb-auth-footer">{footer}</div> : null}
      </main>
      <Button
        class="wb-auth-theme"
        variant="quiet"
        size="sm"
        onClick={theme.toggle}
        icon={theme.dark ? <IconSun size={16} /> : <IconMoon size={16} />}
      >
        {theme.dark ? 'Light theme' : 'Dark theme'}
      </Button>
    </div>
  );
}
