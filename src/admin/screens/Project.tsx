/**
 * The frame around a project: one quiet header line, the section tabs, and
 * whichever module matches the project's kind.
 *
 * The header holds only what is needed every day: the name, a status pill,
 * who is here, "About", the activity bell and a menu. The contract number,
 * the funding sentence, the long description and the rulebook live in the
 * About panel, one click away. Every detail view opens on top of the section
 * it belongs to, and its address is in the query (`?task=`, `?about=`,
 * `?activity=1`), so a link to it can be pasted to a colleague.
 *
 * The module is loaded on demand, so somebody who only ever opens general
 * projects never downloads the grant views, and the other way round.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import {
  closeProject,
  openProject,
  retryProject,
  setPresence,
  patchOpenProject,
  useProject,
  usePresence,
} from '../lib/store';
import { buildProjectFile, downloadJson } from '../lib/transfer';
import { setProjectStatus } from '../lib/queries';
import { href, navigate, setQuery, useRoute } from '../lib/router';
import { isAdmin, useAuth } from '../lib/auth';
import { toast } from '../lib/toasts';
import { openGlobalDialog } from '../lib/ui';
import {
  TABS,
  TAB_LABEL,
  isFlaggedPrimary,
  loadProjectList,
  pickPrimary,
  redirectFor,
  setPrimaryProject,
  useProjectList,
  type TabKey,
} from '../lib/projects';
import { Avatar } from '../components/Avatar';
import { Button, LinkButton } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Menu, type MenuItem } from '../components/Menu';
import { SchemaNotice, ConnectionBanner, SlowNotice } from '../components/SchemaNotice';
import { SkeletonLines } from '../components/Skeleton';
import { Tabs, type TabDef } from '../components/Tabs';
import { ActivityDrawer, useUnread } from '../components/ActivityDrawer';
import {
  IconArchive,
  IconBell,
  IconClock,
  IconDots,
  IconDownload,
  IconInfo,
  IconPeople,
  IconSettings,
  IconStar,
  IconUpload,
} from '../components/Icons';
import { MembersDialog } from './MembersDialog';
import { SettingsDialog } from './SettingsDialog';
import { AboutModal } from './AboutModal';

export interface ModuleProps {
  tab: string;
}

export function Project({ slug, tab }: { slug: string; tab?: string }) {
  const auth = useAuth();
  const route = useRoute();
  const list = useProjectList();
  const { status, error, project, readOnly, role, canManage, connection, slow, members, profiles } = useProject();
  const peers = usePresence();
  const [Module, setModule] = useState<ComponentType<ModuleProps> | null>(null);
  const [moduleError, setModuleError] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // The banner waits; the dot in the header does not (see below).
  const [showBanner, setShowBanner] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const downSince = useRef<number | null>(null);
  const unread = useUnread();

  useEffect(() => {
    void openProject(slug);
    return () => closeProject();
  }, [slug]);

  /**
   * A dropped socket that comes straight back is not worth a banner: the
   * header dot says so already, and a strip that appears and vanishes reads
   * as a fault rather than a hiccup. So the banner waits until the connection
   * has been down for four seconds, and goes the moment it is live again.
   */
  useEffect(() => {
    const down = connection === 'reconnecting' || connection === 'offline';
    if (!down) {
      downSince.current = null;
      setShowBanner(false);
      return;
    }
    if (downSince.current === null) downSince.current = Date.now();
    const waited = Date.now() - downSince.current;
    const timer = window.setTimeout(() => setShowBanner(true), Math.max(0, 4000 - waited));
    return () => window.clearTimeout(timer);
  }, [connection]);

  const kind = project?.kind ?? 'general';
  const tabs = TABS[kind];
  const activeTab: TabKey = tab && (tabs as string[]).includes(tab) ? (tab as TabKey) : 'plan';

  // Old addresses (overview, deliverables, outcomes, budget, rulebook,
  // activity) and a bare project address land on a real tab.
  useEffect(() => {
    if (!project || tab === activeTab) return;
    const moved = redirectFor(project.kind, tab);
    navigate(`/p/${slug}/${moved?.tab ?? activeTab}`, {
      replace: true,
      query: { ...route.query, ...(moved?.query ?? {}) },
    });
  }, [project, tab, activeTab, slug]);

  useEffect(() => {
    setPresence({ tab: activeTab });
  }, [activeTab]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setModuleError(false);
    const load =
      project.kind === 'grant'
        ? import('../modules/grant/index')
        : import('../modules/general/index');
    void load
      .then((module) => {
        if (cancelled) return;
        setModule(() => module.default as ComponentType<ModuleProps>);
      })
      .catch(() => {
        if (!cancelled) setModuleError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.kind, project?.id]);

  const retry = async () => {
    setRetrying(true);
    try {
      await retryProject();
    } finally {
      setRetrying(false);
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div class="wb-page">
        {slow ? <SlowNotice what="This project" /> : null}
        <SkeletonLines count={2} />
        <SkeletonLines count={6} />
      </div>
    );
  }

  if (status !== 'ready' || !project) {
    /*
     * A load that stalled or a connection that went out can be tried again and
     * may well work; a missing table or a closed door cannot, and offering a
     * button there would only waste somebody's afternoon.
     */
    const worthRetrying = !error || (!error.missingSchema && !error.permission);
    const retryButton = (
      <Button variant="secondary" busy={retrying} onClick={retry} data-wb-retry>
        Try again
      </Button>
    );

    return (
      <div class="wb-page">
        {error ? (
          <SchemaNotice
            error={error}
            what="this project"
            action={worthRetrying ? retryButton : null}
          />
        ) : (
          <EmptyState
            title="That project is not here"
            body="It may have been renamed, archived or removed, or you may not be a member of it."
            action={
              <LinkButton variant="secondary" href={href('/projects')}>
                Back to projects
              </LinkButton>
            }
          />
        )}
      </div>
    );
  }

  const admin = isAdmin(auth);
  const primary = pickPrimary(list.projects);
  const isHome = primary?.id === project.id;

  const tabDefs: TabDef[] = tabs.map((key) => ({
    key,
    label: TAB_LABEL[key],
    href: href(`/p/${slug}/${key}`),
  }));

  const openAbout = () => setQuery({ ...route.query, about: 'start', activity: null });
  const openActivity = () => setQuery({ ...route.query, activity: '1', about: null });

  /* Members first by who is here, so the lit avatars sit at the front. */
  const here = new Map(peers.map((peer) => [peer.user_id, peer]));
  const team = [...members]
    .sort((a, b) => Number(here.has(b.user_id)) - Number(here.has(a.user_id)))
    .slice(0, 5);

  const makeHome = async () => {
    const result = await setPrimaryProject(project.id);
    if (result.ok) {
      patchOpenProject(project.id, { config: { ...project.config, primary: true } });
      toast.good(`${project.name} is now the home project.`);
    } else {
      toast.bad(result.error?.message ?? 'That did not work.');
    }
  };

  const menuItems: MenuItem[] = [
    {
      key: 'about',
      label: 'About this project',
      icon: <IconInfo size={16} />,
      onSelect: openAbout,
    },
    {
      key: 'activity',
      label: 'Activity',
      icon: <IconClock size={16} />,
      onSelect: openActivity,
    },
    {
      key: 'members',
      label: 'Members',
      icon: <IconPeople size={16} />,
      divider: true,
      onSelect: () => setShowMembers(true),
    },
    {
      key: 'settings',
      label: 'Project settings',
      icon: <IconSettings size={16} />,
      onSelect: () => setShowSettings(true),
      hint: canManage ? undefined : 'View only',
    },
    ...(admin && !isHome && project.status === 'active'
      ? [
          {
            key: 'home',
            label: 'Make this the home project',
            icon: <IconStar size={16} />,
            onSelect: () => void makeHome(),
          },
        ]
      : []),
    {
      key: 'export',
      label: 'Export to a file',
      icon: <IconDownload size={16} />,
      divider: true,
      onSelect: async () => {
        try {
          const file = await buildProjectFile(project.id);
          downloadJson(`${project.slug}.mmt-project.json`, file);
          toast.good('Exported.');
        } catch (exportError) {
          toast.error(exportError, 'export');
        }
      },
    },
    ...(admin
      ? [
          {
            key: 'import',
            label: 'Import a project from a file',
            icon: <IconUpload size={16} />,
            onSelect: () => openGlobalDialog('import'),
          },
        ]
      : []),
    {
      key: 'archive',
      label: project.status === 'archived' ? 'Bring back from the archive' : 'Archive',
      icon: <IconArchive size={16} />,
      onSelect: () => setArchiving(true),
      disabled: !canManage && !admin,
      tone: 'danger' as const,
      divider: true,
    },
  ];

  const statusWord =
    project.status === 'archived' ? 'Archived' : readOnly ? 'View only' : isHome ? 'Home project' : 'Active';

  return (
    <div class="wb-page wb-project" data-track={project.track}>
      {showBanner && (connection === 'reconnecting' || connection === 'offline') ? (
        <ConnectionBanner state={connection} />
      ) : null}

      <header class="wb-project-bar">
        <h1 class="wb-project-name">{project.name}</h1>
        <span
          class={`wb-pill wb-pill-${project.status === 'archived' ? 'quiet' : readOnly ? 'quiet' : 'accent'}`}
          title={readOnly ? `Your role: ${role ?? 'viewer'}` : undefined}
        >
          {statusWord}
        </span>

        <span class="wb-spacer" />

        <span class="wb-presence" role="group" aria-label={`Team: ${members.length}, ${peers.length} here now`}>
          <span
            class={`wb-live-dot wb-live-${connection}`}
            title={connection === 'live' ? 'Live: changes appear as they happen' : connection === 'reconnecting' ? 'Reconnecting' : 'Offline'}
          >
            <span class="wb-live-bulb" aria-hidden="true" />
            <span class="wb-sr">
              {connection === 'live' ? 'Live' : connection === 'reconnecting' ? 'Reconnecting' : 'Offline'}
            </span>
          </span>
          <span class="wb-avatar-stack">
            {team.map((member) => {
              const profile = profiles[member.user_id];
              const peer = here.get(member.user_id);
              const name = profile?.full_name?.trim() || profile?.email || 'Member';
              const where = peer ? `here now, on ${TAB_LABEL[peer.tab as TabKey] ?? 'this project'}` : 'not here right now';
              return (
                <Avatar
                  key={member.user_id}
                  id={member.user_id}
                  name={profile?.full_name}
                  email={profile?.email}
                  size={28}
                  active={Boolean(peer) || member.user_id === auth.userId}
                  class={peer || member.user_id === auth.userId ? 'is-here' : 'is-away'}
                  title={member.user_id === auth.userId ? `${name} (you)` : `${name}, ${where}`}
                />
              );
            })}
            {members.length > team.length ? (
              <span class="wb-avatar wb-avatar-more" style={{ width: '28px', height: '28px' }}>
                +{members.length - team.length}
              </span>
            ) : null}
          </span>
        </span>

        <Button variant="quiet" size="sm" icon={<IconInfo size={16} />} onClick={openAbout} class="wb-about-button">
          About
        </Button>

        <button
          type="button"
          class="wb-icon-button wb-bell"
          onClick={openActivity}
          aria-label={unread.count ? `Activity, ${unread.count} new since you were here` : 'Activity'}
          title="Activity"
        >
          <IconBell />
          {unread.count ? <span class="wb-bell-count wb-mono">{unread.count > 99 ? '99+' : unread.count}</span> : null}
        </button>

        <Menu
          align="right"
          items={menuItems}
          trigger={(props) => (
            <button type="button" class="wb-icon-button" aria-label="Project menu" {...props}>
              <IconDots />
            </button>
          )}
        />
      </header>

      <Tabs tabs={tabDefs} active={activeTab} label="Project sections" class="wb-project-tabs" />

      <div class="wb-project-body">
        {moduleError ? (
          <EmptyState
            title="This part could not be loaded"
            body="The connection may have dropped while it was downloading. Reload the page."
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reload
              </Button>
            }
          />
        ) : Module ? (
          <Module tab={activeTab} />
        ) : (
          <SkeletonLines count={6} />
        )}
      </div>

      <AboutModal
        open={route.query.about !== undefined}
        section={route.query.about ?? ''}
        onSection={(next) => setQuery({ ...route.query, about: next })}
        onClose={() => setQuery({ ...route.query, about: null })}
      />

      <ActivityDrawer
        open={route.query.activity !== undefined}
        onClose={() => setQuery({ ...route.query, activity: null })}
      />

      <MembersDialog open={showMembers} onClose={() => setShowMembers(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

      <ConfirmDialog
        open={archiving}
        title={project.status === 'archived' ? 'Bring this project back?' : 'Archive this project?'}
        body={
          project.status === 'archived'
            ? 'It will show up under Other projects again.'
            : isFlaggedPrimary(project)
              ? 'Nothing is deleted. It moves out of the way and can be brought back at any time. It is the home project, so the portal will open on another project until you choose a new one.'
              : 'Nothing is deleted. It moves out of the way and can be brought back at any time.'
        }
        confirmLabel={project.status === 'archived' ? 'Bring it back' : 'Archive it'}
        tone={project.status === 'archived' ? 'primary' : 'danger'}
        onCancel={() => setArchiving(false)}
        onConfirm={async () => {
          const next = project.status === 'archived' ? 'active' : 'archived';
          const result = await setProjectStatus(project.id, next);
          setArchiving(false);
          if (result.ok) {
            toast.good(next === 'archived' ? 'Archived.' : 'Brought back.');
            patchOpenProject(project.id, { status: next });
            await loadProjectList();
            if (next === 'archived') navigate('/projects');
          } else {
            toast.bad(result.error?.message ?? 'That did not work.');
          }
        }}
      />
    </div>
  );
}
