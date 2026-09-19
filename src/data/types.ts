import type { TrackId } from './site';

/** A piece of text in both languages. Both are required. */
export interface Localized {
  en: string;
  es: string;
}

/** Shorthand used all through programs.ts. */
export function L(en: string, es: string): Localized {
  return { en, es };
}

/**
 * enrolling      = shown as enrolling, may show a start-date line, listed in search-engine course offers
 * announce-soon  = a normal card with its pop-up, but never in an "enrolling" chip or pill, never a date,
 *                  and no course offer in structured data. Its statusLine says when news is coming.
 * coming-soon    = muted "coming soon" card, no pop-up and no detail page
 * hidden         = kept in this file but rendered nowhere (use to retire or park a program)
 */
export type ProgramStatus = 'enrolling' | 'announce-soon' | 'coming-soon' | 'hidden';

export interface DetailSection {
  heading?: string;
  /** Plain paragraphs and/or bullet items, rendered in this order. */
  paragraphs?: string[];
  bullets?: string[];
}

/** The same detail content in both languages. */
export interface LocalizedDetail {
  en: DetailSection[];
  es: DetailSection[];
}

export interface Program {
  /** URL slug: /programs/<id>/ and /es/programs/<id>/ */
  id: string;
  track: TrackId;
  status: ProgramStatus;
  /** Full name. In Spanish, the official English name follows in parentheses. */
  name: Localized;
  /** Short name for cards, chips and the start-date list. */
  shortName: Localized;
  /** Name as it reads in the enrollment chips, when it differs from the name. */
  listName?: Localized;
  /** Name as it reads in the cost table, where the abbreviation helps. */
  tableName?: Localized;
  /** Heading of the pop-up, when it differs from the name. */
  modalTitle?: Localized;
  /** Extra button in the pop-up footer, for example "Ask us about CNA". */
  modalCta?: Localized;
  /** Card button label. Defaults to the dictionary's "See the details". */
  cta?: Localized;
  /** FontAwesome 5 class, for example "fas fa-stethoscope". */
  icon: string;
  /** Small badge on the card, for example "480 Hours". */
  badge?: Localized;
  /** Icon inside that badge. */
  badgeIcon?: string;
  /** A plain number, or wording such as "Varies by plan". */
  hours?: number | Localized;
  length?: Localized;
  /** Dollars. null = no tuition (grant funded). */
  tuition: number | null;
  /** Rendered in place of a dollar amount when tuition is null. */
  tuitionLabel?: Localized;
  tuitionNote?: Localized;
  examFee?: Localized;
  /** The line under the card copy and at the top of the pop-up. */
  statusLine?: Localized;
  /** Sub-line in the pop-up header, for example "CIP: 51.0801 | 480 Hours". */
  modalMeta?: Localized;
  /** Card copy, one or two sentences. */
  summary: Localized;
  /** Program detail content (pop-up and /programs/<id>/ page). */
  detail: LocalizedDetail;
  credential?: { name: Localized; awardedBy?: Localized };
  /** EXACT value the Google Form expects. Never translated. */
  formOption: string;
  /** Set for programs that have their own page instead of a pop-up. */
  href?: string;
  seo?: { description: Localized };
}
