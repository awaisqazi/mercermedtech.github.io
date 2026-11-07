/**
 * What a list says when it has nothing in it. The title sits inside the
 * bracket, the portal's one motif (CSS only, `.wb-bracket`), so an empty
 * screen still reads as this house rather than as a missing piece.
 */
import type { ComponentChildren } from 'preact';

export interface EmptyStateProps {
  title: string;
  /** One or two sentences saying what this list is for. */
  body?: ComponentChildren;
  /** Exactly one clear action, where there is one. */
  action?: ComponentChildren;
  tone?: 'plain' | 'warn' | 'bad';
  /** Drops the bracket, for a small empty line inside a panel. */
  quiet?: boolean;
  class?: string;
}

export function EmptyState({ title, body, action, tone = 'plain', quiet = false, class: className }: EmptyStateProps) {
  return (
    <div class={`wb-empty wb-empty-${tone}${quiet ? ' is-quiet' : ''}${className ? ` ${className}` : ''}`}>
      <p class="wb-empty-title">{quiet ? title : <span class="wb-bracket">{title}</span>}</p>
      {body ? <p class="wb-empty-body">{body}</p> : null}
      {action ? <div class="wb-empty-action">{action}</div> : null}
    </div>
  );
}
