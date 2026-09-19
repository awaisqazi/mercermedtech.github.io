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
}

/**
 * @param locale  which language
 * @param absolute  true on pages that are not the homepage, so "#about"
 *                  becomes "/#about" (or "/es/#about") and still resolves
 */
export function homeNav(locale: Locale, absolute = false): NavLink[] {
  const d = t(locale).nav;
  const anchor = (hash: string) => (absolute ? `${localePath(locale, '/')}${hash}` : hash);
  return [
    { href: anchor('#hero'), label: d.home },
    { href: anchor('#about'), label: d.about },
    { href: anchor('#programs-med'), label: d.med },
    { href: anchor('#programs-tech'), label: d.tech },
    { href: anchor('#enroll'), label: d.enroll },
    { href: anchor('#faculty'), label: d.faculty },
    { href: anchor('#contact'), label: d.requestInfo, button: 'primary' },
  ];
}

export function dltNav(locale: Locale): NavLink[] {
  const d = t(locale).dltNav;
  return [
    { href: '#qualify', label: d.qualify },
    { href: '#learn', label: d.learn },
    { href: '#enroll', label: d.enroll },
    { href: '#partners', label: d.partners },
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
