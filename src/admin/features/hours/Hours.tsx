/**
 * Hours: My week and the Team month. Two screens behind one export, because
 * AdminApp routes `#/hours` and `#/hours/team` to the same feature.
 */
import { MyWeek } from './MyWeek';
import { TeamHours } from './TeamHours';

export function Hours({ tab }: { tab: 'week' | 'team' }) {
  return tab === 'team' ? <TeamHours /> : <MyWeek />;
}
