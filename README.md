# mercermedtech.com

The Mercer Med Tech website. Built with [Astro](https://astro.build), published
as plain HTML on GitHub Pages. Two languages: English at the root, Spanish
under `/es/`.

## Run it

```bash
npm install     # once
npm run build   # writes the finished site to dist/
npm run preview # look at dist/ in a browser
npm run dev     # live preview while editing
```

Before publishing, run the checks:

```bash
npm run build
npm run check:all   # links, Google Form contract, both languages, parity
```

## Where the words live

| What you want to change | File |
| --- | --- |
| A program: price, hours, start line, description, pop-up text | `src/data/programs.ts` |
| Phone, address, email, licence line, funding sentence | `src/data/site.ts` |
| Everything else on the pages, in English | `src/i18n/en.ts` |
| Everything else on the pages, in Spanish | `src/i18n/es.ts` |
| Header, footer and menu links | `src/i18n/links.ts` |

**Both languages, every time.** English and Spanish are edited together, in the
same change. `src/i18n/en.ts` and `src/i18n/es.ts` must have exactly the same
keys: if one is missing or empty the build stops and tells you which one. Same
for programs, where each piece of wording is written as
`L('English', 'Espanol')`.

### To change a class start date

Open `src/data/programs.ts`, find the program, and edit `statusLine`:

```ts
statusLine: L('Call for the next start date', 'Llame para la proxima fecha de inicio'),
```

That one line feeds the program card, the pop-up, the "when the next groups
start" list, and the program page.

### To take a program off the schedule without deleting it

In the same file, change its `status`:

- `'enrolling'` normal, may be described as enrolling
- `'announce-soon'` the card stays with its status line, never shown as
  enrolling, no start date, no course offer for search engines
- `'coming-soon'` a muted "coming soon" card
- `'hidden'` disappears from the site, stays in the file

### The contact form is an outside contract

The form posts to a Google Form. `formOption` in `programs.ts` must match the
Google Form's dropdown word for word, in English, in both languages: the
Spanish pages show a Spanish label while the value sent to Google stays
English. `npm run check:form` fails the build if one drifts.

## Two languages: how it works

- **Astro's built-in i18n routing** (`i18n` in `astro.config.mjs`) with
  `locales: ['en', 'es']`, `defaultLocale: 'en'` and
  `routing.prefixDefaultLocale: false`, so English keeps the clean URLs and
  Spanish is prefixed.
- **Plain typed TypeScript dictionaries** in `src/i18n/`. `en.ts` defines the
  shape, `es.ts` has to satisfy it, and a guard in `src/i18n/index.ts` compares
  the two during every build.
- **One set of page components.** `src/views/*.astro` render a page in whatever
  language they are handed; `src/pages/` only picks the language:
  `src/pages/index.astro` is `<HomeView locale="en" />` and
  `src/pages/es/index.astro` is `<HomeView locale="es" />`. No duplicated markup.
- **`@astrojs/sitemap` with its `i18n` option**, so the sitemap carries the
  hreflang pairs.

Why not Paraglide/inlang or astro-i18next: both are good when copy comes from
translators through a workflow, or when the language has to change in the
browser. Here the site is small, static, edited by the school itself, and
switches language by loading another page. Typed dictionaries give the same
"a missing translation is a build error" guarantee with no dependency, no
runtime JavaScript and nothing new to learn.

**Pages, per language**

| English | Spanish |
| --- | --- |
| `/` | `/es/` |
| `/digital-literacy/` | `/es/digital-literacy/` |
| `/programs/<id>/` (6 programs) | `/es/programs/<id>/` |

The language switch sits in the header and in the mobile menu, links to the
same page in the other language, and keeps the `#section` you were reading.
Nothing redirects by browser language.

**The error page is the one exception.** GitHub Pages serves `/404.html` for
every unknown address, whatever language the reader was in, so there is only
ever one of it and it carries a short English block and a short Spanish block.
A few lines of script on the page move the Spanish block to the top when the
address asked for started with `/es/`. There is no `/es/404/`.

**Addresses shared before the rebuild keep working.**
`public/digital-literacy.html` sends the old `/digital-literacy.html` link to
`/digital-literacy/`, keeping any `#section` and `?query`, and is never
indexed.

## The staff portal (MMT Workbench)

`/admin/` is a separate thing living in the same repository: a single-page app
(Preact + Supabase) behind a sign-in, English only, `noindex`. It hash-routes
itself (`#/`, `#/p/<slug>/<tab>`) because GitHub Pages cannot rewrite unknown
paths onto one shell, and it is excluded from the bilingual, link and SEO
checks — they are about public pages, and this is a work tool.

No project content, staff names, keys or secrets live in this repository. The
only credential in the code is the Supabase **publishable** key, which is meant
to be shipped to browsers; row level security does the real work, and every
read happens as the signed-in person.

### How it is laid out

The Workbench revolves around one project, the **home project**. `#/` opens
its Plan, and it sits at the top of the left rail with its own sections. Other
projects are folded away under "Other projects" (archived ones behind a second
fold), followed by Today, People and Account.

**Choosing the home project.** An owner or administrator opens the project
and picks **Make this the home project** from the project menu (the `...` at
the end of the header) or from Project settings. That writes
`"primary": true` into the project's `config` and removes it from any other
project; no column or migration is involved. If no project is flagged, the
only active project is home; if there are several, the most recently updated.
The rules live in `src/admin/lib/projects.ts`.

**A project** has one quiet header line (name, status, who is here, About,
the activity bell with a count of what changed since your last visit, and a
menu) and four sections for a grant, two for a general project:

| Address | What it is |
| --- | --- |
| `#/p/<slug>/plan` | Every task, grouped: Needs attention, This week, Next, Later, Done. Filter chips (Mine, Critical, Overdue, Unassigned, workstream, search) and a Board view. `/` searches, `n` adds a task. |
| `#/p/<slug>/reports` | The reporting months as a timeline. |
| `#/p/<slug>/partners` | County coverage and the partner list. |
| `#/p/<slug>/numbers` | Outcomes and budget at a glance; "Edit numbers" opens the full tables. |
| `#/p/<slug>/notes` | General projects only: their notes. |

Detail opens on top of the section, and the address says what is open, so it
can be pasted to a colleague: `?task=<id>`, `?report=<id>` (`&check=1` for
the pre-submission check), `?partner=<id>`, `?about=<section>`,
`?activity=1`, `?edit=outcomes` or `?edit=budget`. The About panel holds what
used to be on the surface: the long description, the contract facts, the
funding sentence, the "about" documents and the Rulebook.

**Addresses from before the redesign still work** and land here:

| Old | New |
| --- | --- |
| `/overview` | `/plan?about=start` (the About panel, on the section you last read) |
| `/deliverables`, `/tasks` | `/plan` |
| `/outcomes` | `/numbers?focus=outcomes` |
| `/budget` | `/numbers?focus=budget` |
| `/rulebook` | `/plan?about=rulebook` |
| `/activity` | `/plan?activity=1` |
| `#/` (old Home) | the home project's Plan; the old Home is now `#/today` |

**Today** (`#/today`) is My work, Due this week (tasks and the next report),
Team (who has been around, what each has open, the last thing each changed)
and Since you were here. Every section draws as soon as its own request
lands; all of them are sent at once (`loadToday` in `src/admin/lib/queries.ts`).

**Starting and importing projects** is rare, so it is in the **Settings** menu
(the gear at the foot of the rail, the project menu, or "More" on a phone),
not on any screen. `#/projects` lists every project.

**Timing a slow load.** Set `localStorage['wb.timing'] = '1'` and reload:
every request the Today and project screens make is printed as
`[wb timing] today.tasks 184 ms (landed 912 ms after the page started)`, and
all of them are kept in `window.__wbTiming`.

### The review demo (`#/demo`)

`/admin/#/demo` runs the whole Workbench against an invented project ("Sample
Grant": about forty tasks, nineteen reports, twelve partners, three people)
with no account and **no network at all**: the Supabase client is swapped for
an in-memory stand-in (`src/admin/demo/`) that answers from a fixture, applies
writes to it, logs activity the way the database trigger does, and replays
changes through a fake realtime channel. Two colleagues are "here", and the
first task you open gets a due-date change from one of them a few seconds
later, so presence and the "someone changed this" toast can be seen. A
ribbon says it is demo data; a reload starts again from the fixture. Nothing
links to it. The fixture is downloaded only by the demo, and like everything
in this public repository it contains nothing real.

### If the Workbench hangs

**What to do, in order.**

1. **Hard reload the page** (`Cmd+Shift+R`). This is the fix, nearly always.
2. **Use one tab.** Two copies of the portal open at once share one session in
   storage and take turns refreshing it. Close the spare.
3. If a screen offers **Try again**, that button re-checks the sign-in before
   it re-reads the data, so it is worth a press before reloading.
4. If it is still stuck, sign out and sign back in. If *that* does not work,
   the problem is not the browser.

**What was wrong, and what the app does about it now.** Every table read in the
portal goes through `supabase.auth.getSession()`, and inside the SDK that waits
on a token refresh that had no time limit of its own. One request that is
neither answered nor refused was therefore enough to stop the whole portal: a
loading skeleton that never resolved, no error, and — the giveaway — no further
requests in the network panel, because they were all queued behind the session.

Safari is where this bit, because Safari suspends in-flight connections when a
tab goes to the background, when a page comes back out of the back-forward
cache, and when the laptop wakes; those requests are left hanging rather than
failed. Chrome fails them quickly, which is why the same build felt fine there.

So now:

- **every request has a ceiling** (15 s) and **every screen load has one**
  (12 s), after which a stall becomes an ordinary error;
- **a load that is still going after four seconds says so** instead of leaving
  a placeholder on screen in silence;
- **Today and the project screen offer Try again**, which re-checks the session
  first, because a stuck session is usually the real problem (on Today each
  part has its own ceiling, so what has arrived stays on screen);
- **a page restored from the back-forward cache re-checks its sign-in and
  rebuilds its realtime channel** rather than trusting what it woke up with;
- **localStorage can refuse** (Safari private browsing, tracking prevention)
  without taking the portal down — the session falls back to memory and lasts
  until the tab closes.

**Not the Web Locks bug.** There is a known Safari deadlock where auth-js left
its `navigator.locks` lock held across a reload. It is not this: auth-js 2.116
coordinates refreshes without a lock and never calls `navigator.locks`, and
`scripts/webkit-smoke.mjs` proves it by holding `lock:wb.auth` for the whole
life of the page while the portal signs in anyway. Do not add the deprecated
`lock` option to `src/admin/lib/supabase.ts` to "fix" this — it would switch
the old lock path back on.

### Testing it in real WebKit

Chromium is not Safari, so there is a smoke test that drives the actual engine
Safari ships, next to Chromium, on the built site:

```bash
npx --yes playwright@latest install webkit chromium   # once, ~500 MB
npm i --no-save playwright                            # once; not a dependency
node scripts/webkit-smoke.mjs                         # builds, serves, drives
```

It checks that the sign-in screen paints within five seconds, holds the Web
Lock described above, and — the important two — stalls the token endpoint and
then the REST endpoint and insists the app still reaches a screen somebody can
act on. It also counts frames while the loading skeleton is up.

The `demo-screens` scenario drives the signed-in screens through `#/demo`
(Today, Plan, a task, the Board, Reports, a report, Partners, a partner,
Numbers and its editors, About, the activity drawer, the rail and the menus)
at 1280×900 and 390×844, and fails if any of them is missing, if the page
throws, or if a single request reaches Supabase. Add `--screens=<folder>` to
keep a screenshot of each:

```bash
node scripts/webkit-smoke.mjs --only=demo-screens --screens=/tmp/workbench
```

It **cannot sign in**: there are no credentials in this repository and none
should be added. Real project data, the real realtime channel and two real
people editing at once are still only ever tested by hand, in Safari, signed
in.

## How deploying works

`.github/workflows/deploy.yml` builds the site with
[withastro/action](https://github.com/withastro/action) and publishes it with
`actions/deploy-pages` on every push to `main`, and on demand from the Actions
tab. `public/CNAME` keeps the custom domain.

> **Before the first merge to `main`:** in the repository settings, open
> **Settings -> Pages -> Build and deployment** and change **Source** from
> "Deploy from a branch" to **GitHub Actions**. The old `index.html` no longer
> exists at the root of the repository, so until that setting is changed the
> live site will break.

## Layout of the project

```
public/            served as-is: CNAME, favicon, FontAwesome, the legacy
                   redirect, and the images that need a fixed address
                   (og-image.png, images/logo-modern.png)
src/assets/images/ images that Astro optimizes
src/data/          programs, school facts, structured data
src/i18n/          en.ts, es.ts, the locale helpers and the link lists
src/styles/        tokens.css, base.css, components/*.css
src/components/    one job each: header, footer, cards, form, pop-ups
src/views/         one page, in whichever language it is handed
src/pages/         the routes, English at the root and Spanish under /es/
src/admin/         the staff portal: its own app, styles, data store and
                   Supabase client, mounted only at /admin/
scripts/           the checks listed above, plus make-static-images.mjs and
                   webkit-smoke.mjs (the real-WebKit test for the portal)
```

### The images with a fixed address

The social card and the JSON-LD logo are read by machines that come back later,
and `/images/logo-modern.png` is an address the old static site published, so
none of them can point at a fingerprinted `/_astro/...` file. They live in
`public/` and are regenerated from `src/assets/images/` with:

```bash
node scripts/make-static-images.mjs
```

Nothing it writes may go over 300 KB. Homepage photography stays in
`src/assets/images/`, where Astro can resize and optimize it for each layout.
