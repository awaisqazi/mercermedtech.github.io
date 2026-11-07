import { Tabs } from '../../components/Tabs';
import { href } from '../../lib/router';

/** My week and Team hours, as two real addresses. */
export function HoursTabs({ active }: { active: 'week' | 'team' }) {
  return (
    <Tabs
      label="Hours views"
      active={active}
      tabs={[
        { key: 'week', label: 'My week', href: href('/hours') },
        { key: 'team', label: 'Team hours', href: href('/hours/team') },
      ]}
    />
  );
}
