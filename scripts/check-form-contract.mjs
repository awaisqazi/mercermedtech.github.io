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
//   3. the two unlisted staff forms (src/components/StaffForm.astro, fields in
//      src/data/staffForms.ts): IEP intake on /iep/ (id="iep-intake-form")
//      and the laptop loaner agreement on /loaner/ (id="loaner-agreement-form").
//      They post to the Worker's /iep-submit and /loaner-submit routes; their
//      Google Form addresses must not appear on the page either.
//
// The forms are separate Google Forms with separate action URLs and
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

/* ---------------- 3. the staff forms (/iep/, /loaner/) ---------------- */

/**
 * Every entry.* name each staff form must send, and its Google Form id, which
 * must never be on the page. Keep in step with src/data/staffForms.ts and the
 * mapping in MMT Management WorkSpace/Participants/IEP intake/README.md.
 */
const STAFF_FORMS = {
  'iep-intake-form': {
    action: `${SIGNUP_ACTION}/iep-submit`,
    googleId: '1FAIpQLSf47SrEW6gcCgBkZhXEj7l-m5fuYVuYMGk0U637S8xvdzzC4Q',
    fields: [
      'entry.379282059', 'entry.1304183266', 'entry.104008577', 'entry.1937477227',
      'entry.2145008359', 'entry.848829829', 'entry.2076425752', 'entry.1924799731',
      'entry.1102082198', 'entry.1384494948', 'entry.1590196068', 'entry.829820065',
      'entry.66685863', 'entry.8668350', 'entry.1470120309', 'entry.401174236',
      'entry.1313047665', 'entry.1390254369', 'entry.1106911370', 'entry.1335508969',
      'entry.1812726087', 'entry.957542179', 'entry.957542179.other_option_response',
      'entry.1467659682', 'entry.1043545198',
    ],
  },
  'loaner-agreement-form': {
    action: `${SIGNUP_ACTION}/loaner-submit`,
    googleId: '1FAIpQLSdZFlduup-vf1qElvfBE5LbuzP_1uEvG9A-v3eBgu38s0muoA',
    fields: [
      'entry.218598507', 'entry.991666087', 'entry.1600795715', 'entry.1242110529',
      'entry.172260136', 'entry.1843487727', 'entry.1109047904', 'entry.151926919',
      'entry.2031520752', 'entry.266658418', 'entry.539715692', 'entry.2080556034',
      'entry.1883769004', 'entry.1669196297', 'entry.1838727109',
      'entry.195835422_year', 'entry.195835422_month', 'entry.195835422_day',
    ],
  },
};
const ALL_GOOGLE_IDS = [SIGNUP_GOOGLE_FORM_ID, ...Object.values(STAFF_FORMS).map((f) => f.googleId)];

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

/** A staff form: Worker action, every entry present, no Google Form address. */
let staffChecked = 0;
function checkStaffForm(page, html, id, spec) {
  staffChecked += 1;
  const form = html.match(new RegExp(`<form[^>]*id="${id}"[^>]*>`));
  if (!form || !form[0].includes(`action="${spec.action}"`)) {
    fail(page, `${id} does not post to ${spec.action}`);
  }
  for (const field of spec.fields) {
    if (!html.includes(`name="${field}"`)) fail(page, `${id} is missing ${field}`);
  }
}

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  if (html.includes('id="dlt-signup-form"')) checkSignupForm(page, html);
  for (const [id, spec] of Object.entries(STAFF_FORMS)) {
    if (html.includes(`id="${id}"`)) checkStaffForm(page, html, id, spec);
  }
  for (const googleId of ALL_GOOGLE_IDS.slice(1)) {
    if (html.includes(googleId)) fail(page, 'a staff Google Form address is on the page; it belongs in the Worker only');
  }
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
    `${signupChecked} with the sign-up form, ${staffChecked} with a staff form, ${problems} problem(s).`
);
process.exit(problems ? 1 : 0);
