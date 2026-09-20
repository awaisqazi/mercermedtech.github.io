/**
 * Light, dark, or whatever the operating system says.
 *
 * The choice is written to `data-wb-theme` on `<html>` (the inline script in
 * index.astro reads the same key before the app mounts, so there is no flash)
 * and mirrored onto the `.wb` root, which is where the tokens live.
 */
import { observable, useObservable } from './observable';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'wb.theme';

function read(): ThemeChoice {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = window.localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

const store = observable<ThemeChoice>(read());

function paint(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.wbTheme;
  else root.dataset.wbTheme = choice;
  for (const node of document.querySelectorAll<HTMLElement>('.wb')) {
    if (choice === 'system') delete node.dataset.theme;
    else node.dataset.theme = choice;
  }
}

export function setTheme(choice: ThemeChoice): void {
  store.set(choice);
  try {
    if (choice === 'system') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  paint(choice);
}

/** True when the page is currently showing the dark palette. */
export function isDarkNow(choice: ThemeChoice = store.get()): boolean {
  if (choice === 'dark') return true;
  if (choice === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function useTheme(): {
  choice: ThemeChoice;
  dark: boolean;
  set: (choice: ThemeChoice) => void;
  toggle: () => void;
} {
  const choice = useObservable(store);
  const dark = isDarkNow(choice);
  return {
    choice,
    dark,
    set: setTheme,
    // One button, two states: whatever you are looking at, this flips it.
    toggle: () => setTheme(dark ? 'light' : 'dark'),
  };
}

/** Applies the stored choice to a freshly mounted `.wb` root. */
export function applyTheme(): void {
  paint(store.get());
}
