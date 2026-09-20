// Search-result limits, in BOTH languages.
//
//   <title>            60 characters or fewer
//   meta description  155 characters or fewer
//
// Longer than that and Google cuts the line off mid-sentence, which is how a
// Spanish title ended up reading "Capacitacion de Capacitacion en Habilidades
// Digitales (Digital Litera...". Spanish runs 20 to 25 percent longer than
// English, so the Spanish half is the one that breaks first: this script
// checks every built page, in every language, so it cannot drift back.
//
// Run after `npm run build`:  npm run check:seo
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const DIST = resolve('dist');
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 155;

if (!existsSync(DIST)) {
  console.log('No dist/ folder. Run npm run build first.');
  process.exit(1);
}

const pages = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.html')) pages.push(full);
  }
})(DIST);

/** Redirect stubs kept in public/ are not pages a reader lands on. */
const isRedirectStub = (html) => /<meta\s+http-equiv="refresh"/i.test(html);

/**
 * The staff portal at /admin/ is behind a login and carries
 * noindex,nofollow, so search-result limits do not apply to it: it has a
 * short title and no meta description on purpose.
 */
const isPortal = (page) => relative(DIST, page).startsWith('admin/');

/** Turns the handful of entities Astro escapes back into characters, so the
 *  count is the count a person sees, not the count in the source. */
const decode = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const problems = [];
const rows = [];

for (const page of pages.sort()) {
  const html = readFileSync(page, 'utf8');
  if (isRedirectStub(html) || isPortal(page)) continue;
  const name = `/${relative(DIST, page)}`;

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);

  if (!titleMatch) {
    problems.push(`${name}: no <title>`);
    continue;
  }
  if (!descriptionMatch) {
    problems.push(`${name}: no meta description`);
    continue;
  }

  // [...string] counts characters, not UTF-16 code units, so an accent counts once.
  const title = decode(titleMatch[1].trim());
  const description = decode(descriptionMatch[1].trim());
  const titleLength = [...title].length;
  const descriptionLength = [...description].length;

  rows.push({ name, titleLength, descriptionLength });

  if (titleLength > TITLE_LIMIT) {
    problems.push(`${name}: <title> is ${titleLength} characters, limit ${TITLE_LIMIT}: "${title}"`);
  }
  if (descriptionLength > DESCRIPTION_LIMIT) {
    problems.push(
      `${name}: meta description is ${descriptionLength} characters, limit ${DESCRIPTION_LIMIT}`
    );
  }
}

const pad = (value, width) => String(value).padEnd(width);
const widest = rows.reduce((width, row) => Math.max(width, row.name.length), 4);
console.log(`${pad('page', widest)}  title  description`);
for (const row of rows) {
  console.log(`${pad(row.name, widest)}  ${pad(row.titleLength, 5)}  ${row.descriptionLength}`);
}

console.log(`\nseo check: ${rows.length} page(s), ${problems.length} problem(s).`);
for (const problem of problems) console.log(`  x ${problem}`);
process.exit(problems.length ? 1 : 0);
