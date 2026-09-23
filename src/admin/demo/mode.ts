/**
 * Whether this page is the review demo.
 *
 * `#/demo` (and anything under it) renders the whole Workbench against an
 * in-memory fixture instead of Supabase, so the design lead and the owner can
 * look at every screen without an account, and the smoke test can drive the
 * signed-in screens without credentials. It is decided once, when the page
 * loads, because the Supabase client is created once: moving between the demo
 * and the real portal reloads the page (see `router.ts`).
 *
 * Nothing links here. It is not a secret either: it contains no real data.
 */
export const DEMO: boolean =
  typeof window !== 'undefined' && /^#\/demo(?:[/?]|$)/.test(window.location.hash);

/** The prefix every demo address carries: `#/demo/p/<slug>/plan`. */
export const DEMO_PREFIX = '/demo';
