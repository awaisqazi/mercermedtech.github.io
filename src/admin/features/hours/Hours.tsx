/**
 * Placeholder for the Hours screen (My week and Team tabs). The feature agent replaces this body; the
 * export name and props are the contract AdminApp relies on.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';

export function Hours({ tab }: { tab: 'week' | 'team' }) {
  return (
    <div class="wb-page">
      <PageHeader title={tab === 'team' ? 'Team hours' : 'Hours'} />
      <EmptyState title="This screen is being built" body="Log your hours and see the week. The team view shows everyone." />
    </div>
  );
}
