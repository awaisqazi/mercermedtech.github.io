/**
 * One project on the Home and Projects screens. The track colour is a bar down
 * the side rather than a wash, so the card stays a work surface.
 */
import type { ProjectSummary } from '../lib/queries';
import type { Profile } from '../lib/types';
import { href } from '../lib/router';
import { dueWording, plural, ratio } from '../lib/format';
import { AvatarStack } from '../components/Avatar';
import { Chip } from '../components/Chip';
import { ProgressRing } from '../components/ProgressRing';

export function ProjectCard({
  summary,
  profiles,
}: {
  summary: ProjectSummary;
  profiles: Record<string, Profile>;
}) {
  const { project } = summary;
  const done = ratio(summary.done, summary.total);

  return (
    <a class="wb-card wb-project-card" data-track={project.track} href={href(`/p/${project.slug}/overview`)}>
      <span class="wb-card-bar" aria-hidden="true" />

      <div class="wb-card-head">
        <h3 class="wb-card-title">{project.name}</h3>
        <Chip tone={project.kind === 'grant' ? 'accent' : 'quiet'}>
          {project.kind === 'grant' ? 'Grant' : 'Project'}
        </Chip>
        {project.status === 'archived' ? <Chip tone="quiet">Archived</Chip> : null}
      </div>

      {project.summary ? <p class="wb-card-summary">{project.summary}</p> : null}

      <div class="wb-card-foot">
        <ProgressRing
          value={done}
          title={
            summary.total
              ? `${summary.done} of ${summary.total} items done`
              : 'Nothing to track yet'
          }
        />
        <div class="wb-card-stats">
          <span class="wb-mono-soft">{plural(summary.open, 'open')}</span>
          {summary.overdue ? (
            <span class="wb-mono-soft is-overdue">{summary.overdue} overdue</span>
          ) : null}
          {summary.nextDue ? <span class="wb-mono-soft">{dueWording(summary.nextDue)}</span> : null}
        </div>
        <AvatarStack
          size={24}
          max={4}
          label="Members"
          people={summary.members.map((member) => ({
            id: member.user_id,
            name: profiles[member.user_id]?.full_name,
            email: profiles[member.user_id]?.email,
          }))}
        />
      </div>
    </a>
  );
}
