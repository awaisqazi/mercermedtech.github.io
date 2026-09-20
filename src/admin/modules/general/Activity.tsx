import { ActivityFeed } from '../../components/ActivityFeed';
import { useProject } from '../../lib/store';
import { href } from '../../lib/router';

export function Activity() {
  const { project } = useProject();
  const slug = project?.slug ?? '';
  return (
    <ActivityFeed
      linkFor={(row) =>
        row.entity === 'task' && row.entity_id
          ? { href: href(`/p/${slug}/tasks`, { task: row.entity_id }), label: 'Open' }
          : null
      }
    />
  );
}
