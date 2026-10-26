/**
 * Every link in the header and the footer, built for one language.
 * English paths have no prefix, Spanish paths start with /es/.
 */
import { localePath, t, type Locale } from './index';

export interface NavLink {
  href: string;
  label: string;
  button?: 'primary' | 'tech';
  icon?: string;
  external?: boolean;
  /** Med or Tech: the colour of the link's underline in the header. */
  track?: 'med' | 'tech';
}

/**
 * @param locale  which language
 * @param absolute  true on pages that are not the homepage, so "#about"
 *                  becomes "/#about" (or "/es/#about") and still resolves
 */
export function homeNav(locale: Locale, absolute = false): NavLink[] {
  const d = t(locale).nav;
  const anchor = (hash: string) => (absolute ? `${localePath(locale, '/')}${hash}` : hash);
  // The logo is the way home, so there is no "Home" link. The two tracks lead;
  // About covers the people too (the #faculty section follows it, and the
  // footer still links to it directly).
  return [
    { href: anchor('#programs-med'), label: d.med, track: 'med' },
    { href: anchor('#programs-tech'), label: d.tech, track: 'tech' },
    { href: anchor('#enroll'), label: d.enroll },
    { href: anchor('#about'), label: d.about },
    { href: anchor('#contact'), label: d.requestInfo, button: 'primary' },
  ];
}

export function dltNav(locale: Locale): NavLink[] {
  const d = t(locale).dltNav;
  // NJDOL rule: the funded page never links to the health care programs, so
  // its header has no Med item. Every link takes the Tech underline.
  return [
    { href: '#qualify', label: d.qualify, track: 'tech' },
    { href: '#learn', label: d.learn, track: 'tech' },
    { href: '#enroll', label: d.enroll, track: 'tech' },
    { href: '#partners', label: d.partners, track: 'tech' },
    { href: '#interest', label: d.interest, button: 'tech' },
  ];
}

export function footerLinks(locale: Locale): NavLink[] {
  const d = t(locale).footer.links;
  const home = localePath(locale, '/');
  return [
    { href: `${home}#hero`, label: d.home },
    { href: `${home}#about`, label: d.about },
    { href: `${home}#programs-med`, label: d.med },
    { href: `${home}#programs-tech`, label: d.tech },
    { href: localePath(locale, '/digital-literacy/'), label: d.dlt },
    { href: `${home}#enroll`, label: d.enroll },
    { href: `${home}#faculty`, label: d.faculty },
    { href: `${home}#contact`, label: d.contact },
  ];
}
