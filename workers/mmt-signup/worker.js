/**
 * mmt-signup — receives the Digital Literacy sign-up form, checks the
 * Cloudflare Turnstile token, and forwards the answers to the Google Form.
 *
 * Bindings (Settings → Variables and Secrets):
 *   FORM_ACTION           plain text: the sign-up Google Form's formResponse URL
 *   FORM_ACTION_INTEREST  plain text: the interest form's formResponse URL
 *   FORM_ACTION_INQUIRY   plain text: the contact inquiry form's formResponse URL
 *   TURNSTILE_SECRET      secret: the Turnstile widget's secret key
 *   INGEST_SECRET         secret: the shared secret for the staff portal copy
 *                         (see "Copy to the portal" below); unset = no copy
 *
 * The browser sends: POST, application/x-www-form-urlencoded, the entry.*
 * fields plus cf-turnstile-response. It gets back JSON {ok:true} or
 * {ok:false, error:"…"} with a matching status.
 *
 * Further routes take the unlisted staff forms on the site and forward them
 * to their Google Forms the same way, so neither Google Form address is in
 * the page source:
 *   POST /iep-submit     www.mercermedtech.com/iep/ (and /es/iep/)
 *                        binding IEP_FORM_ACTION (plain text, formResponse URL)
 *   POST /loaner-submit  www.mercermedtech.com/loaner/ (and /es/loaner/)
 *                        binding LOANER_FORM_ACTION (plain text, formResponse URL)
 *   POST /orientation-submit  .../onboarding/orientation/ (and /es/...)
 *                        binding ORIENTATION_FORM_ACTION
 *   POST /attendance-submit   .../onboarding/attendance/ (and /es/...)
 *                        binding ATTENDANCE_FORM_ACTION
 *   POST /interest-submit     the public Digital Literacy interest form on
 *                        / and /digital-literacy/ (and /es/...)
 *                        binding FORM_ACTION_INTEREST
 *   POST /inquiry-submit      the public contact form ("Have us call you
 *                        back") on / (and /es/)
 *                        binding FORM_ACTION_INQUIRY
 * Same body as the sign-up (form-encoded entry.* fields plus
 * cf-turnstile-response), plus Google's date parts (entry.N_year/_month/_day)
 * and "Other" text (entry.N.other_option_response). Differences from the
 * sign-up route: only the two production origins may call them (403
 * otherwise), the Turnstile token must have been solved on mercermedtech.com,
 * a filled-in honeypot field ("website") is accepted and dropped, and only a
 * 200 from Google counts as delivered (Google answers 400 when a required
 * question is missing). /interest-submit and /inquiry-submit follow the same
 * rules, except that the local dev server (localhost:4321, 127.0.0.1:4321)
 * may call them too.
 *
 * Copy to the portal. The three public forms (the sign-up on /, the interest
 * form on /interest-submit, the contact form on /inquiry-submit) are also
 * copied into the staff portal's inbox (mercermedtech.com/admin). Google stays
 * the record: the copy is made only after Google has accepted the post, runs
 * in ctx.waitUntil after the reader already has their answer, and a failed
 * copy is only logged (console.error). It calls the Supabase database
 * function ingest_form_response with the publishable key (public by design,
 * it is in the site bundle too) and INGEST_SECRET, which the function checks.
 * With INGEST_SECRET unset the copy is skipped. The staff forms are never
 * copied.
 */

const ALLOWED_ORIGINS = new Set([
  'https://www.mercermedtech.com',
  'https://mercermedtech.com',
  'http://127.0.0.1:4321',
  'http://localhost:4321',
]);

/** The staff-form routes are for the live site only, so no localhost origins here. */
const STAFF_ORIGINS = new Set(['https://www.mercermedtech.com', 'https://mercermedtech.com']);
const STAFF_HOSTNAMES = new Set(['www.mercermedtech.com', 'mercermedtech.com']);
const STAFF_FIELD = /^entry\.\d+(_year|_month|_day|\.other_option_response)?$/;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_FIELDS = 120;

/** The public interest form may also be tried from the local dev server. */
const INTEREST_ORIGINS = new Set([...STAFF_ORIGINS, 'http://localhost:4321', 'http://127.0.0.1:4321']);
const INTEREST_HOSTNAMES = new Set([...STAFF_HOSTNAMES, 'localhost', '127.0.0.1']);

const staffRoute = (binding) => ({ binding, origins: STAFF_ORIGINS, hostnames: STAFF_HOSTNAMES });
/** The public forms: the dev server may call them too, and `copy` names their portal source. */
const publicRoute = (binding, copy) => ({ binding, origins: INTEREST_ORIGINS, hostnames: INTEREST_HOSTNAMES, copy });

/** Route -> the Worker variable that holds that form's formResponse URL, and who may call it. */
const STAFF_ROUTES = {
  '/iep-submit': staffRoute('IEP_FORM_ACTION'),
  '/loaner-submit': staffRoute('LOANER_FORM_ACTION'),
  '/orientation-submit': staffRoute('ORIENTATION_FORM_ACTION'),
  '/attendance-submit': staffRoute('ATTENDANCE_FORM_ACTION'),
  '/interest-submit': publicRoute('FORM_ACTION_INTEREST', 'dlt_interest'),
  '/inquiry-submit': publicRoute('FORM_ACTION_INQUIRY', 'inquiry'),
};

const ALLOWED_FIELD = /^entry\.\d+$/;
const MAX_FIELD_LENGTH = 2000;

/* ---------------- copy to the portal ---------------- */

const INGEST_URL = 'https://olqhfdpaoqvwompkqtdz.supabase.co/rest/v1/rpc/ingest_form_response';
/** The publishable (anon) key: public by design, it ships in the site bundle. */
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_N3L_0PXlx5urFzkObblWIA_7qrVgq8M';

/**
 * Per form: entry id -> the label staff read in the inbox, in question order,
 * and which entries hold the name, phone and email. Keep in step with
 * ContactForm.astro, scripts/check-form-contract.mjs (SIGNUP_FIELDS) and
 * docs/dlt-interest-form.md. An entry not listed here is still copied, with
 * its entry id as the label.
 */
const COPY_FORMS = {
  inquiry: {
    name: 'entry.500866520',
    phone: 'entry.377183870',
    email: 'entry.561406325',
    labels: [
      ['entry.500866520', 'Name'],
      ['entry.377183870', 'Phone'],
      ['entry.561406325', 'Email'],
      ['entry.358026590', 'Program'],
      ['entry.1429591353', 'Best time to call'],
      ['entry.1375584749', 'Message'],
    ],
  },
  dlt_signup: {
    name: 'entry.610321898',
    phone: 'entry.845307859',
    email: 'entry.1745544463',
    labels: [
      ['entry.610321898', 'Name'],
      ['entry.845307859', 'Phone'],
      ['entry.1745544463', 'Email'],
      ['entry.334657821', 'County'],
      ['entry.1320551453', 'TANF or SNAP'],
      ['entry.1571243070', 'Language'],
      ['entry.648594530', 'Attend'],
      ['entry.303849646', 'Best time to call'],
      ['entry.1699212155', 'Referred by'],
      ['entry.1074735478', 'Message'],
    ],
  },
  dlt_interest: {
    name: 'entry.330196929',
    phone: 'entry.1208529879',
    email: 'entry.2122843499',
    // "Submitted from" reads like "Home page (Spanish)": the language
    // fallback when the Referer carries no /es/ path.
    submittedFrom: 'entry.943507853',
    labels: [
      ['entry.330196929', 'Name'],
      ['entry.1208529879', 'Phone'],
      ['entry.2122843499', 'Email'],
      ['entry.23947013', 'County'],
      ['entry.210728030', 'TANF or SNAP'],
      ['entry.575477385', 'Language'],
      ['entry.137405449', 'How did you hear about us'],
      ['entry.703509959', 'Referred by'],
      ['entry.704622938', 'AOSOS number'],
      ['entry.1944461321', 'Anything else'],
      ['entry.943507853', 'Submitted from'],
    ],
  },
};

/** The same caps ingest_form_response applies; cut here too so the request stays small. */
const COPY_CAPS = { name: 200, contact: 300, page: 200, fields: 60, key: 100, value: 2000 };

/**
 * Turns the fields forwarded to Google into the portal's ingest body.
 * Blank answers are left out; a question that repeats a name (checkboxes)
 * becomes one item with its values joined by ", ".
 */
function buildCopy(env, source, outgoing, referer) {
  const spec = COPY_FORMS[source];
  const answers = new Map();
  for (const [name, value] of outgoing.entries()) {
    const text = String(value).trim();
    if (!text) continue;
    answers.set(name, answers.has(name) ? `${answers.get(name)}, ${text}` : text);
  }

  const known = new Set(spec.labels.map(([id]) => id));
  const fields = [];
  for (const [id, label] of spec.labels) {
    if (answers.has(id)) fields.push({ k: label, v: answers.get(id) });
  }
  for (const [id, value] of answers) {
    if (!known.has(id)) fields.push({ k: id, v: value });
  }

  // The page path and the language come from the Referer.
  let page = '';
  try {
    if (referer) page = new URL(referer).pathname;
  } catch {
    page = '';
  }
  let lang = page === '/es' || page.startsWith('/es/') ? 'es' : 'en';
  if (lang === 'en' && spec.submittedFrom && /\(Spanish\)/.test(answers.get(spec.submittedFrom) || '')) {
    lang = 'es';
  }

  const contact = [answers.get(spec.phone), answers.get(spec.email)].filter(Boolean).join(' · ');
  return {
    p_secret: env.INGEST_SECRET,
    p_source: source,
    p_lang: lang,
    p_page: page.slice(0, COPY_CAPS.page),
    p_name: (answers.get(spec.name) || '').slice(0, COPY_CAPS.name),
    p_contact: contact.slice(0, COPY_CAPS.contact),
    p_fields: fields
      .slice(0, COPY_CAPS.fields)
      .map(({ k, v }) => ({ k: k.slice(0, COPY_CAPS.key), v: v.slice(0, COPY_CAPS.value) })),
  };
}

/** Sends one copy to the portal. Never throws: Google already has the answers. */
async function copyToPortal(env, source, outgoing, referer) {
  try {
    const response = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildCopy(env, source, outgoing, referer)),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      console.error(`portal copy failed (${source}): ${response.status} ${detail}`);
    }
  } catch (error) {
    console.error(`portal copy failed (${source}): ${error && error.message ? error.message : error}`);
  }
}

/** Starts the copy after the reader's answer; ctx.waitUntil keeps the Worker alive until it settles. */
function startCopy(ctx, env, source, outgoing, request) {
  if (!env.INGEST_SECRET) return; // not set up: skip quietly
  const copy = copyToPortal(env, source, outgoing, request.headers.get('Referer') || '');
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(copy);
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.mercermedtech.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

function staffHeaders(origin, origins = STAFF_ORIGINS) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/** POST to a staff route, /interest-submit or /inquiry-submit -> {ok:true} or {ok:false, error}. */
async function handleStaffSubmit(request, env, ctx, origin, route) {
  const { binding, origins, hostnames } = route;
  const staffJson = (body, status, at) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...staffHeaders(at, origins) },
    });

  if (!origins.has(origin)) {
    return staffJson({ ok: false, error: 'origin' }, 403, origin);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: staffHeaders(origin, origins) });
  }
  if (request.method !== 'POST') {
    return staffJson({ ok: false, error: 'method' }, 405, origin);
  }
  const action = env[binding];
  if (!action || !env.TURNSTILE_SECRET) {
    return staffJson({ ok: false, error: 'not configured' }, 503, origin);
  }
  const length = Number(request.headers.get('Content-Length') || '0');
  if (length > MAX_BODY_BYTES) {
    return staffJson({ ok: false, error: 'too large' }, 413, origin);
  }

  let incoming;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return staffJson({ ok: false, error: 'too large' }, 413, origin);
    incoming = new URLSearchParams(text);
  } catch {
    return staffJson({ ok: false, error: 'bad request' }, 400, origin);
  }

  // 1. Turnstile, solved on mercermedtech.com.
  const token = String(incoming.get('cf-turnstile-response') || '');
  if (!token || token.length > 4096) {
    return staffJson({ ok: false, error: 'turnstile missing' }, 400, origin);
  }
  let verdict;
  try {
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    });
    verdict = await verify.json();
  } catch {
    return staffJson({ ok: false, error: 'turnstile unavailable' }, 502, origin);
  }
  if (!verdict.success || (verdict.hostname && !hostnames.has(verdict.hostname))) {
    return staffJson({ ok: false, error: 'turnstile failed' }, 403, origin);
  }

  // 2. Honeypot: a person never fills it in. Say yes and drop the post.
  if (String(incoming.get('website') || '').trim()) {
    return staffJson({ ok: true }, 200, origin);
  }

  // 3. Forward only the form's own fields (checkbox questions repeat a name).
  const outgoing = new URLSearchParams();
  let count = 0;
  for (const [name, value] of incoming.entries()) {
    if (!STAFF_FIELD.test(name)) continue;
    if (++count > MAX_FIELDS) return staffJson({ ok: false, error: 'too many fields' }, 400, origin);
    outgoing.append(name, value.slice(0, MAX_FIELD_LENGTH));
  }
  if (count === 0) return staffJson({ ok: false, error: 'empty' }, 400, origin);

  let status = 0;
  try {
    const google = await fetch(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: outgoing,
      redirect: 'follow',
    });
    status = google.status;
  } catch {
    status = 0;
  }
  if (status === 200) {
    // The two public routes are also copied to the portal (never the staff forms).
    if (route.copy) startCopy(ctx, env, route.copy, outgoing, request);
    return staffJson({ ok: true }, 200, origin);
  }
  if (status === 400) return staffJson({ ok: false, error: 'rejected' }, 422, origin);
  return staffJson({ ok: false, error: 'delivery failed' }, 502, origin);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    // The staff-form routes have their own CORS rules; every other address
    // keeps the sign-up behaviour below exactly as before.
    const pathname = new URL(request.url).pathname;
    const route = STAFF_ROUTES[pathname];
    if (route) {
      return handleStaffSubmit(request, env, ctx, origin, route);
    }
    // Only the sign-up form posts to the root. Any other path is a mistake
    // (for example a form deployed before its Worker route) and must fail
    // loudly instead of falling through to the sign-up forwarder.
    if (pathname !== '/') {
      return json({ ok: false, error: 'unknown route' }, 404, origin);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method' }, 405, origin);
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: 'origin' }, 403, origin);
    }
    if (!env.FORM_ACTION || !env.TURNSTILE_SECRET) {
      return json({ ok: false, error: 'not configured' }, 503, origin);
    }

    let incoming;
    try {
      incoming = await request.formData();
    } catch {
      return json({ ok: false, error: 'bad request' }, 400, origin);
    }

    // 1. Verify the Turnstile token with Cloudflare.
    const token = String(incoming.get('cf-turnstile-response') || '');
    if (!token) return json({ ok: false, error: 'turnstile missing' }, 400, origin);

    const verifyBody = new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') || '',
    });
    let verdict;
    try {
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: verifyBody,
      });
      verdict = await verify.json();
    } catch {
      return json({ ok: false, error: 'turnstile unavailable' }, 502, origin);
    }
    if (!verdict.success) {
      return json({ ok: false, error: 'turnstile failed' }, 403, origin);
    }

    // 2. Forward only the form's own fields to Google.
    const outgoing = new URLSearchParams();
    let fieldCount = 0;
    for (const [name, value] of incoming.entries()) {
      if (!ALLOWED_FIELD.test(name)) continue;
      if (typeof value !== 'string') continue;
      outgoing.append(name, value.slice(0, MAX_FIELD_LENGTH));
      fieldCount += 1;
    }
    if (fieldCount === 0) return json({ ok: false, error: 'empty' }, 400, origin);

    // Google answers a formResponse POST with a 200 page on success and a
    // 200 page on some failures too, so treat any non-5xx as delivered; the
    // form's own required-field rules are enforced in the browser first.
    let delivered = false;
    try {
      const google = await fetch(env.FORM_ACTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: outgoing,
        redirect: 'follow',
      });
      delivered = google.status < 500;
    } catch {
      delivered = false;
    }
    if (!delivered) return json({ ok: false, error: 'delivery failed' }, 502, origin);

    // Google has it: copy it to the portal's inbox too.
    startCopy(ctx, env, 'dlt_signup', outgoing, request);
    return json({ ok: true }, 200, origin);
  },
};
