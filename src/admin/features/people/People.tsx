/**
 * Placeholder for the People directory. The feature agent replaces this body; the
 * export name and props are the contract AdminApp relies on.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';

export function People() {
  return (
    <div class="wb-page">
      <PageHeader title="People" />
      <EmptyState title="This screen is being built" body="Everyone on the team, their role, and invitations." />
    </div>
  );
}
