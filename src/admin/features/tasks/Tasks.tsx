/**
 * Placeholder for the Tasks screen. The feature agent replaces this body; the
 * export name and props are the contract AdminApp relies on.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';

export function Tasks() {
  return (
    <div class="wb-page">
      <PageHeader title={"Tasks"} />
      <EmptyState title="This screen is being built" body="Every task, as a list or a board, with a drawer for the detail." />
    </div>
  );
}
