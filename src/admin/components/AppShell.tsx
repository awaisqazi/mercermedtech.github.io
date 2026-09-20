/**
 * The frame every signed-in screen sits in.
 *
 * Desktop: a left rail that collapses to icons. Phone: a top bar and a bottom
 * tab bar with safe-area padding. The lockup gradient appears exactly twice in
 * the whole portal — on the sign-in wordmark and as the 3px rule along the top
 * of this shell.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { APP_NAME, APP_SUBTITLE } from '../lib/config';
import { displayName, isAdmin, signOut, useAuth } from '../lib/auth';
import { href, navigate, useRoute } from '../lib/router';
import { useTheme } from '../lib/theme';
import { GLOBAL_ROLE_LABEL } from '../lib/types';
import { toast } from '../lib/toasts';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Menu } from './Menu';
import {
  IconAccount,
  IconChevron,
  IconHome,
  IconMoon,
  IconPeople,
  IconProjects,
  IconSignOut,
  IconSun,
} from './Icons';

const RAIL_KEY = 'wb.rail';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: ComponentChildren;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { key: 'home', label: 'Home', path: '/', icon: <IconHome /> },
  { key: 'projects', label: 'Projects', path: '/projects', icon: <IconProjects /> },
  { key: 'people', label: 'People', path: '/people', icon: <IconPeople />, adminOnly: true },
  { key: 'account', label: 'Account', path: '/account', icon: <IconAccount /> },
];

export function Wordmark({ gradient = false }: { gradient?: boolean }) {
  return (
    <span class={`wb-wordmark${gradient ? ' is-gradient' : ''}`}>
      <span class="wb-wordmark-mmt">MMT</span>
      <span class="wb-wordmark-word">Workbench</span>
    </span>
  );
}

export function AppShell({ children }: { children: ComponentChildren }) {
  const auth = useAuth();
  const route = useRoute();
  const theme = useTheme();
  const admin = isAdmin(auth);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(RAIL_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(RAIL_KEY, collapsed ? '1' : '0');
    } catch {
      /* nothing to remember, no harm done */
    }
  }, [collapsed]);

  const items = NAV.filter((item) => !item.adminOnly || admin);
  const activeKey =
    route.name === 'project' ? 'projects' : items.find((item) => item.key === route.name)?.key ?? 'home';

  const accountMenu = [
    {
      key: 'account',
      label: 'Account',
      icon: <IconAccount size={16} />,
      onSelect: () => navigate('/account'),
    },
    {
      key: 'signout',
      label: 'Sign out',
      icon: <IconSignOut size={16} />,
      onSelect: async () => {
        const result = await signOut();
        if (!result.ok && result.error) toast.bad(result.error.message);
        else navigate('/login', { replace: true });
      },
    },
  ];

  const person = (
    <span class="wb-account-text">
      <span class="wb-account-name">{displayName(auth)}</span>
      <span class="wb-account-role">
        {auth.profile ? GLOBAL_ROLE_LABEL[auth.profile.role] : 'Signed in'}
      </span>
    </span>
  );

  return (
    <div class={`wb-shell${collapsed ? ' is-collapsed' : ''}`}>
      <div class="wb-topline" aria-hidden="true" />

      {/* Phone: top bar */}
      <header class="wb-topbar">
        <a class="wb-topbar-brand" href={href('/')}>
          <Wordmark />
        </a>
        <Menu
          align="right"
          items={accountMenu}
          trigger={(props) => (
            <button type="button" class="wb-account-button" {...props}>
              <Avatar id={auth.userId} name={auth.profile?.full_name} email={auth.email} size={30} />
            </button>
          )}
        />
      </header>

      {/* Desktop: left rail */}
      <nav class="wb-rail" aria-label="Main">
        <a class="wb-rail-brand" href={href('/')} title={APP_SUBTITLE}>
          <Wordmark />
        </a>

        <ul class="wb-rail-nav">
          {items.map((item) => (
            <li key={item.key}>
              <a
                class={`wb-rail-link${item.key === activeKey ? ' is-active' : ''}`}
                href={href(item.path)}
                aria-current={item.key === activeKey ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span class="wb-rail-icon">{item.icon}</span>
                <span class="wb-rail-label">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <div class="wb-rail-foot">
          <button
            type="button"
            class="wb-rail-link wb-rail-toggle"
            onClick={theme.toggle}
            aria-pressed={theme.dark}
            title={theme.dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
          >
            <span class="wb-rail-icon">{theme.dark ? <IconSun /> : <IconMoon />}</span>
            <span class="wb-rail-label">{theme.dark ? 'Light theme' : 'Dark theme'}</span>
          </button>

          <Menu
            align="right"
            items={accountMenu}
            trigger={(props) => (
              <button type="button" class="wb-rail-account" {...props}>
                <Avatar id={auth.userId} name={auth.profile?.full_name} email={auth.email} size={28} />
                {person}
              </button>
            )}
          />

          <button
            type="button"
            class="wb-rail-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Widen the sidebar' : 'Narrow the sidebar'}
            title={collapsed ? 'Widen the sidebar' : 'Narrow the sidebar'}
          >
            <IconChevron size={16} class={collapsed ? '' : 'wb-flip'} />
          </button>
        </div>
      </nav>

      <main class="wb-main" id="wb-main">
        <div class="wb-main-inner">{children}</div>
      </main>

      {/* Phone: bottom tabs */}
      <nav class="wb-bottombar" aria-label="Main">
        {items.map((item) => (
          <a
            key={item.key}
            class={`wb-bottom-link${item.key === activeKey ? ' is-active' : ''}`}
            href={href(item.path)}
            aria-current={item.key === activeKey ? 'page' : undefined}
          >
            <span class="wb-bottom-icon">{item.icon}</span>
            <span class="wb-bottom-label">{item.label}</span>
          </a>
        ))}
        <button
          type="button"
          class="wb-bottom-link"
          onClick={theme.toggle}
          aria-label={theme.dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
        >
          <span class="wb-bottom-icon">{theme.dark ? <IconSun /> : <IconMoon />}</span>
          <span class="wb-bottom-label">Theme</span>
        </button>
      </nav>
    </div>
  );
}

/** The centred frame the sign-in, join and reset screens sit in. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ComponentChildren;
  footer?: ComponentChildren;
}) {
  const theme = useTheme();
  return (
    <div class="wb-auth">
      <div class="wb-auth-topline" aria-hidden="true" />
      <div class="wb-auth-panel">
        <div class="wb-auth-brand">
          <Wordmark gradient />
          <p class="wb-auth-sub">{APP_SUBTITLE}</p>
        </div>
        <h1 class="wb-auth-title">{title}</h1>
        {subtitle ? <p class="wb-auth-lead">{subtitle}</p> : null}
        {children}
      </div>
      {footer ? <div class="wb-auth-footer">{footer}</div> : null}
      <Button
        class="wb-auth-theme"
        variant="quiet"
        size="sm"
        onClick={theme.toggle}
        icon={theme.dark ? <IconSun size={16} /> : <IconMoon size={16} />}
      >
        {theme.dark ? 'Light' : 'Dark'}
      </Button>
      <p class="wb-auth-name">{APP_NAME}</p>
    </div>
  );
}
