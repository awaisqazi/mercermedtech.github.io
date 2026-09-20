/**
 * Notes for a general project: documents in the `notes` section, edited with
 * the block editor.
 */
import { DocsSection } from '../../components/DocsSection';

export function Notes() {
  return (
    <DocsSection
      section="notes"
      title="Notes"
      intro="Decisions, how-tos and anything worth writing down once instead of explaining twice."
      withIndex
    />
  );
}
