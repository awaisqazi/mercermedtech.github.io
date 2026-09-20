/**
 * The general-project module: Overview, Tasks, Notes, Activity.
 *
 * Loaded on demand by the project frame. It takes the active tab and nothing
 * else; the data all comes from the project store.
 */
import type { ModuleProps } from '../../screens/Project';
import { Overview } from './Overview';
import { Tasks } from './Tasks';
import { Notes } from './Notes';
import { Activity } from './Activity';

export default function GeneralModule({ tab }: ModuleProps) {
  switch (tab) {
    case 'tasks':
      return <Tasks />;
    case 'notes':
      return <Notes />;
    case 'activity':
      return <Activity />;
    case 'overview':
    default:
      return <Overview />;
  }
}
