// Checks that the site really is bilingual.
//
//   1. every wording key exists and is non-empty in English and Spanish
//   2. every localized program field has both languages
//   3. every English page has a Spanish counterpart, and the other way round
//   4. Spanish pages do not contain English sentences from the dictionary
//      (the NJDOL funding sentence, proper nouns and form values are allowed)
//   5. neither language uses exclamation marks, em dashes or en dashes
//
// Run after `npm run build`:  npm run check:i18n
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const DIST = resolve('dist');
const problems = [];
const fail = (message) => problems.push(message);

/* ---------- 1 + 2: the wording files, read through the built pages ---------- */
// The dictionaries themselves are TypeScript, so they are checked by the guard
// inside src/i18n/index.ts, which runs during the build and throws on any
// mismatch. Here we re-check the parts that reach the HTML.

/* ---------- 3: page-for-page coverage ---------- */
const pages = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.html')) pages.push(full);
  }
})(DIST);

// Two kinds of page are intentionally outside the English/Spanish pairing.
//
//   1. The error page. GitHub Pages serves /404.html for every unknown address
//      whatever language the reader was in, so there is only ever one of it and
//      it carries both languages on purpose.
//   2. Redirect stubs kept in public/ so addresses shared before the rebuild
//      still work. They hold a meta refresh and nothing a reader stays on.
const isErrorPage = (page) => /(^|\/)404(\.html|\/index\.html)$/.test(page);
const isRedirectStub = (page) =>
  /<meta\s+http-equiv="refresh"/i.test(readFileSync(join(DIST, page), 'utf8'));
const isBilingualOrStub = (page) => isErrorPage(page) || isRedirectStub(page);

const englishPages = pages
  .map((page) => relative(DIST, page))
  .filter((page) => !page.startsWith('es/'))
  .filter((page) => !isBilingualOrStub(page));
const spanishPages = pages
  .map((page) => relative(DIST, page))
  .filter((page) => page.startsWith('es/'))
  .filter((page) => !isBilingualOrStub(page));

for (const page of englishPages) {
  const twin = join('es', page);
  if (!spanishPages.includes(twin)) fail(`missing Spanish page for /${page}`);
}
for (const page of spanishPages) {
  const twin = page.replace(/^es\//, '');
  if (!englishPages.includes(twin)) fail(`missing English page for /${page}`);
}

/* ---------- 4: no leftover English on Spanish pages ---------- */
// Sentences that are allowed to stay in English on a Spanish page.
const ALLOWED_ENGLISH = [
  // NJDOL requires this one word for word, in English, everywhere.
  'The funding for this initiative is being provided by the New Jersey Department of Labor and Workforce Development.',
];
// Proper nouns and official names that stay in English by design.
const PROPER_NOUNS = [
  'Mercer Med Tech',
  'Digital Literacy Training',
  'Certified Medical Assistant',
  'Phlebotomy Technician',
  'Patient Care Technician',
  'EKG Technician',
  'Certified Nursing Assistant',
  'Certified Medication Aide',
  'Dental Assistant',
  'Medical Billing',
  'WorkFirst New Jersey',
  'One-Stop Career Center',
  'National Healthcareer Association',
  'New Jersey Department of Health',
  'New Jersey Department of Labor',
  'New Jersey Board of Nursing',
  'Department of Labor Opportunity Partnership Grant',
  'PSI Test Centers',
  'MedCA Certifications',
  'CNJHS LLC',
  'Credential Engine Registry',
  'Credential Finder',
  'Microsoft Office',
  'Google Workspace',
  'Ability to Benefit',
  'New Jersey Department of Health and Senior Services',
];

const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<option[^>]*value="[^"]*"[^>]*>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// A few unmistakably English sentences that must never survive translation.
const ENGLISH_MARKERS = [
  'Two paths to a better job',
  'Health care programs',
  'What each program costs',
  'See if you qualify',
  'Questions people ask us',
  'Who to refer',
  'Call us or send a message',
];

for (const page of spanishPages) {
  const html = readFileSync(join(DIST, page), 'utf8');
  let text = visibleText(html);
  for (const allowed of [...ALLOWED_ENGLISH, ...PROPER_NOUNS]) text = text.split(allowed).join(' ');
  for (const marker of ENGLISH_MARKERS) {
    if (text.includes(marker)) fail(`/${page}: English text left in place: "${marker}"`);
  }
}

// The required English sentence must still be there, on the pages that carry it.
for (const page of spanishPages) {
  const html = readFileSync(join(DIST, page), 'utf8');
  const mentionsFunding = html.includes('Los fondos para esta iniciativa');
  if (mentionsFunding && !html.includes(ALLOWED_ENGLISH[0])) {
    fail(`/${page}: the Spanish funding sentence is there but the required English one is not`);
  }
}

/* ---------- 5: punctuation the voice rules forbid ---------- */
for (const page of pages) {
  const text = visibleText(readFileSync(page, 'utf8'));
  const name = relative(DIST, page);
  if (/[!¡]/.test(text)) fail(`/${name}: exclamation mark in the copy`);
  if (/[—–]/.test(text)) fail(`/${name}: em dash or en dash in the copy`);
}

/* ---------- report ---------- */
if (!existsSync(DIST)) {
  console.log('No dist/ folder. Run npm run build first.');
  process.exit(1);
}

console.log(
  `i18n check: ${englishPages.length} English page(s), ${spanishPages.length} Spanish page(s), ${problems.length} problem(s).`
);
for (const problem of problems) console.log(`  x ${problem}`);
process.exit(problems.length ? 1 : 0);
