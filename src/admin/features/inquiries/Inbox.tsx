/**
 * Placeholder for the Inbox (the public forms' responses). The feature agent replaces this body; the
 * export name and props are the contract AdminApp relies on.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';

export function Inbox() {
  return (
    <div class="wb-page">
      <PageHeader title={"Inbox"} />
      <EmptyState title="This screen is being built" body="Responses from the public forms, to follow up and close." />
    </div>
  );
}
