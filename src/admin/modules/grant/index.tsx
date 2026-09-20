/**
 * The grant module.
 *
 * ---------------------------------------------------------------------------
 * HOW A TAB IS PUT TOGETHER
 * ---------------------------------------------------------------------------
 * Each tab is one file in this folder, exporting one component that takes no
 * props. Every tab below is now built; a new one is a new file plus a case in
 * the switch, and nothing outside this folder needs to change. `ComingSoon` is
 * still here for a tab that is stubbed out on the way to being written.
 *
 * Two files in this folder are not tabs:
 *   shared.ts       reading `config` and `project_state` safely: the funnel
 *                   (and its `side` entries), the metric map behind the
 *                   headline rates, the term, the budget lines and the report
 *                   checklist. Everything returns a usable value when the
 *                   setting is missing.
 *   StateFields.tsx number and date inputs bound to a key inside a
 *                   `project_state` blob, the way LiveField binds a column.
 *
 * What a tab has to work with:
 *
 *   const { project, config, readOnly, canManage, members, profiles } = useProject();
 *   const reports  = useReports();          // rows, kept live
 *   const partners = usePartners();
 *   const tasks    = useTasks();
 *   const [metrics, patchMetrics] = useProjectState('metrics');
 *   const [budget,  patchBudget]  = useProjectState('budget');
 *
 *   await updateRow('reports', id, { status: 'submitted' });   // one column
 *   await insertRow('partners', { name: 'New partner' });
 *   await deleteRow('partners', id);
 *   await patchBudget((current) => ({ ...current, billed: { ...next } }));
 *
 * Components worth reusing rather than rewriting:
 *
 *   <TaskSection />                     the whole deliverables surface
 *   <DocsSection section="notes:budget" />   documents plus the block editor
 *   <SourcesList sources={row.sources} onChange={...} />
 *   <CommentThread entity="report" id={row.id} />
 *   <LiveText /> <LiveNumber /> <LiveDate /> <LiveSelect /> <LiveCheckbox />
 *   <Bar value={...} target={...} />  <ProgressRing />  <Chip />  <EmptyState />
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
import { Overview } from './Overview';
import { Deliverables } from './Deliverables';
import { Reports } from './Reports';
import { Outcomes } from './Outcomes';
import { Budget } from './Budget';
import { Partners } from './Partners';
import { Rulebook } from './Rulebook';
import { Activity } from './Activity';

export default function GrantModule({ tab }: ModuleProps) {
  switch (tab) {
    case 'deliverables':
      return <Deliverables />;
    case 'reports':
      return <Reports />;
    case 'outcomes':
      return <Outcomes />;
    case 'budget':
      return <Budget />;
    case 'partners':
      return <Partners />;
    case 'rulebook':
      return <Rulebook />;
    case 'activity':
      return <Activity />;
    case 'overview':
    default:
      return <Overview />;
  }
}
