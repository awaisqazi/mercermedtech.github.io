# mmt-signup Worker

Receives the Digital Literacy sign-up form from mercermedtech.com, verifies the
Cloudflare Turnstile token, and forwards the answers to the Google Form. The
Google Form address therefore never appears on the public page.

Endpoint: https://mmt-signup.mercermedtech.workers.dev

- `npx wrangler login` once (opens the browser).
- `npx wrangler deploy` from this folder after any change to `worker.js`.
- `npx wrangler secret put TURNSTILE_SECRET` once; paste the widget's secret key
  from Cloudflare → Turnstile. Never commit it.

## /iep-form (IEP intake page)

`POST https://mmt-signup.mercermedtech.workers.dev/iep-form` with JSON
`{"token": "<Turnstile token>"}`. On a valid token solved on mercermedtech.com
the Worker answers `{"ok": true, "url": "<IEP_FORM_URL>"}` and the page
https://www.mercermedtech.com/iep/ (and /es/iep/) puts that URL in its iframe.
Only `https://www.mercermedtech.com` and `https://mercermedtech.com` may call
it; other origins get 403.

- Set `IEP_FORM_URL` once in Cloudflare (Workers, mmt-signup, Settings,
  Variables and Secrets, plain text). It is not in `wrangler.toml` because this
  repository is public.
- Deploy with `npx wrangler deploy --keep-vars` so that dashboard variable
  survives the deploy.
