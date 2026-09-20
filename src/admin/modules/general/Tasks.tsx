/**
 * Tasks for a general project. The same components the grant module uses for
 * Deliverables; workstreams are optional here, so the filter only appears when
 * the project's settings define some.
 */
import { useProject } from '../../lib/store';
import { TaskSection } from '../../components/tasks';
import type { WorkstreamDef } from '../../lib/types';

export function Tasks() {
  const { config } = useProject();
  const workstreams = (config.workstreams ?? []) as WorkstreamDef[];
  return <TaskSection workstreams={workstreams} noun="task" title="Tasks" />;
}
