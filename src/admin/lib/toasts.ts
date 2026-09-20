/**
 * The one place messages to the user come from. Every failed Supabase call
 * ends up here as one plain sentence; the Toasts component renders them in an
 * aria-live region so a screen reader announces them too.
 */
import { observable, useObservable } from './observable';
import { toAppError } from './errors';

export type ToastTone = 'info' | 'good' | 'warn' | 'bad';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Milliseconds before it fades; 0 keeps it until dismissed. */
  timeout: number;
}

const store = observable<Toast[]>([]);
let nextId = 1;

export function useToasts(): Toast[] {
  return useObservable(store);
}

export function dismissToast(id: number): void {
  store.update((current) => current.filter((toast) => toast.id !== id));
}

function push(tone: ToastTone, message: string, timeout: number): number {
  const id = nextId++;
  store.update((current) => [...current.slice(-3), { id, tone, message, timeout }]);
  if (timeout > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), timeout);
  }
  return id;
}

export const toast = {
  info: (message: string) => push('info', message, 4000),
  good: (message: string) => push('good', message, 3000),
  warn: (message: string) => push('warn', message, 6000),
  /** Errors stay until dismissed: they usually need an action. */
  bad: (message: string) => push('bad', message, 8000),
  /** Shorthand for a failed call. */
  error: (input: unknown, context?: string) => push('bad', toAppError(input, context).message, 8000),
};
