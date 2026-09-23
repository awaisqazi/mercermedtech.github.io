/**
 * Every project this person can see, as a plain list: the home project first,
 * then the other active ones, and the archived ones folded away underneath.
 *
 * Starting a project and importing one are rare, so they are not on this
 * screen's surface any more; they live in the Settings menu (the gear at the
 * foot of the rail), which is also what the empty state points to.
 */
import { useEffect, useState } from 'preact/hooks';
import { isAdmin, useAuth } from '../lib/auth';
import { href } from '../lib/router';
import { relativeTime } from '../lib/format';
import { openGlobalDialog } from '../lib/ui';
import { loadProjectList, pickPrimary, useProjectList } from '../lib/projects';
import type { Project } from '../lib/types';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { SkeletonLines } from '../components/Skeleton';
import { SchemaNotice } from '../components/SchemaNotice';
import { IconChevronDown, IconPlus, IconProjects } from '../components/Icons';

const TRACK_LABEL = { med: 'Med', tech: 'Tech', org: 'Organisation' } as const;

export function Projects() {
  const auth = useAuth();
  const admin = isAdmin(auth);
  const list = useProjectList();
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    void loadProjectList();
  }, []);

  const primary = pickPrimary(list.projects);
  const active = list.projects
    .filter((project) => project.status === 'active')
    .sort((a, b) => Number(b.id === primary?.id) - Number(a.id === primary?.id) || a.name.localeCompare(b.name));
  const archived = list.projects.filter((project) => project.status === 'archived');

  const row = (project: Project) => (
    <li key={project.id}>
      <a class="wb-project-row" href={href(`/p/${project.slug}/plan`)} data-track={project.track}>
        <span class="wb-rail-swatch" aria-hidden="true" />
        <span class="wb-project-row-main">
          <span class="wb-project-row-name">
            {project.name}
            {project.id === primary?.id ? <span class="wb-pill wb-pill-accent">Home project</span> : null}
          </span>
          {project.summary ? <span class="wb-project-row-summary">{project.summary}</span> : null}
        </span>
        <span class="wb-project-row-meta wb-mono-soft">
          {project.kind === 'grant' ? 'Grant' : 'Project'} · {TRACK_LABEL[project.track]} · updated{' '}
          {relativeTime(project.updated_at)}
        </span>
      </a>
    </li>
  );

  return (
    <div class="wb-page wb-page-narrow">
      <header class="wb-page-head">
        <div>
          <h1 class="wb-page-title">All projects</h1>
          <p class="wb-page-sub">Everything you have been given access to.</p>
        </div>
      </header>

      {list.error ? <SchemaNotice error={list.error} what="the project list" /> : null}

      {list.status === 'loading' || list.status === 'idle' ? (
        <SkeletonLines count={4} />
      ) : active.length ? (
        <ul class="wb-project-list">{active.map(row)}</ul>
      ) : (
        <EmptyState
          icon={<IconProjects size={24} />}
          title="No projects yet"
          body={
            admin
              ? 'Start one from scratch, or bring one in from a file. Both are also in the Settings menu at the foot of the sidebar.'
              : 'Once somebody adds you to a project it will show up here.'
          }
          action={
            admin ? (
              <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => openGlobalDialog('new-project')}>
                New project
              </Button>
            ) : null
          }
        />
      )}

      {archived.length ? (
        <section class="wb-archived">
          <button
            type="button"
            class="wb-plan-group-head is-toggle"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((value) => !value)}
          >
            <span>Archived</span>
            <span class="wb-plan-count wb-mono">{archived.length}</span>
            <IconChevronDown size={14} class={showArchived ? 'wb-flip-y' : ''} />
          </button>
          {showArchived ? <ul class="wb-project-list is-archived">{archived.map(row)}</ul> : null}
        </section>
      ) : null}
    </div>
  );
}
