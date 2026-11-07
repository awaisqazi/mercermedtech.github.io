/**
 * The top of every screen: the title in Fraunces, an optional count beside
 * it, and a slot for the screen's actions. It also hands the title to the
 * phone top bar, so a screen names itself once.
 *
 * `PhoneAction` puts the screen's one primary action in the phone top bar
 * (the desktop keeps it in the header's actions slot).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId } from 'preact/hooks';
import { clearTopbarAction, setShellTitle, setTopbarAction } from '../lib/ui';

export interface PageHeaderProps {
  title: string;
  /** A number beside the title: open tasks, people. */
  count?: number | null;
  /** One line under the title. */
  lead?: ComponentChildren;
  /** Buttons, toggles, a search box. Wraps under the title on a phone. */
  actions?: ComponentChildren;
  class?: string;
}

export function PageHeader({ title, count, lead, actions, class: className }: PageHeaderProps) {
  useEffect(() => {
    setShellTitle(title);
  }, [title]);

  return (
    <header class={`wb-page-head${className ? ` ${className}` : ''}`}>
      <div class="wb-page-titles">
        <h1 class="wb-page-title">
          {title}
          {typeof count === 'number' ? (
            <span class="wb-page-count">
              <span class="wb-sr">, </span>
              {count}
            </span>
          ) : null}
        </h1>
        {lead ? <p class="wb-page-lead">{lead}</p> : null}
      </div>
      {actions ? <div class="wb-page-actions">{actions}</div> : null}
    </header>
  );
}

/** Puts one action in the phone top bar while this screen is mounted. */
export function PhoneAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: ComponentChildren;
  onClick: () => void;
}) {
  const owner = useId();
  useEffect(() => {
    setTopbarAction({ owner, label, icon, onClick });
    return () => clearTopbarAction(owner);
    // The handler may be a fresh closure each render; the label is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, label]);
  return null;
}
