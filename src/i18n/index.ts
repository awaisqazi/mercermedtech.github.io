/**
 * Language plumbing.
 *
 * English is the default locale and lives at the root. Spanish lives under
 * /es/ with the same slugs. Every visible string comes from en.ts or es.ts;
 * nothing is translated at run time and no JavaScript is needed to switch.
 *
 * The check at the bottom of this file runs during the build, so a key that
 * exists in one language and not the other stops the build instead of shipping
 * a half-translated page.
 */
import { en, type Dictionary } from './en';
import { es } from './es';

export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const dictionaries: Record<Locale, Dictionary> = { en, es };

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** HTML lang attribute and Open Graph locale for each language. */
export const localeMeta: Record<Locale, { htmlLang: string; ogLocale: string; hreflang: string }> = {
  en: { htmlLang: 'en', ogLocale: 'en_US', hreflang: 'en' },
  es: { htmlLang: 'es', ogLocale: 'es_US', hreflang: 'es' },
};

/**
 * Turns a language-free path ("/", "/digital-literacy/") into the path for a
 * language. English keeps the plain path, Spanish gets the /es/ prefix.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === '/' ? '/es/' : `/es${clean}`;
}

/** Every language version of one page, for the hreflang tags and the toggle. */
export function alternatePaths(path: string): { locale: Locale; path: string }[] {
  return locales.map((locale) => ({ locale, path: localePath(locale, path) }));
}

/* -------------------------------------------------------------------------
   Build-time guard: the two dictionaries must have the same keys, and no
   string may be empty. A missing translation is a build error.
   ------------------------------------------------------------------------- */
function compare(a: unknown, b: unknown, path: string): string[] {
  const problems: string[] = [];

  if (typeof a === 'string' || typeof b === 'string') {
    if (typeof a !== 'string' || typeof b !== 'string') {
      problems.push(`${path}: one language has a string, the other does not`);
    } else if (!a.trim() || !b.trim()) {
      problems.push(`${path}: empty text`);
    }
    return problems;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      problems.push(`${path}: one language has a list, the other does not`);
      return problems;
    }
    if (a.length !== b.length) {
      problems.push(`${path}: English has ${a.length} items, Spanish has ${b.length}`);
      return problems;
    }
    a.forEach((item, index) => problems.push(...compare(item, b[index], `${path}[${index}]`)));
    return problems;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const inA = key in (a as Record<string, unknown>);
      const inB = key in (b as Record<string, unknown>);
      if (!inA || !inB) {
        problems.push(`${path}.${key}: missing in ${inA ? 'Spanish' : 'English'}`);
        continue;
      }
      problems.push(
        ...compare((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`)
      );
    }
  }

  return problems;
}

const dictionaryProblems = compare(en, es, 'dictionary');
if (dictionaryProblems.length) {
  throw new Error(
    `The English and Spanish wording files do not match:\n  ${dictionaryProblems.join('\n  ')}\n` +
      'Edit src/i18n/en.ts and src/i18n/es.ts together.'
  );
}

export type { Dictionary };
