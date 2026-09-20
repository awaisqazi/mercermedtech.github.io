/**
 * The frame around a project: header, presence, tabs, and whichever module
 * matches the project's kind.
 *
 * The module is loaded on demand, so somebody who only ever opens general
 * projects never downloads the grant views, and the other way round.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { closeProject, openProject, setPresence, useProject, usePresence } from '../lib/store';
import { buildProjectFile, downloadJson } from '../lib/transfer';
import { setProjectStatus } from '../lib/queries';
import { href, navigate, useRoute } from '../lib/router';
import { isAdmin, useAuth } from '../lib/auth';
import { toast } from '../lib/toasts';
import { AvatarStack } from '../components/Avatar';
import { Button, LinkButton } from '../components/Button';
import { Chip } from '../components/Chip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Menu } from '../components/Menu';
import { SchemaNotice, ConnectionBanner } from '../components/SchemaNotice';
import { SkeletonLines } from '../components/Skeleton';
import { Tabs, type TabDef } from '../components/Tabs';
import { IconArchive, IconDots, IconDownload, IconEye, IconPeople, IconSettings } from '../components/Icons';
import { MembersDialog } from './MembersDialog';
import { SettingsDialog } from './SettingsDialog';

export interface ModuleProps {
  tab: string;
}

const GRANT_TABS = [
  'overview',
  'deliverables',
  'reports',
  'outcomes',
  'budget',
  'partners',
  'rulebook',
  'activity',
];
const GENERAL_TABS = ['overview', 'tasks', 'notes', 'activity'];

const TAB_LABEL: Record<string, string> = {
  overview: 'Overview',
  deliverables: 'Deliverables',
  reports: 'Reports',
  outcomes: 'Outcomes',
  budget: 'Budget',
  partners: 'Partners',
  rulebook: 'Rulebook',
  activity: 'Activity',
  tasks: 'Tasks',
  notes: 'Notes',
};

export function Project({ slug, tab }: { slug: string; tab?: string }) {
  const auth = useAuth();
  const route = useRoute();
  const { status, error, project, readOnly, role, canManage, connection } = useProject();
  const peers = usePresence();
  const [Module, setModule] = useState<ComponentType<ModuleProps> | null>(null);
  const [moduleError, setModuleError] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  // The banner waits; the dot in the header does not (see below).
  const [showBanner, setShowBanner] = useState(false);
  const downSince = useRef<number | null>(null);

  useEffect(() => {
    void openProject(slug);
    setSummaryOpen(false);
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
  const tabs = kind === 'grant' ? GRANT_TABS : GENERAL_TABS;
  const activeTab = tab && tabs.includes(tab) ? tab : tabs[0]!;

  // Send the browser to a real tab address rather than leaving a bare project URL.
  useEffect(() => {
    if (!project) return;
    if (tab !== activeTab) navigate(`/p/${slug}/${activeTab}`, { replace: true, query: route.query });
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

  if (status === 'loading' || status === 'idle') {
    return (
      <div class="wb-page">
        <SkeletonLines count={2} />
        <SkeletonLines count={6} />
      </div>
    );
  }

  if (status !== 'ready' || !project) {
    return (
      <div class="wb-page">
        {error ? (
          <SchemaNotice error={error} what="this project" />
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

  const tabDefs: TabDef[] = tabs.map((key) => ({
    key,
    label: TAB_LABEL[key] ?? key,
    href: href(`/p/${slug}/${key}`),
  }));

  const presentPeople = peers.map((peer) => ({
    id: peer.user_id,
    name: peer.name,
    note: TAB_LABEL[peer.tab] ?? peer.tab,
  }));

  const menuItems = [
    {
      key: 'members',
      label: 'Members',
      icon: <IconPeople size={16} />,
      onSelect: () => setShowMembers(true),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <IconSettings size={16} />,
      onSelect: () => setShowSettings(true),
      disabled: !canManage,
    },
    {
      key: 'export',
      label: 'Export JSON',
      icon: <IconDownload size={16} />,
      onSelect: async () => {
        setExporting(true);
        try {
          const file = await buildProjectFile(project.id);
          downloadJson(`${project.slug}.mmt-project.json`, file);
          toast.good('Exported.');
        } catch (exportError) {
          toast.error(exportError, 'export');
        } finally {
          setExporting(false);
        }
      },
    },
    {
      key: 'archive',
      label: project.status === 'archived' ? 'Bring back from the archive' : 'Archive',
      icon: <IconArchive size={16} />,
      onSelect: () => setArchiving(true),
      disabled: !canManage && !isAdmin(auth),
      tone: 'danger' as const,
    },
  ];

  return (
    <div class="wb-page wb-project" data-track={project.track}>
      {showBanner && (connection === 'reconnecting' || connection === 'offline') ? (
        <ConnectionBanner state={connection} />
      ) : null}

      <header class="wb-project-head">
        <div class="wb-project-title-row">
          <div class="wb-project-titles">
            <h1 class="wb-page-title">{project.name}</h1>
            <Chip tone="accent">{project.track === 'org' ? 'Organisation' : project.track === 'med' ? 'Med' : 'Tech'}</Chip>
            {project.status === 'archived' ? <Chip tone="quiet">Archived</Chip> : null}
            {readOnly ? (
              <Chip tone="quiet" icon={<IconEye size={13} />} title={`Your role: ${role ?? 'viewer'}`}>
                View only
              </Chip>
            ) : null}
          </div>
          {/* Stays at the top right whatever the title does. */}
          <div class="wb-project-title-menu">
            <Menu
              align="right"
              items={menuItems}
              trigger={(props) => (
                <button type="button" class="wb-icon-button" aria-label="Project menu" {...props}>
                  <IconDots />
                </button>
              )}
            />
          </div>
        </div>

        <div class="wb-project-meta">
          {project.kind === 'grant' && project.config?.funder ? (
            <span class="wb-mono-soft">{String(project.config.funder)}</span>
          ) : null}
          {project.kind === 'grant' && project.config?.contract_no ? (
            <span class="wb-mono">{String(project.config.contract_no)}</span>
          ) : null}
          <span class={`wb-live-dot wb-live-${connection}`}>
            <span class="wb-live-bulb" aria-hidden="true" />
            {connection === 'live' ? 'Live' : connection === 'reconnecting' ? 'Reconnecting' : 'Offline'}
          </span>
          <AvatarStack people={presentPeople} label="Here now" size={26} />
        </div>

        {project.summary ? (
          <div class="wb-project-summary-wrap">
            <p
              id="wb-project-summary"
              class={`wb-project-summary${summaryOpen ? ' is-open' : ''}`}
            >
              {project.summary}
            </p>
            {/* Phones only: the tabs matter more than the blurb. */}
            <button
              type="button"
              class="wb-summary-toggle"
              aria-expanded={summaryOpen}
              aria-controls="wb-project-summary"
              onClick={() => setSummaryOpen((open) => !open)}
            >
              {summaryOpen ? 'Less' : 'More'}
            </button>
          </div>
        ) : null}
      </header>

      <Tabs tabs={tabDefs} active={activeTab} label="Project sections" />

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

      {exporting ? <p class="wb-hint">Preparing the export.</p> : null}

      <MembersDialog open={showMembers} onClose={() => setShowMembers(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

      <ConfirmDialog
        open={archiving}
        title={project.status === 'archived' ? 'Bring this project back?' : 'Archive this project?'}
        body={
          project.status === 'archived'
            ? 'It will show up in the project list again.'
            : 'Nothing is deleted. It moves out of the main list and can be brought back at any time.'
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
            navigate('/projects');
          } else {
            toast.bad(result.error?.message ?? 'That did not work.');
          }
        }}
      />

    </div>
  );
}
