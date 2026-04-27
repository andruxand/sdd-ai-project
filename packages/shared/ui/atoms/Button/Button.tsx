export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  /** Text displayed inside the button. */
  label: string;
  /** Visual style variant. @default 'primary' */
  variant?: ButtonVariant;
  /** Size preset. @default 'md' */
  size?: ButtonSize;
  /** Disables interaction and applies muted styling. @default false */
  disabled?: boolean;
  /** Shows a loading spinner and disables interaction. @default false */
  loading?: boolean;
  /** Click handler. */
  onClick?: () => void;
  /** Additional class names (Tailwind / CSS Modules). */
  className?: string;
  /** Accessible label when the visible label is insufficient. */
  'aria-label'?: string;
}

/**
 * **Button — Atom**
 *
 * The foundational interactive element. All clickable actions in the app
 * should trace back to this component.
 *
 * Do NOT add domain logic here. If you need special behavior, compose this
 * with a molecule or feature-level wrapper.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className,
  'aria-label': ariaLabel,
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-busy={loading}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {loading ? <span aria-hidden="true">…</span> : label}
    </button>
  );
}
