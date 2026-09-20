import type { ComponentChildren } from 'preact';

export interface EmptyStateProps {
  title: string;
  /** One sentence saying what this list is for. */
  body?: string;
  /** Exactly one clear action, where there is one. */
  action?: ComponentChildren;
  icon?: ComponentChildren;
  tone?: 'plain' | 'warn' | 'bad';
  class?: string;
}

export function EmptyState({ title, body, action, icon, tone = 'plain', class: className }: EmptyStateProps) {
  return (
    <div class={`wb-empty wb-empty-${tone}${className ? ` ${className}` : ''}`}>
      {icon ? <span class="wb-empty-icon" aria-hidden="true">{icon}</span> : null}
      <p class="wb-empty-title">{title}</p>
      {body ? <p class="wb-empty-body">{body}</p> : null}
      {action ? <div class="wb-empty-action">{action}</div> : null}
    </div>
  );
}
