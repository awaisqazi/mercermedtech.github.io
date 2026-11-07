/**
 * A project's code beside its track square: teal for Med, indigo for Tech,
 * ink for Org. This and the split hairline are the only places the two brand
 * colours appear in the portal, so colour stays structure, not decoration.
 */
import { TRACK_LABEL, type Project } from '../lib/types';

export function ProjectMark({
  project,
  showName = false,
  class: className,
}: {
  project: Pick<Project, 'code' | 'name' | 'track'> | null | undefined;
  /** Adds the full name after the code. */
  showName?: boolean;
  class?: string;
}) {
  if (!project) return null;
  return (
    <span
      class={`wb-project-mark${className ? ` ${className}` : ''}`}
      data-track={project.track}
      title={showName ? undefined : `${project.name} (${TRACK_LABEL[project.track] ?? 'Org'})`}
    >
      <span class="wb-project-square" aria-hidden="true" />
      <span class="wb-project-code">{project.code}</span>
      {showName ? <span class="wb-project-name">{project.name}</span> : <span class="wb-sr"> {project.name}</span>}
    </span>
  );
}
