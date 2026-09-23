/**
 * Load timings, for finding out where a slow screen spends its time.
 *
 * Every timed request is recorded in `window.__wbTiming` (a plain array, so
 * it can be read from the console or by a test). With `localStorage
 * ['wb.timing'] = '1'` each one is also printed as it lands:
 *
 *   [wb timing] today.tasks 184 ms (landed 912 ms after the page started)
 *
 * The clock is `performance.now()`, which starts when the page does, so the
 * second number includes the time it took to download the app and check the
 * sign-in: the whole of what a person waits for.
 */
export interface TimingEntry {
  label: string;
  startedAt: number;
  ms: number;
  ok: boolean;
}

declare global {
  interface Window {
    __wbTiming?: TimingEntry[];
  }
}

function printing(): boolean {
  try {
    return window.localStorage.getItem('wb.timing') === '1';
  } catch {
    return false;
  }
}

export function timed<T>(label: string, work: PromiseLike<T>): Promise<T> {
  if (typeof window === 'undefined') return Promise.resolve(work);
  const startedAt = performance.now();
  const finish = (ok: boolean) => {
    const entry: TimingEntry = { label, startedAt: Math.round(startedAt), ms: Math.round(performance.now() - startedAt), ok };
    (window.__wbTiming ??= []).push(entry);
    if (printing()) {
      // eslint-disable-next-line no-console
      console.info(
        `[wb timing] ${label} ${entry.ms} ms (landed ${Math.round(performance.now())} ms after the page started)${ok ? '' : ', failed'}`
      );
    }
  };
  return Promise.resolve(work).then(
    (value) => {
      finish(true);
      return value;
    },
    (error) => {
      finish(false);
      throw error;
    }
  );
}
