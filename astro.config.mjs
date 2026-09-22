// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';

// The site is bilingual. English lives at the root (/, /digital-literacy/,
// /programs/<id>/) and Spanish under /es/ with the same slugs. Astro's built-in
// i18n routing gives us the URL helpers and keeps the default locale unprefixed;
// the wording itself lives in src/i18n/en.ts and src/i18n/es.ts.
// https://docs.astro.build/en/guides/internationalization/
export default defineConfig({
  site: 'https://www.mercermedtech.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en-US', es: 'es-US' },
      },
      // Two kinds of page stay out of the sitemap.
      //   /admin/      the staff portal, a private login-protected tool that
      //                carries noindex,nofollow.
      //   .../sign-up/ the Digital Literacy sign-up page, in both languages.
      //                It is noindex and nothing links to it: the address is
      //                handed out directly to partners and to people who ask.
      //   /partners/   one outreach kit page per partner agency, also noindex
      //                and also unlinked. The address is emailed to the agency.
      filter: (page) => {
        const { pathname } = new URL(page);
        return (
          !pathname.startsWith('/admin') &&
          !pathname.includes('/sign-up') &&
          !pathname.includes('/partners/')
        );
      },
    }),
    // Preact powers the /admin/ portal only. The public marketing pages stay
    // plain Astro, so nothing here ships to them.
    preact(),
  ],
});
