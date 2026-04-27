/**
 * @deprecated — migration stub.
 *
 * The canonical Button lives in `packages/shared/ui/atoms/Button/Button.tsx`.
 * Once `@project/ui` is added to apps/web dependencies, replace this with:
 *
 *   import { Button } from '@project/ui';
 *   export { Button };
 *
 * This stub keeps existing tests passing during the migration period.
 */
export interface ButtonProps {
  /** Text displayed inside the button. */
  label?: string;
}

/** @deprecated Use {@link Button} from `@project/ui` (packages/shared/ui) instead. */
export function Button({ label = 'Click me' }: ButtonProps) {
  return <button>{label}</button>;
}
