/**
 * Structured data (the blocks search engines read). Everything here is built
 * from site.ts and programs.ts, so a change in those files reaches Google too.
 * Only programs with status "enrolling" are listed as offers.
 */
import { site, dlt } from './site';
import { enrollingPrograms, timeRequired } from './programs';
import type { Program } from './types';
import { localeMeta, localePath, type Locale } from '../i18n';

const provider = {
  '@type': 'EducationalOrganization',
  name: site.name,
};

const postalAddress = {
  '@type': 'PostalAddress',
  streetAddress: site.address.street,
  addressLocality: site.address.city,
  addressRegion: site.address.region,
  postalCode: site.address.postalCode,
  addressCountry: site.address.country,
};

export interface OrganizationOptions {
  locale: Locale;
  description: string;
  catalogName: string;
  /** Absolute URLs, built from the optimized images at render time. */
  logo: string;
  image: string;
  /** Longer catalog descriptions, keyed by program id. */
  catalogDescriptions?: Record<string, string>;
}

export function organizationJsonLd(options: OrganizationOptions) {
  return {
    '@context': 'https://schema.org',
    '@type': ['EducationalOrganization', 'LocalBusiness'],
    name: site.name,
    inLanguage: localeMeta[options.locale].htmlLang,
    alternateName: site.shortName,
    description: options.description,
    url: `${site.url}/`,
    logo: options.logo,
    image: options.image,
    telephone: site.phone.e164,
    email: site.email,
    priceRange: '$$',
    address: postalAddress,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: site.geo.latitude,
      longitude: site.geo.longitude,
    },
    sameAs: [site.social.facebook, site.credentialFinderUrl],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: options.catalogName,
      itemListElement: enrollingPrograms.map((program) => {
        const free = program.tuition === null;
        const description = options.catalogDescriptions?.[program.id];
        return {
          '@type': 'Course',
          name: (program.tableName ?? program.name)[options.locale],
          ...(description ? { description } : {}),
          provider,
          ...(free ? { isAccessibleForFree: true } : {}),
          offers: {
            '@type': 'Offer',
            price: program.tuition ?? 0,
            priceCurrency: 'USD',
          },
        };
      }),
    },
  };
}

/** One program page. Programs that are not enrolling carry no Offer. */
export function programCourseJsonLd(program: Program, pageUrl: string, locale: Locale) {
  const duration = timeRequired(program);
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: program.name[locale],
    description: (program.seo?.description ?? program.summary)[locale],
    url: pageUrl,
    inLanguage: localeMeta[locale].htmlLang,
    provider: {
      ...provider,
      url: `${site.url}/`,
      telephone: site.phone.e164,
      email: site.email,
      address: postalAddress,
    },
    ...(duration ? { timeRequired: duration } : {}),
    ...(program.credential ? { educationalCredentialAwarded: program.credential.name[locale] } : {}),
    ...(program.status === 'enrolling' && program.tuition !== null
      ? {
          offers: {
            '@type': 'Offer',
            price: program.tuition,
            priceCurrency: 'USD',
            category: 'Tuition',
          },
        }
      : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path, site.url).href,
    })),
  };
}

export function dltCourseJsonLd(description: string, locale: Locale, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    description,
    url: new URL(localePath(locale, dlt.path), site.url).href,
    inLanguage: ['en', 'es'],
    isAccessibleForFree: true,
    provider: {
      ...provider,
      url: `${site.url}/`,
      telephone: site.phone.e164,
      email: site.email,
      address: postalAddress,
    },
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD',
      category: 'Free',
      availability: 'https://schema.org/InStock',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'onsite',
      courseWorkload: 'P5W',
      location: {
        '@type': 'Place',
        name: site.name,
        address: postalAddress,
      },
    },
  };
}

export function faqJsonLd(items: { question: string; answer: string }[], locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: localeMeta[locale].htmlLang,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
