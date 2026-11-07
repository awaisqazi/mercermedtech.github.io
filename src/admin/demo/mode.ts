/**
 * Whether this page is the review demo, and as whom.
 *
 * `#/demo` (and anything under it) renders the whole Workbench against an
 * in-memory fixture instead of Supabase, so the design lead and the owner can
 * look at every screen without an account, and the smoke test can drive the
 * signed-in screens without credentials. It is decided once, when the page
 * loads, because the Supabase client is created once: moving between the demo
 * and the real portal reloads the page (see `router.ts`).
 *
 * `#/demo?as=member` or `#/demo?as=finance` signs the demo in as one of the
 * other invented people, so permission gating can be reviewed; `?as=admin`
 * goes back. The choice lasts for the tab (sessionStorage), because the first
 * navigation drops the query.
 *
 * Nothing links here. It is not a secret either: it contains no real data.
 */
export const DEMO: boolean =
  typeof window !== 'undefined' && /^#\/demo(?:[/?]|$)/.test(window.location.hash);

/** The prefix every demo address carries: `#/demo/tasks?view=board`. */
export const DEMO_PREFIX = '/demo';

export type DemoPersona = 'admin' | 'member' | 'finance';

const KEY = 'wb.demo.as';

function readPersona(): DemoPersona {
  if (!DEMO) return 'admin';
  const asked = /[?&]as=(admin|member|finance)\b/.exec(window.location.hash)?.[1] as DemoPersona | undefined;
  try {
    if (asked) window.sessionStorage.setItem(KEY, asked);
    const saved = window.sessionStorage.getItem(KEY);
    if (saved === 'member' || saved === 'finance' || saved === 'admin') return saved;
  } catch {
    /* private mode: the query alone decides */
  }
  return asked ?? 'admin';
}

/** Who the demo is signed in as. Read once, at load. */
export const DEMO_PERSONA: DemoPersona = readPersona();
