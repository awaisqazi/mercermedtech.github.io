/**
 * The frame every signed-in screen sits in.
 *
 * The portal revolves around one project, so the rail is built around it:
 *
 *   [logo]
 *   Home project          its name, then Plan · Reports · Partners · Numbers
 *   Other projects        folded away; the open one shows its own sections;
 *                         archived ones behind a second fold; "All projects"
 *   Today · People · Account
 *   footer                you (sign out, theme) · Settings (new project,
 *                         import) · narrow the rail
 *
 * Phone: a top bar, and a bottom bar with the open project's sections plus
 * "More", which opens a sheet with everything else. The brand is the school
 * logo, never a text wordmark; the lockup gradient is only the 3px rule along
 * the top of this shell and of the sign-in frame.
 */
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { APP_NAME, APP_SUBTITLE } from '../lib/config';
import { displayName, isAdmin, signOut, useAuth } from '../lib/auth';
import { href, navigate, useRoute } from '../lib/router';
import { useTheme } from '../lib/theme';
import { GLOBAL_ROLE_LABEL, type Project } from '../lib/types';
import { toast } from '../lib/toasts';
import { openGlobalDialog, useGlobalDialog } from '../lib/ui';
import {
  TABS,
  TAB_LABEL,
  clearProjectList,
  loadProjectList,
  pickPrimary,
  useProjectList,
  type TabKey,
} from '../lib/projects';
import { NewProjectDialog } from '../screens/NewProjectDialog';
import { ImportDialog } from '../screens/ImportDialog';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Menu, type MenuItem } from './Menu';
import { Modal } from './Modal';
import {
  IconAccount,
  IconChart,
  IconChevron,
  IconChevronDown,
  IconDocument,
  IconMenu,
  IconMoon,
  IconPeople,
  IconPlan,
  IconPlus,
  IconProjects,
  IconSettings,
  IconSignOut,
  IconSun,
  IconToday,
  IconUpload,
} from './Icons';

const RAIL_KEY = 'wb.rail';
const OTHERS_KEY = 'wb.rail.others';

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
 * `mark` crops the lockup down to the badge on its left, for the narrow rail.
 * The badge occupies the first 550 of the 1830 source pixels, which is the
 * 11 / 12 box the stylesheet gives it.
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
    <span class="wb-logo-mark" style={{ height: `${height}px` }}>
      {image}
    </span>
  );
}

export const TAB_ICON: Record<TabKey, ComponentChildren> = {
  plan: <IconPlan />,
  reports: <IconDocument />,
  partners: <IconPeople />,
  numbers: <IconChart />,
  notes: <IconDocument />,
};

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

/** Sign out, then the sign-in screen. */
async function leave(): Promise<void> {
  const result = await signOut();
  if (!result.ok && result.error) toast.bad(result.error.message);
  else {
    clearProjectList();
    navigate('/login', { replace: true });
  }
}

export function AppShell({ children }: { children: ComponentChildren }) {
  const auth = useAuth();
  const route = useRoute();
  const theme = useTheme();
  const admin = isAdmin(auth);
  const list = useProjectList();
  const dialog = useGlobalDialog();
  const [collapsed, setCollapsed] = useState(() => remembered(RAIL_KEY, false));
  const [othersOpen, setOthersOpen] = useState(() => remembered(OTHERS_KEY, false));
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => remember(RAIL_KEY, collapsed), [collapsed]);
  useEffect(() => remember(OTHERS_KEY, othersOpen), [othersOpen]);

  // The project list drives the rail and the home redirect. Read it once per
  // signed-in person; the screens that change it ask for it again.
  useEffect(() => {
    if (auth.userId) void loadProjectList();
  }, [auth.userId]);

  // Moving anywhere closes the phone sheet.
  useEffect(() => setMoreOpen(false), [route.path]);

  const projects = list.projects;
  const primary = pickPrimary(projects);
  const currentSlug = route.name === 'project' ? route.params.slug ?? '' : '';
  const currentTab = route.params.tab ?? 'plan';
  const current = projects.find((project) => project.slug === currentSlug) ?? null;
  const others = projects.filter((project) => project.status === 'active' && project.id !== primary?.id);
  const archived = projects.filter((project) => project.status === 'archived');

  // The open project always shows, even when it lives in a folded group.
  useEffect(() => {
    if (current && current.id !== primary?.id) {
      if (current.status === 'archived') setArchivedOpen(true);
      else setOthersOpen(true);
    }
  }, [current?.id, primary?.id]);

  const toggleTheme: MenuItem = {
    key: 'theme',
    label: theme.dark ? 'Switch to the light theme' : 'Switch to the dark theme',
    icon: theme.dark ? <IconSun size={16} /> : <IconMoon size={16} />,
    onSelect: theme.toggle,
  };

  const accountMenu: MenuItem[] = [
    {
      key: 'account',
      label: 'Account',
      icon: <IconAccount size={16} />,
      onSelect: () => navigate('/account'),
    },
    toggleTheme,
    {
      key: 'signout',
      label: 'Sign out',
      icon: <IconSignOut size={16} />,
      divider: true,
      onSelect: () => void leave(),
    },
  ];

  /** New project and Import: used rarely, so they live here. */
  const settingsMenu: MenuItem[] = [
    {
      key: 'all',
      label: 'All projects',
      icon: <IconProjects size={16} />,
      onSelect: () => navigate('/projects'),
    },
    {
      key: 'new',
      label: 'New project',
      icon: <IconPlus size={16} />,
      disabled: !admin,
      hint: admin ? undefined : 'Administrators only',
      divider: true,
      onSelect: () => openGlobalDialog('new-project'),
    },
    {
      key: 'import',
      label: 'Import a project from a file',
      icon: <IconUpload size={16} />,
      disabled: !admin,
      hint: admin ? undefined : 'Administrators only',
      onSelect: () => openGlobalDialog('import'),
    },
    { ...toggleTheme, divider: true },
  ];

  const person = (
    <span class="wb-account-text">
      <span class="wb-account-name">{displayName(auth)}</span>
      <span class="wb-account-role">
        {auth.profile ? GLOBAL_ROLE_LABEL[auth.profile.role] : 'Signed in'}
      </span>
    </span>
  );

  const railLink = (key: string, label: string, path: string, icon: ComponentChildren, active: boolean) => (
    <li key={key}>
      <a
        class={`wb-rail-link${active ? ' is-active' : ''}`}
        href={href(path)}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
      >
        <span class="wb-rail-icon">{icon}</span>
        <span class="wb-rail-label">{label}</span>
      </a>
    </li>
  );

  /** A project's own sections, under its name. */
  const sections = (project: Project) => (
    <ul class="wb-rail-sub" aria-label={`${project.name} sections`}>
      {TABS[project.kind].map((tab) =>
        railLink(
          `${project.id}-${tab}`,
          TAB_LABEL[tab],
          `/p/${project.slug}/${tab}`,
          TAB_ICON[tab],
          project.slug === currentSlug && currentTab === tab
        )
      )}
    </ul>
  );

  const projectLink = (project: Project) => (
    <li key={project.id}>
      <a
        class={`wb-rail-project-link${project.slug === currentSlug ? ' is-current' : ''}`}
        href={href(`/p/${project.slug}/plan`)}
        data-track={project.track}
        title={collapsed ? project.name : undefined}
      >
        <span class="wb-rail-swatch" aria-hidden="true" />
        <span class="wb-rail-label">{project.name}</span>
      </a>
      {project.slug === currentSlug && !collapsed ? sections(project) : null}
    </li>
  );

  /* The bottom bar follows the open project, or home when none is open. */
  const barProject = current ?? primary;
  const barTabs = barProject ? TABS[barProject.kind] : [];

  return (
    <div class={`wb-shell${collapsed ? ' is-collapsed' : ''}`}>
      <div class="wb-topline" aria-hidden="true" />

      {/* Phone: top bar */}
      <header class="wb-topbar">
        <a class="wb-topbar-brand" href={href('/')} title={APP_SUBTITLE}>
          <Logo height={26} />
        </a>
        {barProject ? <span class="wb-topbar-project">{barProject.name}</span> : null}
        <Menu
          align="right"
          items={accountMenu}
          trigger={(props) => (
            <button type="button" class="wb-account-button" aria-label="Your account" {...props}>
              <Avatar id={auth.userId} name={auth.profile?.full_name} email={auth.email} size={32} />
            </button>
          )}
        />
      </header>

      {/* Desktop: left rail */}
      <nav class="wb-rail" aria-label="Main">
        <a class="wb-rail-brand" href={href('/')} title={APP_SUBTITLE}>
          {collapsed ? (
            <Logo height={30} mark />
          ) : (
            <>
              <Logo height={32} />
              <span class="wb-rail-brand-caption">Workbench</span>
            </>
          )}
        </a>

        <div class="wb-rail-scroll">
          {primary ? (
            <section class="wb-rail-home" data-track={primary.track} aria-label="Home project">
              <a
                class={`wb-rail-home-name${primary.slug === currentSlug ? ' is-current' : ''}`}
                href={href(`/p/${primary.slug}/plan`)}
                title={collapsed ? primary.name : undefined}
              >
                <span class="wb-rail-swatch" aria-hidden="true" />
                <span class="wb-rail-label">{primary.name}</span>
              </a>
              {sections(primary)}
            </section>
          ) : null}

          {others.length || archived.length ? (
            <section class="wb-rail-group">
              <button
                type="button"
                class="wb-rail-group-head"
                aria-expanded={othersOpen}
                onClick={() => setOthersOpen((open) => !open)}
                title={collapsed ? 'Other projects' : undefined}
              >
                <span class="wb-rail-icon">
                  <IconProjects />
                </span>
                <span class="wb-rail-label">Other projects</span>
                <span class="wb-rail-count wb-mono">{others.length}</span>
                <IconChevronDown size={14} class={`wb-rail-caret${othersOpen ? ' wb-flip-y' : ''}`} />
              </button>
              {othersOpen && !collapsed ? (
                <ul class="wb-rail-projects">
                  {others.map(projectLink)}
                  {archived.length ? (
                    <li>
                      <button
                        type="button"
                        class="wb-rail-archived"
                        aria-expanded={archivedOpen}
                        onClick={() => setArchivedOpen((open) => !open)}
                      >
                        Archived <span class="wb-mono">{archived.length}</span>
                        <IconChevronDown size={13} class={archivedOpen ? 'wb-flip-y' : ''} />
                      </button>
                      {archivedOpen ? <ul class="wb-rail-projects">{archived.map(projectLink)}</ul> : null}
                    </li>
                  ) : null}
                  <li>
                    <a class="wb-rail-all" href={href('/projects')}>
                      All projects
                    </a>
                  </li>
                </ul>
              ) : null}
            </section>
          ) : null}

          <ul class="wb-rail-nav">
            {railLink('today', 'Today', '/today', <IconToday />, route.name === 'today')}
            {admin ? railLink('people', 'People', '/people', <IconPeople />, route.name === 'people') : null}
            {railLink('account', 'Account', '/account', <IconAccount />, route.name === 'account')}
            {!others.length && !archived.length
              ? railLink('projects', 'All projects', '/projects', <IconProjects />, route.name === 'projects')
              : null}
          </ul>
        </div>

        <div class="wb-rail-foot">
          <Menu
            align="left"
            placement="up"
            items={accountMenu}
            trigger={(props) => (
              <button type="button" class="wb-rail-account" {...props}>
                <Avatar id={auth.userId} name={auth.profile?.full_name} email={auth.email} size={28} />
                {person}
              </button>
            )}
          />
          <div class="wb-rail-tools">
            <Menu
              align="left"
              placement="up"
              label="Settings"
              items={settingsMenu}
              trigger={(props) => (
                <button type="button" class="wb-rail-tool" aria-label="Settings" title="Settings" {...props}>
                  <IconSettings />
                </button>
              )}
            />
            <button
              type="button"
              class="wb-rail-tool"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Widen the sidebar' : 'Narrow the sidebar'}
              title={collapsed ? 'Widen the sidebar' : 'Narrow the sidebar'}
            >
              <IconChevron size={16} class={collapsed ? '' : 'wb-flip'} />
            </button>
          </div>
        </div>
      </nav>

      <main class="wb-main" id="wb-main">
        <div class="wb-main-inner">{children}</div>
      </main>

      {/* Phone: bottom bar */}
      <nav class="wb-bottombar" aria-label="Main">
        {barProject
          ? barTabs.map((tab) => {
              const active = route.name === 'project' && barProject.slug === currentSlug && currentTab === tab;
              return (
                <a
                  key={tab}
                  class={`wb-bottom-link${active ? ' is-active' : ''}`}
                  href={href(`/p/${barProject.slug}/${tab}`)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span class="wb-bottom-icon">{TAB_ICON[tab]}</span>
                  <span class="wb-bottom-label">{TAB_LABEL[tab]}</span>
                </a>
              );
            })
          : [
              <a
                key="today"
                class={`wb-bottom-link${route.name === 'today' ? ' is-active' : ''}`}
                href={href('/today')}
              >
                <span class="wb-bottom-icon">
                  <IconToday />
                </span>
                <span class="wb-bottom-label">Today</span>
              </a>,
            ]}
        <button
          type="button"
          class={`wb-bottom-link${moreOpen || (route.name !== 'project' && route.name !== 'today') ? ' is-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span class="wb-bottom-icon">
            <IconMenu />
          </span>
          <span class="wb-bottom-label">More</span>
        </button>
      </nav>

      <Modal open={moreOpen} title="More" onClose={() => setMoreOpen(false)} size="sm" class="wb-more" initialFocus="panel">
        <ul class="wb-more-list">
          <li>
            <a class="wb-more-link" href={href('/today')}>
              <IconToday /> Today
            </a>
          </li>
          {others.map((project) => (
            <li key={project.id}>
              <a class="wb-more-link" href={href(`/p/${project.slug}/plan`)} data-track={project.track}>
                <span class="wb-rail-swatch" aria-hidden="true" /> {project.name}
              </a>
            </li>
          ))}
          {primary && current && current.id !== primary.id ? (
            <li>
              <a class="wb-more-link" href={href(`/p/${primary.slug}/plan`)} data-track={primary.track}>
                <span class="wb-rail-swatch" aria-hidden="true" /> {primary.name}
              </a>
            </li>
          ) : null}
          <li>
            <a class="wb-more-link" href={href('/projects')}>
              <IconProjects /> All projects
            </a>
          </li>
          {admin ? (
            <li>
              <a class="wb-more-link" href={href('/people')}>
                <IconPeople /> People
              </a>
            </li>
          ) : null}
          <li>
            <a class="wb-more-link" href={href('/account')}>
              <IconAccount /> Account
            </a>
          </li>
        </ul>
        <div class="wb-more-tools">
          {admin ? (
            <>
              <Button variant="secondary" icon={<IconPlus size={16} />} onClick={() => openGlobalDialog('new-project')}>
                New project
              </Button>
              <Button variant="secondary" icon={<IconUpload size={16} />} onClick={() => openGlobalDialog('import')}>
                Import a project
              </Button>
            </>
          ) : null}
          <Button variant="quiet" icon={theme.dark ? <IconSun size={16} /> : <IconMoon size={16} />} onClick={theme.toggle}>
            {theme.dark ? 'Light theme' : 'Dark theme'}
          </Button>
          <Button variant="quiet" icon={<IconSignOut size={16} />} onClick={() => void leave()}>
            Sign out
          </Button>
        </div>
      </Modal>

      <NewProjectDialog
        open={dialog === 'new-project'}
        onClose={() => {
          openGlobalDialog(null);
          void loadProjectList();
        }}
      />
      <ImportDialog
        open={dialog === 'import'}
        onClose={() => {
          openGlobalDialog(null);
          void loadProjectList();
        }}
      />
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
          <Logo height={56} />
          <p class="wb-auth-sub">Workbench · staff workspace</p>
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
