// The contact form posts to a Google Form. A Google Forms DROPDOWN silently
// throws away any value it does not recognise, so every <option value> the
// site renders, in EVERY language, must be one of the strings the form knows.
// The visible labels are translated; the values are not.
//
// Run after `npm run build`:  npm run check:form
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const DIST = resolve('dist');

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

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
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

console.log(`form contract: ${checked} page(s) with the form, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
