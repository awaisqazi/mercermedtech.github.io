/**
 * The grant module: four sections, each one file in this folder.
 *
 *   Plan       every task, grouped by what needs doing when (PlanView)
 *   Reports    the reporting months as a timeline; each opens a panel
 *   Partners   county coverage and the partner list; each opens a panel
 *   Numbers    outcomes and budget at a glance; "Edit numbers" opens the
 *              full tables (Outcomes.tsx and Budget.tsx, unchanged in spirit)
 *
 * What used to be the Overview, the Rulebook and the Activity tabs now lives
 * in the About panel and the activity drawer, both owned by the project frame
 * (screens/Project.tsx). Old addresses are redirected there.
 *
 * Helpers that are not sections:
 *   shared.ts        reading `config` and `project_state` safely: funnel,
 *                    metric map, term, budget lines, report checklist.
 *   StateFields.tsx  number and date inputs bound to a key inside a
 *                    `project_state` blob, the way LiveField binds a column.
 *
 * Two rules the rest of the portal keeps to:
 *   - Nothing about any particular grant is written into this repo. Targets,
 *     milestones, workstreams, budget lines, report checks and funnel steps
 *     all come from `config`, which an administrator edits in Settings.
 *   - A viewer sees everything read-only. Pass `readOnly` down to every
 *     control rather than hiding it, so the shape of the screen is the same
 *     for everyone.
 */
import type { ModuleProps } from '../../screens/Project';
import { useProject } from '../../lib/store';
import { PlanView } from '../../components/tasks/PlanView';
import type { WorkstreamDef } from '../../lib/types';
import { Reports } from './Reports';
import { Partners } from './Partners';
import { Numbers } from './Numbers';

function Plan() {
  const { config } = useProject();
  return <PlanView workstreams={(config.workstreams ?? []) as WorkstreamDef[]} />;
}

export default function GrantModule({ tab }: ModuleProps) {
  switch (tab) {
    case 'reports':
      return <Reports />;
    case 'partners':
      return <Partners />;
    case 'numbers':
      return <Numbers />;
    case 'plan':
    default:
      return <Plan />;
  }
}
