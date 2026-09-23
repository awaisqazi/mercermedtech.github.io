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
 */

const ALLOWED_ORIGINS = new Set([
  'https://www.mercermedtech.com',
  'https://mercermedtech.com',
  'http://127.0.0.1:4321',
  'http://localhost:4321',
]);

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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

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
