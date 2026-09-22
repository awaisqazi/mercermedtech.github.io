// THE SITE FEEDS TWO GOOGLE FORMS. Both are checked here.
//
//   1. the contact form   (src/components/ContactForm.astro), on every page
//      that carries id="request-info-form". It still posts to Google itself.
//   2. the Digital Literacy sign-up form (src/components/DltSignupForm.astro),
//      on the hidden /digital-literacy/sign-up/ pages, id="dlt-signup-form".
//      It posts to the mmt-signup Cloudflare Worker, which checks the
//      Turnstile token and forwards the answers to Google. Its Google Form
//      URL must NOT appear on the page: that is the point of the Worker, and
//      it is checked below.
//
// The two forms are separate Google Forms with separate action URLs and
// separate entry.* names. Nothing is shared: do not reuse an id between them.
//
// A Google Forms DROPDOWN silently throws away any value it does not
// recognise, so every <option value> the site renders, in EVERY language,
// must be one of the strings that form knows. The visible labels are
// translated; the values are not.
//
// Run after `npm run build`:  npm run check:form
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const DIST = resolve('dist');

/* ---------------- 1. the homepage contact form ---------------- */

const PROGRAM_FIELD = 'entry.358026590';
const BEST_TIME_FIELD = 'entry.1429591353';

const PROGRAM_VALUES = [
  'Certified Medical Assistant',
  'Phlebotomy Technician',
  'Patient Care Technician (PCT)',
  'EKG Technician',
  'Certified Nursing Assistant (CNA)',
  'Certified Medication Aide',
  'Digital Literacy Training',
  'Not sure yet',
];

const BEST_TIME_VALUES = [
  'Morning (9:00 AM - 12:00 PM)',
  'Afternoon (12:00 PM - 5:00 PM)',
  'Evening (5:00 PM - 8:00 PM)',
  'Anytime',
];

const FORM_ACTION =
  'https://docs.google.com/forms/d/e/1FAIpQLSdlbJCiaAE1h2VVLcF0mUPG_6SKAs34IR0Ipu_DHATetEX-lg/formResponse';

const REQUIRED_FIELDS = [
  'entry.500866520', // name
  'entry.377183870', // phone
  'entry.561406325', // email
  PROGRAM_FIELD,
  BEST_TIME_FIELD,
  'entry.1375584749', // message
];

/* ---------------- 2. the Digital Literacy sign-up form ---------------- */

const SIGNUP_ACTION = 'https://mmt-signup.mercermedtech.workers.dev';

/**
 * The sign-up Google Form's id. The Worker holds the real URL; if this string
 * turns up in a built sign-up page again, the browser is talking to Google
 * directly and the spam check has been bypassed.
 */
const SIGNUP_GOOGLE_FORM_ID = '1FAIpQLSdQmOE7rl6qXNkFtYa2cqpz2_i5gZZJ0qCKxEuD_KXFAZ77cA';

/** Every entry.* name the sign-up form expects, in question order. */
const SIGNUP_FIELDS = {
  name: 'entry.610321898',
  phone: 'entry.845307859',
  email: 'entry.1745544463',
  county: 'entry.334657821',
  benefits: 'entry.1320551453',
  language: 'entry.1571243070',
  attend: 'entry.648594530',
  bestTime: 'entry.303849646',
  referral: 'entry.1699212155',
  message: 'entry.1074735478',
};

/** The dropdown fields and the exact choices Google accepts for each. */
const SIGNUP_CHOICES = {
  [SIGNUP_FIELDS.county]: [
    'Hunterdon',
    'Middlesex',
    'Monmouth',
    'Mercer',
    'Ocean',
    'Somerset',
    'Union',
    'Other',
  ],
  [SIGNUP_FIELDS.benefits]: ['Yes', 'No', 'Not sure'],
  [SIGNUP_FIELDS.language]: ['English', 'Spanish'],
  [SIGNUP_FIELDS.attend]: ['Online', 'In person in Lawrenceville', 'Either'],
  [SIGNUP_FIELDS.bestTime]: BEST_TIME_VALUES,
};

const pages = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.html')) pages.push(full);
  }
})(DIST);

let problems = 0;
let checked = 0;
const fail = (page, message) => {
  problems += 1;
  console.log(`  x /${relative(DIST, page)}: ${message}`);
};

/** Pulls the <option> values out of one <select name="..."> block. */
function optionValues(html, fieldName) {
  const select = html.match(new RegExp(`<select[^>]*name="${fieldName}"[\\s\\S]*?</select>`));
  if (!select) return null;
  return [...select[0].matchAll(/<option[^>]*value="([^"]*)"/g)].map((match) =>
    match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  );
}

/** The sign-up form: all ten fields present, every dropdown value allowed. */
let signupChecked = 0;
function checkSignupForm(page, html) {
  signupChecked += 1;

  if (!html.includes(`action="${SIGNUP_ACTION}"`)) {
    fail(page, 'the sign-up form action is not the mmt-signup Worker endpoint');
  }

  if (html.includes(SIGNUP_GOOGLE_FORM_ID)) {
    fail(page, 'the sign-up Google Form URL is on the page; it belongs in the Worker only');
  }

  for (const [role, field] of Object.entries(SIGNUP_FIELDS)) {
    if (!html.includes(`name="${field}"`)) {
      fail(page, `sign-up form is missing ${role} (${field})`);
    }
  }

  for (const [field, allowed] of Object.entries(SIGNUP_CHOICES)) {
    const values = optionValues(html, field);
    if (!values) {
      fail(page, `sign-up form has no dropdown for ${field}`);
      continue;
    }
    for (const value of values) {
      if (value === '') continue; // the "pick one" placeholder
      if (!allowed.includes(value)) {
        fail(page, `sign-up value "${value}" is not one the Google Form accepts`);
      }
    }
    for (const expected of allowed) {
      if (!values.includes(expected)) {
        fail(page, `sign-up value "${expected}" is missing from ${field}`);
      }
    }
  }
}

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  if (html.includes('id="dlt-signup-form"')) checkSignupForm(page, html);
  if (!html.includes('id="request-info-form"')) continue;
  checked += 1;

  if (!html.includes(FORM_ACTION)) fail(page, 'the form action is not the Google Form URL');

  for (const field of REQUIRED_FIELDS) {
    if (!html.includes(`name="${field}"`)) fail(page, `missing form field ${field}`);
  }

  const programs = optionValues(html, PROGRAM_FIELD);
  if (!programs) {
    fail(page, 'no program dropdown found');
  } else {
    for (const value of programs) {
      if (value === '') continue; // the "pick one" placeholder
      if (!PROGRAM_VALUES.includes(value)) {
        fail(page, `program value "${value}" is not one the Google Form accepts`);
      }
    }
    for (const expected of PROGRAM_VALUES) {
      if (!programs.includes(expected)) fail(page, `program value "${expected}" is missing`);
    }
  }

  const times = optionValues(html, BEST_TIME_FIELD);
  if (!times) {
    fail(page, 'no best-time dropdown found');
  } else {
    for (const value of times) {
      if (value === '') continue;
      if (!BEST_TIME_VALUES.includes(value)) {
        fail(page, `best-time value "${value}" is not one the Google Form accepts`);
      }
    }
  }
}

console.log(
  `form contract: ${checked} page(s) with the contact form, ` +
    `${signupChecked} with the sign-up form, ${problems} problem(s).`
);
process.exit(problems ? 1 : 0);
