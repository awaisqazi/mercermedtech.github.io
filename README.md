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
scripts/           the checks listed above, plus make-static-images.mjs
```

### The images with a fixed address

The social card and the JSON-LD logo are read by machines that come back later,
and `/images/logo-modern.png` is an address the old static site published, so
none of them can point at a fingerprinted `/_astro/...` file. They live in
`public/` and are regenerated from `src/assets/images/` with:

```bash
node scripts/make-static-images.mjs
```

Nothing it writes may go over 300 KB. The hero is left out for that reason: as
a PNG at 1024px wide it lands around 380 KB, and a JPEG renamed `.png` is not
an answer.
