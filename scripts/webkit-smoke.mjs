#!/usr/bin/env node
/**
 * ============================================================================
 * WORKBENCH SMOKE TEST — real WebKit, not "Safari-ish"
 * ============================================================================
 *
 * The portal hung in Safari and nowhere else, so guessing from Chromium was
 * never going to settle it. This builds the site, serves `dist/` on a local
 * port, and drives the real WebKit engine (the one Safari ships) side by side
 * with Chromium, so every number below is a comparison rather than a vibe.
 *
 * ----------------------------------------------------------------- what runs
 *  1. cold-login    An empty browser opens /admin/ and must show the sign-in
 *                   form within 5 s. Records console errors, page errors, and
 *                   every request to the Supabase host with its timing.
 *  2. weblock-held  A Web Lock named `lock:wb.auth` is taken and never let go
 *                   before the app boots. auth-js used to serialise every
 *                   authenticated call behind exactly that lock, and Safari is
 *                   known to leave it held across a reload. This proves
 *                   whether the SDK we ship still touches navigator.locks.
 *  3. auth-stall    A made-up expired session is planted in localStorage and
 *                   the token endpoint is answered by nobody at all. This is
 *                   the real hang: every PostgREST call goes through
 *                   getSession(), getSession() waits on the SDK's
 *                   initializePromise, and that waits on a refresh fetch with
 *                   no deadline of its own. The app must still reach a screen
 *                   a person can act on.
 *  4. rest-stall    A made-up live session, and the REST endpoint answered by
 *                   nobody. This is the owner's screenshot: signed in, on
 *                   #/p/<slug>/overview, skeleton forever. The project screen
 *                   must give up and offer Retry.
 *  5. skeleton-fps  Frames drawn over three seconds while the loading skeleton
 *                   is on screen, because a shimmer that repaints badly reads
 *                   as "the whole thing lags".
 *
 * No account is used and none is needed: every session in here is fabricated
 * locally and every Supabase host request is intercepted, so nothing ever
 * leaves this machine. The signed-in paths (real data, real realtime socket)
 * are therefore NOT covered — see README, "If the Workbench hangs".
 *
 * ------------------------------------------------------------------- running
 *   npx --yes playwright@latest install webkit chromium   # once, ~500 MB
 *   npm i --no-save playwright                            # once, not a dep
 *   node scripts/webkit-smoke.mjs                         # builds, then runs
 *
 *   --no-build      use the dist/ that is already there
 *   --browser=webkit|chromium|both     (default both)
 *   --only=cold-login,auth-stall       run a subset
 *   --headed        watch it happen
 *
 * Exit code 1 if any scenario fails, so it can sit in CI later.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');

/** The Supabase host the built bundle talks to. Read, never hard-coded twice. */
const CONFIG = await readFile(join(ROOT, 'src/admin/lib/config.ts'), 'utf8');
const SUPABASE_URL = /SUPABASE_URL = '([^']+)'/.exec(CONFIG)?.[1] ?? '';
const SUPABASE_HOST = SUPABASE_URL.replace(/^https?:\/\//, '');

/* ------------------------------------------------------------------ flags */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;

const BUILD = !flag('no-build');
const HEADED = flag('headed');
const BROWSERS = value('browser', 'both') === 'both' ? ['webkit', 'chromium'] : [value('browser')];
const ONLY = value('only', '').split(',').filter(Boolean);

/* ------------------------------------------------------- a fabricated session
 *
 * Shaped like a Supabase session and nothing more: the SDK only checks that
 * access_token, refresh_token and expires_at are present. The strings below
 * are invented, grant nothing, and never reach a server — every Supabase
 * request in this file is intercepted before it leaves the browser.
 */
const FAKE_USER_ID = '00000000-0000-4000-8000-000000000001';

function fakeSession({ expired }) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'not-a-real-token.for-the-smoke-test.only',
    refresh_token: 'not-a-real-refresh-token',
    token_type: 'bearer',
    expires_in: expired ? -3600 : 3600,
    expires_at: expired ? now - 3600 : now + 3600,
    user: {
      id: FAKE_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'smoke-test@example.invalid',
      app_metadata: {},
      user_metadata: { full_name: 'Smoke Test' },
      created_at: new Date(0).toISOString(),
    },
  };
}

/* ----------------------------------------------------------- a static server */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

async function serveDist() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path);
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(DIST, '404.html');
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  return { server, origin: `http://127.0.0.1:${port}` };
}

/* ------------------------------------------------------------ page plumbing */

/** Console errors, uncaught errors, and every Supabase request with a timing. */
function instrument(page) {
  const record = { consoleErrors: [], pageErrors: [], warnings: [], requests: [] };
  const started = new Map();

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') record.consoleErrors.push(text);
    if (message.type() === 'warning') record.warnings.push(text);
  });
  page.on('pageerror', (error) => record.pageErrors.push(String(error)));

  page.on('request', (request) => {
    if (!request.url().includes(SUPABASE_HOST)) return;
    started.set(request, Date.now());
    record.requests.push({
      url: shortUrl(request.url()),
      method: request.method(),
      at: Date.now(),
      ms: null,
      status: 'pending',
    });
  });
  const settle = (request, status, code) => {
    if (!started.has(request)) return;
    const entry = record.requests.find((row) => row.status === 'pending' && row.at === started.get(request));
    if (!entry) return;
    entry.ms = Date.now() - started.get(request);
    entry.status = code ?? status;
  };
  page.on('response', (response) => settle(response.request(), 'ok', response.status()));
  page.on('requestfailed', (request) => settle(request, 'failed'));

  return record;
}

function shortUrl(url) {
  return url.replace(/^https?:\/\/[^/]+/, '').replace(/apikey=[^&]+/, 'apikey=…').slice(0, 90);
}

/** Time until a selector shows up, or null if it never does. */
async function timeTo(page, selector, timeout) {
  const start = Date.now();
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return Date.now() - start;
  } catch {
    return null;
  }
}

/** Whichever of these appears first, and how long it took. */
async function raceFor(page, selectors, timeout) {
  const start = Date.now();
  try {
    const which = await page.evaluate(
      ([list, limit]) =>
        new Promise((done) => {
          const check = () => {
            for (const selector of list) {
              const node = document.querySelector(selector);
              if (node && node.getClientRects().length) return done(selector);
            }
            return undefined;
          };
          if (check() !== undefined) return;
          const observer = new MutationObserver(check);
          observer.observe(document.documentElement, { childList: true, subtree: true });
          setTimeout(() => done(null), limit);
        }),
      [selectors, timeout]
    );
    return which ? { which, ms: Date.now() - start } : { which: null, ms: null };
  } catch {
    return { which: null, ms: null };
  }
}

/** Paint timings the engine reports for itself. */
async function paintTimings(page) {
  return page.evaluate(() => {
    const paints = {};
    for (const entry of performance.getEntriesByType('paint')) {
      paints[entry.name] = Math.round(entry.startTime);
    }
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      firstPaint: paints['first-paint'] ?? null,
      firstContentfulPaint: paints['first-contentful-paint'] ?? null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    };
  });
}

/** Frames the compositor actually produced over `ms`, via rAF. */
async function measureFps(page, ms) {
  return page.evaluate(
    (duration) =>
      new Promise((done) => {
        let frames = 0;
        let worst = 0;
        let last = performance.now();
        const stop = last + duration;
        const tick = (now) => {
          const delta = now - last;
          if (delta > worst) worst = delta;
          last = now;
          frames += 1;
          if (now < stop) requestAnimationFrame(tick);
          else done({ fps: Math.round((frames / duration) * 1000), worstFrameMs: Math.round(worst) });
        };
        requestAnimationFrame(tick);
      }),
    ms
  );
}

/* ------------------------------------------------------------- the scenarios */

const DEADLINE = {
  /** The sign-in screen is the fastest thing the app can do. */
  login: 5_000,
  /** How long a scenario waits before calling a hang a hang. */
  hang: 25_000,
};

/** Selectors that mean "a person can do something now". */
const SIGN_IN_FORM = 'input[autocomplete="current-password"]';
const RETRY_BUTTON = '[data-wb-retry]';
const BOOT_SKELETON = '.wb-boot-frame .wb-skeleton';
const PROJECT_SKELETON = '.wb-page .wb-skeleton';
const SLOW_NOTE = '[data-wb-slow]';

const SCENARIOS = {
  /* 1 --------------------------------------------------------------------- */
  async 'cold-login'(page, origin) {
    const record = instrument(page);
    const start = Date.now();
    await page.goto(`${origin}/admin/#/login`, { waitUntil: 'commit' });
    const loginMs = await timeTo(page, SIGN_IN_FORM, DEADLINE.login);
    const paints = await paintTimings(page);
    return {
      pass: loginMs !== null && loginMs < DEADLINE.login,
      detail: {
        signInFormMs: loginMs,
        totalMs: Date.now() - start,
        ...paints,
        supabaseRequests: record.requests.length,
      },
      record,
    };
  },

  /* 2 --------------------------------------------------------------------- */
  async 'weblock-held'(page, origin) {
    const record = instrument(page);
    // Take the lock auth-js has historically used (`lock:<storageKey>`) and
    // never give it back, before a single line of the app runs.
    await page.addInitScript(() => {
      window.__lockHeld = 'no navigator.locks in this engine';
      if (!navigator.locks) return;
      window.__lockHeld = 'pending';
      navigator.locks
        .request('lock:wb.auth', { mode: 'exclusive' }, () => {
          window.__lockHeld = 'held';
          return new Promise(() => {});
        })
        .catch(() => {
          window.__lockHeld = 'failed';
        });
    });
    await page.goto(`${origin}/admin/#/login`, { waitUntil: 'commit' });
    const loginMs = await timeTo(page, SIGN_IN_FORM, DEADLINE.hang);
    const held = await page.evaluate(() => window.__lockHeld);
    return {
      pass: loginMs !== null && loginMs < DEADLINE.login,
      detail: { lockState: held, signInFormMs: loginMs },
      record,
    };
  },

  /* 3 --------------------------------------------------------------------- */
  async 'auth-stall'(page, origin, context) {
    const record = instrument(page);
    // Nobody answers the token endpoint. Not a refusal, not a reset: silence,
    // which is what Safari leaves behind when it suspends a connection.
    await context.route(`**://${SUPABASE_HOST}/auth/v1/token**`, () => {});
    await context.route(`**://${SUPABASE_HOST}/rest/v1/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.addInitScript(
      ([session]) => {
        try {
          localStorage.setItem('wb.auth', JSON.stringify(session));
        } catch {
          /* private mode */
        }
      },
      [fakeSession({ expired: true })]
    );
    const start = Date.now();
    await page.goto(`${origin}/admin/#/`, { waitUntil: 'commit' });
    // Either the app decides the session is no good and shows sign-in, or it
    // shows something with a Retry on it. A skeleton is not an answer.
    const settled = await raceFor(page, [SIGN_IN_FORM, RETRY_BUTTON], DEADLINE.hang);
    const stillSkeleton = await page.locator(BOOT_SKELETON).count();
    return {
      pass: settled.which !== null,
      detail: {
        settledOn: settled.which ?? 'never settled — still on the boot skeleton',
        settledMs: settled.ms,
        bootSkeletonsOnScreen: stillSkeleton,
      },
      record,
    };
  },

  /* 4 --------------------------------------------------------------------- */
  async 'rest-stall'(page, origin, context) {
    const record = instrument(page);
    // A live session, so the app gets past sign-in, and a REST endpoint that
    // never answers: the owner's screenshot, reproduced.
    await context.route(`**://${SUPABASE_HOST}/rest/v1/**`, () => {});
    await context.route(`**://${SUPABASE_HOST}/auth/v1/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await page.addInitScript(
      ([session]) => {
        try {
          localStorage.setItem('wb.auth', JSON.stringify(session));
        } catch {
          /* private mode */
        }
      },
      [fakeSession({ expired: false })]
    );
    const start = Date.now();
    await page.goto(`${origin}/admin/#/p/smoke-test/overview`, { waitUntil: 'commit' });

    // Both numbers are measured from the navigation, not from each other.
    const slowMs = await timeTo(page, SLOW_NOTE, 9_000);
    const slowAt = slowMs === null ? null : Date.now() - start;
    const settled = await raceFor(page, [RETRY_BUTTON], DEADLINE.hang);
    const retryAt = settled.ms === null ? null : Date.now() - start;
    const stillSkeleton = await page.locator(PROJECT_SKELETON).count();
    return {
      pass: settled.which !== null,
      detail: {
        stillLoadingNoticeMs: slowAt,
        retryOfferedMs: retryAt,
        settledOn: settled.which ?? 'never settled — skeleton forever',
        skeletonsOnScreen: stillSkeleton,
      },
      record,
    };
  },

  /* 5 --------------------------------------------------------------------- */
  async 'skeleton-fps'(page, origin, context) {
    const record = instrument(page);
    await context.route(`**://${SUPABASE_HOST}/rest/v1/**`, () => {});
    await context.route(`**://${SUPABASE_HOST}/auth/v1/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await page.addInitScript(
      ([session]) => {
        try {
          localStorage.setItem('wb.auth', JSON.stringify(session));
        } catch {
          /* private mode */
        }
      },
      [fakeSession({ expired: false })]
    );
    await page.goto(`${origin}/admin/#/p/smoke-test/overview`, { waitUntil: 'commit' });
    await page.waitForSelector(PROJECT_SKELETON, { timeout: 10_000 }).catch(() => undefined);
    const frames = await measureFps(page, 3_000);
    return {
      // 50 fps is the floor: below that a person feels it.
      pass: frames.fps >= 50,
      detail: frames,
      record,
    };
  },
};

/* ------------------------------------------------------------------- driver */

function line(char = '─', width = 78) {
  return char.repeat(width);
}

async function main() {
  if (!SUPABASE_HOST) {
    console.error('Could not read SUPABASE_URL out of src/admin/lib/config.ts.');
    process.exit(1);
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.error(
      'playwright is not installed here. It is deliberately not a dependency of the site:\n' +
        '  npm i --no-save playwright\n' +
        '  npx --yes playwright@latest install webkit chromium'
    );
    process.exit(1);
  }

  if (BUILD) {
    console.log('Building the site…');
    const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  const { server, origin } = await serveDist();
  console.log(`\nServing dist/ at ${origin}`);
  console.log(`Supabase host under test: ${SUPABASE_HOST}`);
  console.log(`Engines: ${BROWSERS.join(', ')}\n`);

  const names = ONLY.length ? ONLY : Object.keys(SCENARIOS);
  const results = [];

  for (const engine of BROWSERS) {
    const browser = await playwright[engine].launch({ headless: !HEADED });
    const version = browser.version();
    console.log(`${line('═')}\n${engine}  (${version})\n${line('═')}`);

    for (const name of names) {
      const scenario = SCENARIOS[name];
      if (!scenario) {
        console.log(`  ${name}: no such scenario`);
        continue;
      }
      const context = await browser.newContext();
      const page = await context.newPage();
      let outcome;
      try {
        outcome = await scenario(page, origin, context);
      } catch (error) {
        outcome = { pass: false, detail: { threw: String(error) }, record: null };
      }
      await context.close();

      results.push({ engine, name, ...outcome });
      console.log(`\n  ${outcome.pass ? 'PASS' : 'FAIL'}  ${name}`);
      for (const [key, detail] of Object.entries(outcome.detail)) {
        console.log(`        ${key}: ${detail}`);
      }
      const record = outcome.record;
      if (record) {
        if (record.pageErrors.length) {
          console.log(`        page errors: ${record.pageErrors.length}`);
          for (const error of record.pageErrors.slice(0, 4)) console.log(`          ${error}`);
        }
        if (record.consoleErrors.length) {
          console.log(`        console errors: ${record.consoleErrors.length}`);
          for (const error of record.consoleErrors.slice(0, 4)) console.log(`          ${error}`);
        }
        const deprecation = record.warnings.filter((text) => text.includes('lock'));
        if (deprecation.length) {
          console.log(`        lock-related warnings: ${deprecation.length}`);
          for (const warning of deprecation.slice(0, 2)) console.log(`          ${warning}`);
        }
        if (record.requests.length) {
          console.log(`        supabase requests (${record.requests.length}):`);
          for (const request of record.requests.slice(0, 12)) {
            const timing = request.ms === null ? 'never answered' : `${request.ms} ms`;
            console.log(`          ${request.method} ${request.url}  →  ${request.status} (${timing})`);
          }
        } else {
          console.log('        supabase requests: none were even sent');
        }
      }
    }

    await browser.close();
    console.log('');
  }

  server.close();

  const failed = results.filter((result) => !result.pass);
  console.log(line('═'));
  console.log(`${results.length - failed.length}/${results.length} passed`);
  for (const result of failed) console.log(`  FAIL  ${result.engine} · ${result.name}`);
  process.exit(failed.length ? 1 : 0);
}

await main();
