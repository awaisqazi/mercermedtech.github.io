import { ActivityFeed } from '../../components/ActivityFeed';
import { useProject } from '../../lib/store';
import { href } from '../../lib/router';

export function Activity() {
  const { project } = useProject();
  const slug = project?.slug ?? '';
  return (
    <ActivityFeed
      linkFor={(row) => {
        if (!row.entity_id) return null;
        if (row.entity === 'task') {
          return { href: href(`/p/${slug}/deliverables`, { task: row.entity_id }), label: 'Open' };
        }
        if (row.entity === 'report') return { href: href(`/p/${slug}/reports`), label: 'Reports' };
        if (row.entity === 'partner') return { href: href(`/p/${slug}/partners`), label: 'Partners' };
        return null;
      }}
    />
  );
}
