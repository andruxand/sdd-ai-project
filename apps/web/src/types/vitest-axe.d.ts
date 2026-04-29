/**
 * Ambient shim declarations for vitest-axe@0.1.0 subpath exports.
 *
 * vitest-axe@0.1.0 has no 'exports' map, so TypeScript 6+NodeNext cannot
 * resolve 'vitest-axe/matchers' or 'vitest-axe/extend-expect' automatically.
 * This file provides stub ambient declarations so the imports compile.
 *
 * TODO: replace vitest-axe with @axe-core/vitest (has proper exports map).
 */

declare module 'vitest-axe/matchers' {
  import type { AxeResults } from 'axe-core';

  export function toHaveNoViolations(
    this: { isNot: boolean },
    received: AxeResults,
  ): { pass: boolean; message(): string };

  const matchers: { toHaveNoViolations: typeof toHaveNoViolations };
  export default matchers;
}

declare module 'vitest-axe/extend-expect' {
  export {};
}
