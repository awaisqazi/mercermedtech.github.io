# mmt-signup Worker

Receives the Digital Literacy sign-up form from mercermedtech.com, verifies the
Cloudflare Turnstile token, and forwards the answers to the Google Form. The
Google Form address therefore never appears on the public page.

Endpoint: https://mmt-signup.mercermedtech.workers.dev

- `npx wrangler login` once (opens the browser).
- `npx wrangler deploy --keep-vars` from this folder after any change to
  `worker.js`.
- `npx wrangler secret put TURNSTILE_SECRET` once; paste the widget's secret key
  from Cloudflare → Turnstile. Never commit it.

## Staff form routes (unlisted staff forms)

The native forms on https://www.mercermedtech.com/iep/ and /loaner/ (and the
/es/ pages) POST form-encoded `entry.*` fields plus `cf-turnstile-response` to
`/iep-submit` and `/loaner-submit`. The Worker checks the token (it must have
been solved on mercermedtech.com), drops posts that fill the `website`
honeypot, and forwards the entry fields (including `entry.N_year/_month/_day`
and `entry.N.other_option_response`) to the Google Form. Only
`https://www.mercermedtech.com` and `https://mercermedtech.com` may call them.
Google answers 400 when a required question is missing; the Worker passes
that on as 422 `rejected`.

`/orientation-submit` and `/attendance-submit` work the same way for the Day 0
acknowledgments on /onboarding/orientation/ and /onboarding/attendance/.

## Public form routes

`/interest-submit` works the same way for the public Digital Literacy interest
form on / and /digital-literacy/ (and /es/), forwarding to
`FORM_ACTION_INTEREST`. `/inquiry-submit` does the same for the contact form
("Have us call you back") on / and /es/, forwarding to `FORM_ACTION_INQUIRY`
(notes: `docs/inquiry-form.md`). Both also accept calls from the local dev
server (`http://localhost:4321`, `http://127.0.0.1:4321`).

- Set `IEP_FORM_ACTION`, `LOANER_FORM_ACTION`, `ORIENTATION_FORM_ACTION`,
  `ATTENDANCE_FORM_ACTION`, `FORM_ACTION_INTEREST` and `FORM_ACTION_INQUIRY`
  (the formResponse URLs) once in Cloudflare (Workers, mmt-signup, Settings,
  Variables and Secrets, plain text). They are not in `wrangler.toml` because
  this repository is public. The older `IEP_FORM_URL` and `LOANER_FORM_URL`
  are no longer read.
- Deploy with `npx wrangler deploy --keep-vars` so those dashboard variables
  survive the deploy.

## Copy to the staff portal

Three routes copy each response into the staff portal's inbox
(mercermedtech.com/admin): the sign-up (`POST /`), `/interest-submit` and
`/inquiry-submit`. The staff forms are never copied. Google stays the record:

- The copy starts only after Google has accepted the post, inside
  `ctx.waitUntil`, so the reader's answer never waits for it or changes
  because of it. A failed copy is logged with `console.error` (see Workers,
  mmt-signup, Logs).
- It calls `POST https://olqhfdpaoqvwompkqtdz.supabase.co/rest/v1/rpc/ingest_form_response`
  with the Supabase publishable key (public by design; it is in the site
  bundle too) and the body `{p_secret, p_source, p_lang, p_page, p_name,
  p_contact, p_fields}`. `p_source` is `dlt_signup`, `dlt_interest` or
  `inquiry`; `p_lang` is `es` when the Referer path starts with `/es/`;
  `p_page` is the Referer path; `p_fields` lists the answers as
  `{k: label, v: answer}` in question order (label maps: `COPY_FORMS` in
  `worker.js`).
- `p_secret` is the secret `INGEST_SECRET`: `npx wrangler secret put
  INGEST_SECRET`, the same value the portal database holds (stored there with
  `set_ingest_secret`). Never commit it. While it is unset the Worker skips
  the copy and everything else works as before.
