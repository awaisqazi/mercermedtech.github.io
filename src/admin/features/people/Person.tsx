/**
 * Placeholder for the person page. The feature agent replaces this body; the
 * export name and props are the contract AdminApp relies on.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';

export function Person({ id }: { id: string }) {
  return (
    <div class="wb-page" data-person={id}>
      <PageHeader title="Person" />
      <EmptyState title="This screen is being built" body="One person: their role, open tasks and recent hours." />
    </div>
  );
}
