import type { ComponentChildren, JSX } from 'preact';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps
  extends Omit<JSX.IntrinsicElements['button'], 'size' | 'icon'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  busy?: boolean;
  /** Leading icon element. */
  icon?: ComponentChildren;
  /** Square icon-only button; pass `aria-label` too. */
  iconOnly?: boolean;
  full?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  icon,
  iconOnly = false,
  full = false,
  class: className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'wb-btn',
    `wb-btn-${variant}`,
    `wb-btn-${size}`,
    iconOnly ? 'wb-btn-icon' : '',
    full ? 'wb-btn-full' : '',
    busy ? 'is-busy' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...rest} type={type} class={classes} disabled={disabled || busy} aria-busy={busy}>
      {busy ? <span class="wb-spinner" aria-hidden="true" /> : icon}
      {!iconOnly && children ? <span class="wb-btn-label">{children}</span> : null}
    </button>
  );
}

/** A link that looks like a button, for hash navigation. */
export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon,
  full = false,
  class: className,
  children,
  ...rest
}: Omit<JSX.IntrinsicElements['a'], 'size'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ComponentChildren;
  full?: boolean;
}) {
  const classes = ['wb-btn', `wb-btn-${variant}`, `wb-btn-${size}`, full ? 'wb-btn-full' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <a {...rest} class={classes}>
      {icon}
      {children ? <span class="wb-btn-label">{children}</span> : null}
    </a>
  );
}
