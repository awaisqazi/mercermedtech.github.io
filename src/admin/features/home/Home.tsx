/**
 * Placeholder for the Home screen. The feature agent replaces this body; the
 * export name and props are the contract AdminApp relies on.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';

export function Home() {
  return (
    <div class="wb-page">
      <PageHeader title={"Home"} />
      <EmptyState title="This screen is being built" body="Your tasks, your week and what the team did today will be here." />
    </div>
  );
}
