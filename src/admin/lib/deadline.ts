/**
 * "This has taken long enough."
 *
 * The transport already has an upper bound (see `supabase.ts`), but a screen
 * load is several requests deep and a person should never be left looking at a
 * placeholder with nothing to do. `withDeadline` puts a ceiling on a whole
 * load, whatever it is made of, so every loading state has an end.
 */

export class TimeoutError extends Error {
  readonly timeout = true;

  constructor(seconds: number) {
    super(`This is taking longer than ${seconds} seconds. The connection may have stalled.`);
    this.name = 'TimeoutError';
  }
}

export function isTimeout(input: unknown): boolean {
  return Boolean(input && typeof input === 'object' && (input as { timeout?: boolean }).timeout);
}

/**
 * Resolves with `work`, or rejects with a `TimeoutError` once `ms` has passed.
 * The work itself carries on — it is simply no longer being waited for — so a
 * late answer can still be ignored by the caller's own load token.
 */
export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(Math.round(ms / 1000))), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
