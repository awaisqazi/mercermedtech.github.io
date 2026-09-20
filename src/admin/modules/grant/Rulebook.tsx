/**
 * The rulebook: the documents in the `rulebook` section, rendered as long-form
 * reference with a sticky list of what is on the page. Managers edit a
 * document in place with the block editor, and every document shows where it
 * came from.
 */
import { DocsSection } from '../../components/DocsSection';

export function Rulebook() {
  return (
    <DocsSection
      section="rulebook"
      title="Rulebook"
      intro="What the contract and the rules actually say, in our own words, with a pointer to the original."
      withIndex
      emptyBody="Write down the rules that keep coming up, so nobody has to go back to the contract to answer the same question twice."
    />
  );
}
