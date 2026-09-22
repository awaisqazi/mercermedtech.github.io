// Compares the built English pages with the static site they replace, so a
// sentence cannot go missing in the move to Astro.
//
// scripts/.baseline/ holds a copy of the last static index.html and
// digital-literacy.html. This script pulls the visible sentences out of both
// sides, normalises the whitespace, and reports baseline sentences that are
// not in the build.
//
// Run after `npm run build`:  npm run check:parity
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PAIRS = [
  { name: 'home', baseline: 'scripts/.baseline/index.html', built: 'dist/index.html' },
  {
    name: 'digital literacy',
    baseline: 'scripts/.baseline/digital-literacy.html',
    built: 'dist/digital-literacy/index.html',
    /**
     * The old page carried a short Spanish summary inside <div class="dl-es">.
     * The owner asked for that block to go: Spanish is now a full set of pages
     * under /es/, so the summary is dropped here on purpose.
     */
    dropBlocks: [/<div class="dl-es"[\s\S]*?<\/div>\s*<\/div>/],
  },
];

/**
 * Sentences that are deliberately NOT in the new build, with the reason.
 * Anything else that goes missing is a problem to fix.
 */
const EXPECTED_MISSES = [
  {
    match: /en espa/i,
    why: 'the Spanish summary block was replaced by full Spanish pages under /es/',
  },
  {
    match: /^(si usted|el programa dura|no necesita|tambi|seg|clases de computa|qui|sesiones informativas)/i,
    why: 'Spanish copy now lives on /es/digital-literacy/',
  },
  {
    match: /google form|pre-filled|formResponse|entry\.|TODO/i,
    why: 'developer comment in the old file, not visible copy',
  },
  {
    match: /^168 Franklin Corner Rd, Bldg 2, Suite #140, Lawrenceville, NJ 08648\.$/,
    why: 'the footer address is still there; it now sits in its own span beside the phone and email, without the trailing full stop that used to glue the three together',
  },
  {
    match: /^(swipe to see more|see the details|put me on the list)$/i,
    why: 'button label, still present in the build in the same words',
  },
  {
    match: /^(Mercer Med Tech \| Health Care and Computer Skills Training in Lawrenceville, NJ|Digital Literacy Training \| Free Computer and AI Classes \| Mercer Med Tech)$/,
    why: 'the old <title> was 78 and 74 characters; titles are now capped at 60 by npm run check:seo',
  },
];

const visibleSentences = (html) => {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&times;/g, '×')
    .replace(/&copy;/g, '©')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 12)
    .filter((line) => /[a-z]/i.test(line));
};

let problems = 0;

for (const pair of PAIRS) {
  const baselinePath = resolve(pair.baseline);
  const builtPath = resolve(pair.built);
  if (!existsSync(baselinePath)) {
    console.log(`  ! no baseline for ${pair.name} at ${pair.baseline}`);
    continue;
  }
  if (!existsSync(builtPath)) {
    console.log(`  x no built page for ${pair.name} at ${pair.built}`);
    problems += 1;
    continue;
  }

  let baselineHtml = readFileSync(baselinePath, 'utf8');
  for (const block of pair.dropBlocks ?? []) baselineHtml = baselineHtml.replace(block, ' ');
  const baseline = visibleSentences(baselineHtml);
  const built = visibleSentences(readFileSync(builtPath, 'utf8')).join('\n');

  const missing = [];
  for (const sentence of baseline) {
    if (built.includes(sentence)) continue;
    const expected = EXPECTED_MISSES.find((rule) => rule.match.test(sentence));
    if (expected) continue;
    missing.push(sentence);
  }

  console.log(`\n${pair.name}: ${baseline.length} baseline sentence(s), ${missing.length} missing.`);
  for (const sentence of missing) {
    console.log(`  x ${sentence.slice(0, 140)}`);
    problems += 1;
  }
}

console.log(`\nparity: ${problems} unexplained difference(s).`);
process.exit(problems ? 1 : 0);
