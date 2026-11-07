/**
 * Shell state that belongs to the whole portal rather than to a screen.
 *
 * On a phone the top bar has room for one action beside the page title
 * ("Log hours", "New task"). The screen knows what that action is and the
 * shell knows where it goes, so the screen hands it over here:
 *
 *   <PhoneAction label="Log hours" onClick={...} />   (components/PageHeader)
 *
 * The page title in the phone top bar travels the same way, from PageHeader.
 */
import type { ComponentChildren } from 'preact';
import { observable, useObservable } from './observable';

export interface TopbarAction {
  /** Who set it, so an unmounting screen only clears its own. */
  owner: string;
  label: string;
  icon?: ComponentChildren;
  onClick: () => void;
}

export interface ShellChrome {
  title: string;
  action: TopbarAction | null;
}

const store = observable<ShellChrome>({ title: '', action: null });

export function useShellChrome(): ShellChrome {
  return useObservable(store);
}

export function setShellTitle(title: string): void {
  store.update((current) => (current.title === title ? current : { ...current, title }));
}

export function setTopbarAction(action: TopbarAction | null): void {
  store.update((current) => ({ ...current, action }));
}

export function clearTopbarAction(owner: string): void {
  store.update((current) => (current.action?.owner === owner ? { ...current, action: null } : current));
}
