/**
 * The placeholder the unfinished grant tabs share.
 *
 * It says what the tab will hold and where the data for it already lives, so
 * the next engineer has the shape in front of them and anyone opening the tab
 * in the meantime is not left guessing.
 */
import { EmptyState } from '../../components/EmptyState';
import { IconSettings } from '../../components/Icons';

export function ComingSoon({ title, what }: { title: string; what: string }) {
  return (
    <section class="wb-panel">
      <header class="wb-panel-head">
        <h2 class="wb-panel-title">{title}</h2>
      </header>
      <EmptyState
        icon={<IconSettings size={22} />}
        title="Coming in the next pass"
        body={what}
      />
    </section>
  );
}
