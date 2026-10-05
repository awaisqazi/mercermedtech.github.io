# mmt-signup Worker

Receives the Digital Literacy sign-up form from mercermedtech.com, verifies the
Cloudflare Turnstile token, and forwards the answers to the Google Form. The
Google Form address therefore never appears on the public page.

Endpoint: https://mmt-signup.mercermedtech.workers.dev

- `npx wrangler login` once (opens the browser).
- `npx wrangler deploy` from this folder after any change to `worker.js`.
- `npx wrangler secret put TURNSTILE_SECRET` once; paste the widget's secret key
  from Cloudflare → Turnstile. Never commit it.

## /iep-submit and /loaner-submit (unlisted staff forms)

The native forms on https://www.mercermedtech.com/iep/ and /loaner/ (and the
/es/ pages) POST form-encoded `entry.*` fields plus `cf-turnstile-response` to
`/iep-submit` and `/loaner-submit`. The Worker checks the token (it must have
been solved on mercermedtech.com), drops posts that fill the `website`
honeypot, and forwards the entry fields (including `entry.N_year/_month/_day`
and `entry.N.other_option_response`) to the Google Form. Only
`https://www.mercermedtech.com` and `https://mercermedtech.com` may call them.
Google answers 400 when a required question is missing; the Worker passes
that on as 422 `rejected`.

- Set `IEP_FORM_ACTION` and `LOANER_FORM_ACTION` (the two formResponse URLs)
  once in Cloudflare (Workers, mmt-signup, Settings, Variables and Secrets,
  plain text). They are not in `wrangler.toml` because this repository is
  public. The older `IEP_FORM_URL` and `LOANER_FORM_URL` are no longer read.
- Deploy with `npx wrangler deploy --keep-vars` so those dashboard variables
  survive the deploy.
