# Mercer Med Tech — Brand Identity & Design System

A reference for anyone designing, writing, or building for mercermedtech.com.
The goal is a high-trust, modern, approachable experience that feels closer to a
healthcare-tech product than a traditional vocational school site.

---

## 1. Brand Essence

**Who we are.** Mercer Med Tech, Inc. (MMT) is a state-approved private
vocational school in Lawrenceville, NJ, licensed by the New Jersey Department
of Labor & Workforce Development. We turn motivated people into certified
healthcare professionals through hands-on instruction, small classes, and
real-world clinical experience.

**Personality.** Warm, confident, modern, practical. We sound like a great
academic advisor: knowledgeable but never stiff, encouraging but never hype-y.

**Promise.** Real instructors, real skills, real careers. No fluff.

### Brand pillars

1. **Practical mastery.** Every program is hands-on and certification-ready.
2. **Personal attention.** Small class sizes, mentor-style faculty.
3. **Career launchpad.** We exist to get students into jobs, not into more debt.
4. **Modern medicine, modern training.** Clean tech, current data, BLS-backed
   outcomes.
5. **Accessible support.** Bilingual (English/Spanish) staff, evening classes,
   on-site placement assistance, WIA-eligible programs, and an accessible
   facility.

### Voice & tone

- **Do:** short sentences, plain words, direct verbs. "Hands-on training."
  "Talk to an advisor." "Seats are limited."
- **Don't:** corporate jargon, exclamation marks, hype, em-dashes, three-word
  alliterative slogans.
- **Pronouns.** "You" addresses the prospective student. "We" is MMT. Avoid
  third-person business-speak ("the institution provides...").
- **Numbers.** Keep them concrete and cited (BLS, NHA, school catalog). Never
  invent statistics.
- **Punctuation.** No em-dashes (`—`) or en-dashes (`–`). Use commas, periods,
  parentheses, or "to" as appropriate. Use the Oxford comma.

### Source-of-truth hierarchy

When facts conflict, trust sources in this order:

1. The current school **catalog** (programs, hours, tuition, calendar, policies).
2. **Google Business Profile** (address, phone, hours as displayed in Maps).
3. **BLS / NHA** (salary expectations and outlook).
4. The **website** (which should reflect 1–3, not contradict them).

---

## 2. Color System

The brand is built on a single hero color (medical teal) with neutral surfaces
and a complementary accent for gradients and highlights.

| Token              | Hex       | Use                                          |
| ------------------ | --------- | -------------------------------------------- |
| `--primary`        | `#00A69C` | Brand teal. Buttons, links, focus, accents.  |
| `--primary-dark`   | `#007D75` | Hover states, gradient endpoint, emphasis.   |
| `--primary-light`  | `#E0F7F6` | Soft tints, card backgrounds, secondary btn. |
| `--accent`         | `#20C997` | Gradient companion, success states.          |
| `--accent-hover`   | `#008C82` | Darker accent variant.                       |
| `--surface-1`      | `#FFFFFF` | Default page background.                     |
| `--surface-2`      | `#F0F4F8` | Section dividers, inputs, subtle bands.      |
| `--surface-3`      | `#E2E8F0` | Tertiary surfaces, chip backgrounds.         |
| `--text-main`      | `#1E293B` | Body text, headlines.                        |
| `--text-muted`     | `#64748B` | Supporting copy.                             |
| `--text-light`     | `#94A3B8` | Hint text, eyebrow labels.                   |
| `--border`         | `#CBD5E1` | Default 1px border.                          |

### Signature gradient

`linear-gradient(135deg, #00A69C 0%, #20C997 100%)`

Used sparingly: hero accent text, primary button, badge backgrounds. Never as
a full-section background (it competes with content).

### Accessibility

- Body text on white: AA+ contrast (`#1E293B` on `#FFFFFF`).
- Primary teal on white: AA for large/UI; pair with text size ≥ 16px or weight
  ≥ 600 for body. For long-form text, prefer `--text-main`.
- Never use `--text-light` for anything below 14px or for actionable elements.

---

## 3. Typography

| Use                | Family              | Weight    |
| ------------------ | ------------------- | --------- |
| Headings (H1–H4)   | Outfit              | 600–800   |
| Body / UI          | Plus Jakarta Sans   | 400–700   |
| Numbers / labels   | Plus Jakarta Sans   | 600       |
| Tabular numbers    | (any) `font-variant-numeric: tabular-nums` |

### Scale

- **H1:** `clamp(2.25rem, 5vw, 3.5rem)`, line-height 1.15, letter-spacing -0.02em
- **H2 (section title):** 2.5rem, line-height 1.2
- **H3:** 1.25rem
- **Body:** 1rem / 1.6 line-height
- **Lead body:** 1.125rem (hero copy, intros)
- **Small / meta:** 0.875rem
- **Eyebrow / label:** 0.78rem, uppercase, letter-spacing 0.08em, weight 700

### Rules

- One H1 per page, used in the hero.
- Use `text-gradient` only on a single keyword or short phrase per heading,
  never on whole sentences.
- Avoid uppercase for paragraph text. Reserve uppercase for buttons (existing
  pattern), eyebrows, and chip labels.
- Line length for body copy: target 50–75 characters (`max-width: 56ch`–`64ch`).
- Use tabular-nums on tables, pricing, and any aligned numeric column.

---

## 4. Layout & Spacing

- **Container:** max 1280px, padding `0 2rem` (1rem on small mobile).
- **Section padding:** 8rem desktop / 4.5rem mobile.
- **Vertical rhythm:** prefer multiples of `0.25rem` (4px). Common gaps:
  `0.5 / 0.75 / 1 / 1.5 / 2 / 2.5 / 3 / 4rem`.
- **Grid:** prefer `auto-fit, minmax(220–300px, 1fr)` for card grids so they
  reflow naturally on mid-sized viewports without bespoke breakpoints.
- **Radius:**
  - `--radius-sm` 8px, inputs, small chips
  - `--radius-md` 16px, cards
  - `--radius-lg` 24px, hero images, modals, the announcement card
  - `--radius-full` 9999px, pills, buttons, badges
- **Shadow:** kept soft and tinted. Default form is
  `0 20px 40px rgba(0,0,0,0.1)` for content cards; teal-tinted
  `0 25px 60px -15px rgba(0,166,156,0.18)` for brand-glass surfaces.

---

## 5. Page Structure (canonical)

The home page is one long scroll, in this order. Anchor IDs are nav targets.

1. `#hero` — Hero with primary CTA (Programs) and secondary CTA (Request Info)
2. `#enroll` — Now Enrolling announcement card with **Term Schedule** panel
3. `#about` — Brand story and state-approval credentials
4. `#programs` — 7-card carousel of all training programs
5. `#tuition` — Tuition at a Glance table
6. `#why` — 8-card "Why Mercer Med Tech" + Admissions Requirements block
7. `#grants` — Financial aid and loan information
8. `#faculty` — Meet Our Team (Director, Bursar)
9. `#organizations` — Affiliated organizations marquee
10. `#contact` — Request Info form (wired to Google Forms)
11. `#footer` — Site footer (NAP, social)

Plus a fixed floating "Call Now" CTA on mobile.

---

## 6. Components

### Buttons

- **Primary:** gradient teal background, white text, full radius, uppercase,
  letter-spacing 0.02em. Lift `-3px` on hover.
- **Secondary:** white background, 2px primary border, primary text. Light teal
  fill on hover.
- **Min target:** 48px tall on mobile to meet tap-target accessibility.
- **Icons:** keep optional, always paired with text. Use Font Awesome 5/6 free
  set already loaded in the page.

### Glass / brand cards

The "liquid teal glass" treatment is reserved for **brand-defining moments**:

- Now Enrolling announcement (`.enroll-card`)
- Contact form card (`.contact-card`)
- Admissions Requirements block (`.admissions-block`)
- Program modals (`.modal-content`)

Recipe:

```css
background: linear-gradient(135deg,
    rgba(255,255,255,0.92) 0%,
    rgba(224,247,246,0.78) 50%,
    rgba(255,255,255,0.92) 100%);
backdrop-filter: blur(28px) saturate(180%);
border: 1px solid rgba(0,166,156,0.18-0.25);
box-shadow:
    0 0 0 1px rgba(255,255,255,0.5) inset,
    0 25px 60px -15px rgba(0,166,156,0.18);
```

Don't apply this to every card. Standard cards stay on `--surface-1` with
neutral borders.

### Standard cards

Used for "Why MMT" value props, faculty cards, and similar repeated content:

```css
background: var(--surface-1);
border: 1px solid rgba(0, 166, 156, 0.12);
border-radius: var(--radius-md);
padding: 1.75rem 1.5rem;
hover: translateY(-4px) + teal-tinted shadow.
```

### Term Schedule panel

A 4-column grid of term start dates inside the announcement card. The current
or next-upcoming term is highlighted with a `.term-current` modifier
(teal-tinted background + shadow). Wraps to 2 columns on phones.

### Tuition table

A real `<table>` with `<thead>` and `<tbody>`, semantic `<th scope="row">` for
program names, and `data-label` attributes on each `<td>` for the mobile
card-style layout. Numeric column right-aligned with tabular-nums. On screens
≤ 720px, rows reflow into stacked cards.

Always include a `<caption class="visually-hidden">` for screen readers.

### Forms

- Inputs: 0.85rem 1rem padding, 1px neutral border, 8px radius.
- Focus: 1px primary border + 4px `rgba(0,166,156,0.15)` ring. Never strip
  `:focus-visible` outlines.
- Labels live above inputs (never placeholder-only). Required fields marked
  with `*` in primary color.
- Selects use a custom inline SVG chevron (slate gray) and matching padding.
- Show a friendly inline success state (`.form-success`) rather than redirects.
- **Google Forms wiring:** action URL points to a Google Form's `formResponse`
  endpoint, `target="hidden_form_iframe"` keeps the visitor on the page,
  and JS sets an `isSubmitting` flag on submit + a 4 second safety timeout
  so the success state always resolves even if the cross-origin iframe load
  event is unreliable.

### Badges & pills

- **"Now Enrolling" badge:** gradient fill, white text, uppercase, tiny pulse
  dot animation. One per page maximum.
- **Eyebrow chip / pill badge:** `--primary-light` background, primary-dark
  text, small.

### Floating Mobile Call CTA

- Fixed bottom-right, mobile only (≤768px).
- Gradient pill, 48px+ tall, calls `tel:+16097125499` directly.
- Always visible. Respects safe-area insets.

---

## 7. Motion

- **Default easing:** `cubic-bezier(0.215, 0.61, 0.355, 1)` (`--ease-out`).
- **Spring (gentle):** `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Spring (bounce):** `cubic-bezier(0.34, 1.56, 0.64, 1)`, reserved for
  modal/success entrances.
- **Standard durations:** 200-300ms (UI), 400-500ms (modal), 8s (ambient
  shimmer).
- **Hover lift:** `translateY(-3px)` for buttons, `-4px` for standard cards,
  `-8px` for prominent cards.
- Always honor `@media (prefers-reduced-motion: reduce)`, disable shimmer,
  pulse, and parallax effects.

---

## 8. Iconography & Imagery

- **Icons:** Font Awesome free, solid style. Sized 1rem-1.5rem inside chips/
  badges. Always `aria-hidden="true"` when paired with text.
- **Imagery:** clean, well-lit, real-people-focused photography of healthcare
  training. Avoid stocky "doctor in lab coat smiling at camera" tropes when
  possible.
- **Logo:** `images/logo-modern.png`. Inverts to white on dark surfaces via
  `filter: brightness(0) invert(1);`. Maintain ≥ 24px clearspace on all sides.

---

## 9. Accessibility Standards

- All interactive elements reachable by keyboard (`Tab`).
- `:focus-visible` outline of 2px primary, 3px offset, never removed.
- Form inputs use implicit labels (label wraps input) for assistive tech.
- Decorative icons use `aria-hidden="true"`.
- All informative images have `alt` text.
- Color is never the sole carrier of information (e.g. required fields show a
  `*` and `required` attribute, not just color).
- Tap targets ≥ 44×44 px on mobile.
- Tables include `<caption>` (visually hidden if styled visually).
- Honor `prefers-reduced-motion`.

---

## 10. SEO & Local Search

- Title pattern: `Mercer Med Tech | <Specific> in Lawrenceville, NJ`.
- Every page has `meta description`, `canonical`, Open Graph, and Twitter Card
  tags.
- One JSON-LD `EducationalOrganization` + `LocalBusiness` block in `<head>`
  with full postal address, phone, email, geo, opening hours, and a course
  catalog covering all 7 programs. Update this whenever address, phone,
  program list, or hours change.
- `openingHoursSpecification` reflects catalog hours (Mon-Fri 8:00-21:00,
  Sat 8:30-14:00).
- Google Business Profile is the source of truth for the address Google shows
  in Maps and the knowledge panel, keep it in sync with the site.
- Maintain NAP (Name / Address / Phone) consistency across the site, GBP,
  Facebook, and any directories. Inconsistent NAP hurts local rankings.
- Run Google's Rich Results Test after any JSON-LD edit.

---

## 11. Privacy & Personal Information

- **Public phones on the site:** main school line `(609) 712-5499` only.
  Individual staff direct lines (e.g. the bursar's line) are never published
  on the marketing site, even on faculty cards.
- The contact form posts to a Google Form owned by the school. Do not embed
  third-party trackers, pixels, or analytics scripts without explicit
  approval. Do not request a date of birth, SSN, or financial data from the
  marketing form, that belongs in the Enrollment Agreement.

---

## 12. Editorial Voice Cheat Sheet

| Avoid                                          | Prefer                                          |
| ---------------------------------------------- | ----------------------------------------------- |
| "We cater to a diverse range of clients"       | "We train students to work in real clinics."    |
| "Empowering the next generation"               | "Real instructors, real skills, real careers." |
| "Synergies / leverage / utilize"               | "Use." "Work with." "Make."                     |
| "Limited spots remaining!!!"                   | "Seats are limited. Enroll early."              |
| Em-dashes (`—`) or en-dashes (`–`)             | Periods, commas, parentheses, or "to".          |
| Generic stock metaphors ("unlock your future") | Concrete outcomes ("get certified in 12 weeks") |
| Unsubstantiated salary claims                  | BLS-cited ranges with a published basis.        |

---

## 13. Implementation Checklist for New Pages / Sections

- [ ] One `H1` per page, in the hero.
- [ ] Section uses `.container` for horizontal alignment.
- [ ] Section padding is `section-padding` (8rem / 4.5rem mobile) unless an
      intentional override.
- [ ] Buttons use `.btn .btn-primary` or `.btn .btn-secondary`. No bespoke
      colors.
- [ ] Long-form copy capped at 60-70ch line length.
- [ ] No em-dashes or en-dashes in new copy.
- [ ] Salary numbers are tied to a cited source (BLS, NHA, school catalog).
- [ ] All interactive elements keyboard-reachable, focusable, and labeled.
- [ ] Mobile review at 375px and 414px viewports.
- [ ] If adding a brand-glass card, use the recipe in section 6.
- [ ] If adding a table, follow the responsive `data-label` pattern.
- [ ] Run a Rich Results test if you touch the JSON-LD block.
- [ ] No new staff direct phone numbers added to public-facing markup.

---

## 14. Current Program Inventory (catalog-aligned)

| Program                                | Hours | Length         | Tuition           | CIP        |
| -------------------------------------- | ----: | -------------- | ----------------- | ---------- |
| Certified Medical Assistant (CMA)      |   480 | 8 to 12 months | $5,000            | 51.0801    |
| Patient Care Technician (PCT)          |   300 | 5 to 6 months  | $4,000            | 51.0904 *  |
| Phlebotomy Technician                  |   120 | ~6 weeks       | Contact admissions| 51.1009    |
| EKG Technician                         |   120 | 6 weeks        | Contact admissions| 51.0902    |
| Certified Nursing Assistant (CNA)      |    90 | ~6 weeks       | Contact admissions| 51.3902    |
| Certified Home Health Aide (CHHA)      |    76 | 4 to 11 weeks  | $800              | 51.2602    |
| Certified Medication Aide              |    40 | ~1 week        | $600              | 51.2603    |

\* PCT CIP is approximate; the 2025 catalog prints "51090" (incomplete).
Verify against the active NJ DOL filing before reprinting the catalog.

Term start dates (2026): Winter Jan 1, Spring Apr 2, Summer Jul 5, Fall Oct 2.

---

*Last updated: 2026-04-27*
