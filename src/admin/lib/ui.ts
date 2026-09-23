/**
 * The two dialogs that belong to the whole portal rather than to a screen:
 * starting a project by hand and importing one from a file. They used to sit
 * on the Projects screen; they are used rarely now, so they live behind the
 * Settings menu (rail footer, project menu, phone "More" sheet) and open from
 * wherever that menu is.
 */
import { observable, useObservable } from './observable';

export type GlobalDialog = 'new-project' | 'import' | null;

const store = observable<GlobalDialog>(null);

export function openGlobalDialog(dialog: GlobalDialog): void {
  store.set(dialog);
}

export function useGlobalDialog(): GlobalDialog {
  return useObservable(store);
}
