/**
 * The smallest useful store: a value, a set of listeners, and a hook.
 *
 * The portal has three long-lived stores (router, auth, project data) that live
 * outside the component tree because they outlast any one screen. Rather than
 * pull in a state library, they all sit on this 40-line base.
 */
import { useEffect, useState } from 'preact/hooks';

export interface Observable<T> {
  get(): T;
  set(next: T): void;
  update(patch: (current: T) => T): void;
  subscribe(listener: (value: T) => void): () => void;
}

export function observable<T>(initial: T): Observable<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();

  const emit = () => {
    for (const listener of [...listeners]) listener(value);
  };

  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      emit();
    },
    update(patch) {
      const next = patch(value);
      if (Object.is(next, value)) return;
      value = next;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Re-renders the component whenever the store changes. */
export function useObservable<T>(store: Observable<T>): T {
  const [value, setValue] = useState<T>(() => store.get());
  useEffect(() => {
    // Between the first render and this effect the value may already have
    // moved on, so sync once before subscribing.
    setValue(store.get());
    return store.subscribe(setValue);
  }, [store]);
  return value;
}

/**
 * Re-renders only when the selected slice changes. Keeps a component that
 * cares about one task out of the re-render for every other task.
 */
export function useSelector<T, S>(
  store: Observable<T>,
  select: (value: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is
): S {
  const [slice, setSlice] = useState<S>(() => select(store.get()));
  useEffect(() => {
    let current = select(store.get());
    setSlice(current);
    return store.subscribe((value) => {
      const next = select(value);
      if (isEqual(current, next)) return;
      current = next;
      setSlice(next);
    });
    // `select` is expected to be stable for the life of the component; callers
    // that close over props pass them through the dependency list themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);
  return slice;
}

/** Shallow array identity check, for selectors that rebuild arrays. */
export function sameArray<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (!Object.is(a[index], b[index])) return false;
  }
  return true;
}
