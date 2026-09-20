// Checks every built page in dist/: internal links and assets resolve, #anchors exist,
// ids are unique, JSON-LD parses, and banned strings are absent. Run after `npm run build`.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const DIST = resolve('dist');
const BANNED = [
  /—/,
  /–/,
  /jquery/i,
  /swiper/i,
  /user-scalable=no/i,
  /July 15, 2026/,
  /Summer 2026/,
  // An HTML entity written inside a dictionary or data string gets escaped on
  // the way out and the reader sees "&middot;" instead of "·". Put the real
  // character in the string.
  /&amp;[a-z]+;/,
];
const pages = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) pages.push(p);
  }
})(DIST);

let problems = 0;
const fail = (page, msg) => { problems++; console.log(`✗ ${page.replace(DIST, '')}: ${msg}`); };
const idsOf = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

// The staff portal at /admin/ is a single-page app: its links are hash routes
// (#/projects, #/p/<slug>/<tab>) that only exist once the app has run, so the
// anchor and banned-string rules for marketing pages cannot be applied to it.
const isPortal = (page) => page.replace(DIST, '').startsWith('/admin/');

for (const page of pages) {
  if (isPortal(page)) continue;
  const html = readFileSync(page, 'utf8');
  const ids = idsOf(html);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) fail(page, `duplicate ids: ${[...new Set(dup)].join(', ')}`);

  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { fail(page, `JSON-LD does not parse: ${e.message}`); }
  }
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  for (const re of BANNED) if (re.test(visible)) fail(page, `banned string ${re}`);

  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|#$)/.test(url)) continue;
    const [pathPart, hash] = url.split('#');
    const clean = pathPart.split('?')[0];
    let target = page;
    if (clean) {
      const abs = clean.startsWith('/') ? join(DIST, clean) : join(dirname(page), clean);
      target = existsSync(abs) && statSync(abs).isDirectory() ? join(abs, 'index.html') : abs;
      if (!existsSync(target)) { fail(page, `broken link ${url}`); continue; }
    }
    if (hash && target.endsWith('.html')) {
      const targetIds = target === page ? ids : idsOf(readFileSync(target, 'utf8'));
      if (!targetIds.includes(hash)) fail(page, `missing anchor ${url}`);
    }
  }
}
console.log(`${pages.length} pages checked, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
