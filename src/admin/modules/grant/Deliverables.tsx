/**
 * The grant's deliverables. Exactly the task components the general module
 * uses, with the grant's workstreams from `config` and the grant's word for
 * the thing.
 *
 * `?ws=<key>` pre-sets the workstream filter, which is what the workstream
 * health table on Overview links to.
 */
import { useProject } from '../../lib/store';
import { useRoute } from '../../lib/router';
import { TaskSection } from '../../components/tasks';
import type { WorkstreamDef } from '../../lib/types';

export function Deliverables() {
  const { config } = useProject();
  const route = useRoute();
  const workstreams = (config.workstreams ?? []) as WorkstreamDef[];

  return (
    <TaskSection
      workstreams={workstreams}
      noun="deliverable"
      title="Deliverables"
      initialWs={route.query.ws ?? ''}
    />
  );
}
