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
 * Second route, POST /iep-form, for the unlisted IEP intake page
 * (www.mercermedtech.com/iep/ and /es/iep/). The page sends JSON {token}
 * with a Turnstile token; on a good token the Worker answers
 * {ok:true, url} with the Google Form's embed URL, so the form address is
 * never in the page source. Extra binding:
 *   IEP_FORM_URL      plain text: the IEP intake Google Form's embed URL
 * Only the two production origins may call it; anything else gets 403.
 */

const ALLOWED_ORIGINS = new Set([
  'https://www.mercermedtech.com',
  'https://mercermedtech.com',
  'http://127.0.0.1:4321',
  'http://localhost:4321',
]);

/** /iep-form is for the live site only, so no localhost origins here. */
const IEP_ORIGINS = new Set(['https://www.mercermedtech.com', 'https://mercermedtech.com']);
const IEP_HOSTNAMES = new Set(['www.mercermedtech.com', 'mercermedtech.com']);
const MAX_TOKEN_LENGTH = 4096;

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

function iepHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (IEP_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function iepJson(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...iepHeaders(origin) },
  });
}

/**
 * POST /iep-form  {token}  ->  {ok:true, url}  or  {ok:false, error}.
 * The token must pass Turnstile and have been solved on mercermedtech.com.
 */
async function handleIepForm(request, env, origin) {
  if (!IEP_ORIGINS.has(origin)) {
    return iepJson({ ok: false, error: 'origin' }, 403, origin);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: iepHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return iepJson({ ok: false, error: 'method' }, 405, origin);
  }
  if (!env.IEP_FORM_URL || !env.TURNSTILE_SECRET) {
    return iepJson({ ok: false, error: 'not configured' }, 503, origin);
  }

  let token = '';
  try {
    const body = await request.json();
    token = typeof body?.token === 'string' ? body.token : '';
  } catch {
    return iepJson({ ok: false, error: 'bad request' }, 400, origin);
  }
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return iepJson({ ok: false, error: 'turnstile missing' }, 400, origin);
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
    return iepJson({ ok: false, error: 'turnstile unavailable' }, 502, origin);
  }
  if (!verdict.success || (verdict.hostname && !IEP_HOSTNAMES.has(verdict.hostname))) {
    return iepJson({ ok: false, error: 'turnstile failed' }, 403, origin);
  }

  return iepJson({ ok: true, url: env.IEP_FORM_URL }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // The IEP intake route has its own CORS rules; every other address keeps
    // the sign-up behaviour below exactly as before.
    if (new URL(request.url).pathname === '/iep-form') {
      return handleIepForm(request, env, origin);
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
