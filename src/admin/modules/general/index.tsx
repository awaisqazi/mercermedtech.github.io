/**
 * The general-project module: Plan and Notes.
 *
 * Loaded on demand by the project frame. What used to be Overview and
 * Activity now lives in the About panel and the activity drawer, which the
 * frame owns for every kind of project.
 */
import type { ModuleProps } from '../../screens/Project';
import { PlanView } from '../../components/tasks/PlanView';
import { Notes } from './Notes';

export default function GeneralModule({ tab }: ModuleProps) {
  if (tab === 'notes') return <Notes />;
  return <PlanView />;
}
