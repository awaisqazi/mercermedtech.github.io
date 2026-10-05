/**
 * mmt-signup — receives the Digital Literacy sign-up form, checks the
 * Cloudflare Turnstile token, and forwards the answers to the Google Form.
 *
 * Bindings (Settings → Variables and Secrets):
 *   FORM_ACTION       plain text: the Google Form's formResponse URL
 *   TURNSTILE_SECRET  secret: the Turnstile widget's secret key
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
 * Same body as the sign-up (form-encoded entry.* fields plus
 * cf-turnstile-response), plus Google's date parts (entry.N_year/_month/_day)
 * and "Other" text (entry.N.other_option_response). Differences from the
 * sign-up route: only the two production origins may call them (403
 * otherwise), the Turnstile token must have been solved on mercermedtech.com,
 * a filled-in honeypot field ("website") is accepted and dropped, and only a
 * 200 from Google counts as delivered (Google answers 400 when a required
 * question is missing).
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

/** Route -> the Worker variable that holds that form's formResponse URL. */
const STAFF_ROUTES = {
  '/iep-submit': 'IEP_FORM_ACTION',
  '/loaner-submit': 'LOANER_FORM_ACTION',
  '/orientation-submit': 'ORIENTATION_FORM_ACTION',
  '/attendance-submit': 'ATTENDANCE_FORM_ACTION',
};

const ALLOWED_FIELD = /^entry\.\d+$/;
const MAX_FIELD_LENGTH = 2000;

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

function staffHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (STAFF_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function staffJson(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...staffHeaders(origin) },
  });
}

/** POST /iep-submit or /loaner-submit -> {ok:true} or {ok:false, error}. */
async function handleStaffSubmit(request, env, origin, binding) {
  if (!STAFF_ORIGINS.has(origin)) {
    return staffJson({ ok: false, error: 'origin' }, 403, origin);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: staffHeaders(origin) });
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
  if (!verdict.success || (verdict.hostname && !STAFF_HOSTNAMES.has(verdict.hostname))) {
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
  if (status === 200) return staffJson({ ok: true }, 200, origin);
  if (status === 400) return staffJson({ ok: false, error: 'rejected' }, 422, origin);
  return staffJson({ ok: false, error: 'delivery failed' }, 502, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // The staff-form routes have their own CORS rules; every other address
    // keeps the sign-up behaviour below exactly as before.
    const binding = STAFF_ROUTES[new URL(request.url).pathname];
    if (binding) {
      return handleStaffSubmit(request, env, origin, binding);
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

    return json({ ok: true }, 200, origin);
  },
};
