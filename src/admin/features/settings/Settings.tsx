/**
 * Placeholder for the Settings screen (Projects and Roles tabs). The feature agent replaces this body; the
 * export name and props are the contract AdminApp relies on.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';

export function Settings({ tab }: { tab: 'projects' | 'roles' }) {
  return (
    <div class="wb-page">
      <PageHeader title="Settings" lead={tab === 'roles' ? 'Roles' : 'Projects'} />
      <EmptyState title="This screen is being built" body="Projects and roles, and what each role allows." />
    </div>
  );
}
