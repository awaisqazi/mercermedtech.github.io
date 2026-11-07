/**
 * Settings, Projects tab: a ruled list of every project (code, name, track,
 * lead, status). New project and Edit open ProjectDialog; Archive and Restore
 * ask first. Archived projects sit in a folded group.
 */
import { useMemo, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useConfirm } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { IconPlus } from '../../components/Icons';
import { PhoneAction } from '../../components/PageHeader';
import { ProjectMark } from '../../components/ProjectMark';
import { Skeleton } from '../../components/Skeleton';
import { toast } from '../../lib/toasts';
import { TRACK_LABEL, PROJECT_STATUS_LABEL, type Project } from '../../lib/types';
import { saveProject, useProfiles, useProjects, useWorkspace } from '../../lib/workspace';
import { ProjectDialog } from './ProjectDialog';

export function Projects() {
  const workspace = useWorkspace();
  const projects = useProjects();
  const profiles = useProfiles();
  const { confirm, element } = useConfirm();
  const [editing, setEditing] = useState<Project | 'new' | null>(null);

  const leadOf = useMemo(() => new Map(profiles.map((person) => [person.id, person])), [profiles]);
  const live = projects.filter((project) => project.status !== 'archived');
  const archived = projects.filter((project) => project.status === 'archived');
  const loading = workspace.status === 'loading' || workspace.status === 'idle';

  const toggle = async (project: Project) => {
    const archiving = project.status !== 'archived';
    const sure = await confirm(
      archiving
        ? {
            title: `Archive ${project.name}?`,
            body: 'It leaves the project pickers. Its tasks and hours stay as they are, and you can restore it later.',
            confirmLabel: 'Archive',
            tone: 'danger',
          }
        : {
            title: `Restore ${project.name}?`,
            body: 'It comes back into the project pickers.',
            confirmLabel: 'Restore',
          }
    );
    if (!sure) return;
    const result = await saveProject({ id: project.id, status: archiving ? 'archived' : 'active' });
    if (result.ok) toast.good(archiving ? `${project.name} is archived.` : `${project.name} is active again.`);
  };

  const list = (rows: Project[], label: string) => (
    <ul class="wb-list wb-project-list" aria-label={label}>
      {rows.map((project) => {
        const lead = project.lead_id ? leadOf.get(project.lead_id) : null;
        return (
          <li class="wb-project-row" key={project.id}>
            <div class="wb-project-code-cell">
              <ProjectMark project={project} />
            </div>
            <div class="wb-project-main">
              <span class="wb-project-title">{project.name}</span>
              <span class="wb-project-meta">
                <span>{TRACK_LABEL[project.track]}</span>
                <span class="wb-project-lead">
                  {lead ? (
                    <>
                      <Avatar id={lead.id} name={lead.full_name} email={lead.email} size={18} />
                      {lead.full_name || lead.email}
                    </>
                  ) : (
                    'No lead'
                  )}
                </span>
                <span>{PROJECT_STATUS_LABEL[project.status]}</span>
              </span>
              {project.summary ? <span class="wb-project-summary">{project.summary}</span> : null}
            </div>
            <div class="wb-project-actions">
              <Button size="sm" variant="secondary" onClick={() => setEditing(project)} aria-label={`Edit ${project.name}`}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => toggle(project)}
                aria-label={`${project.status === 'archived' ? 'Restore' : 'Archive'} ${project.name}`}
              >
                {project.status === 'archived' ? 'Restore' : 'Archive'}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section class="wb-section wb-settings-panel" aria-label="Projects">
      <div class="wb-settings-bar">
        <p class="wb-prose">Work is grouped into projects. The code is what shows in lists, so keep it short.</p>
        <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          New project
        </Button>
      </div>
      <PhoneAction label="New project" icon={<IconPlus size={18} />} onClick={() => setEditing('new')} />

      {loading ? (
        <Skeleton height={64} radius={8} />
      ) : live.length === 0 && archived.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Make the first one so tasks and hours have somewhere to go."
          action={
            <Button variant="primary" onClick={() => setEditing('new')}>
              New project
            </Button>
          }
        />
      ) : (
        <>
          {live.length ? list(live, 'Projects') : <p class="wb-meta">Every project is archived. Restore one below, or make a new one.</p>}
          {archived.length ? (
            <details class="wb-people-fold">
              <summary class="wb-people-fold-summary">
                Archived <span class="wb-mono wb-meta">{archived.length}</span>
              </summary>
              {list(archived, 'Archived projects')}
            </details>
          ) : null}
        </>
      )}

      <ProjectDialog project={editing === 'new' ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
      {element}
    </section>
  );
}
