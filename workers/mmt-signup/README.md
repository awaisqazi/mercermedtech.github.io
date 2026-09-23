# mmt-signup Worker

Receives the Digital Literacy sign-up form from mercermedtech.com, verifies the
Cloudflare Turnstile token, and forwards the answers to the Google Form. The
Google Form address therefore never appears on the public page.

Endpoint: https://mmt-signup.mercermedtech.workers.dev

- `npx wrangler login` once (opens the browser).
- `npx wrangler deploy` from this folder after any change to `worker.js`.
- `npx wrangler secret put TURNSTILE_SECRET` once; paste the widget's secret key
  from Cloudflare → Turnstile. Never commit it.
