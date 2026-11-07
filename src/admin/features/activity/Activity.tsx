/**
 * Placeholder for the Activity feed. The feature agent replaces this body; the
 * export name and props are the contract AdminApp relies on.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';

export function Activity() {
  return (
    <div class="wb-page">
      <PageHeader title={"Activity"} />
      <EmptyState title="This screen is being built" body="Everything that changed in the workspace, newest first." />
    </div>
  );
}
