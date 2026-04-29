/**
 * Augments Vitest's Assertion interface with jest-dom and vitest-axe matchers.
 *
 * This MUST be a module file (has `export {}`) so that `declare module 'vitest'`
 * is treated as an AUGMENTATION rather than a replacement, even though
 * `"types": ["node"]` in tsconfig.base.json limits auto-included types.
 *
 * TypeScript includes all `.d.ts` files matched by `include` in the compilation,
 * so module augmentations here apply globally without manual imports.
 */

declare module 'vitest' {
  // T must match Vitest's Assertion<T> signature for augmentation to merge correctly.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toBeInTheDocument(): void;
    toBeVisible(): void;
    toBeDisabled(): void;
    toBeEnabled(): void;
    toHaveTextContent(
      text: string | RegExp,
      options?: { normalizeWhitespace: boolean },
    ): void;
    toHaveAttribute(attr: string, value?: string | RegExp): void;
    toHaveClass(...classNames: string[]): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toHaveStyle(css: string | Record<string, any>): void;
    toHaveFocus(): void;
    toHaveValue(value?: string | string[] | number | null): void;
    toBeChecked(): void;
    toBePartiallyChecked(): void;
    toBeEmptyDOMElement(): void;
    toBeInvalid(): void;
    toBeRequired(): void;
    toBeValid(): void;
    toContainElement(element: HTMLElement | SVGElement | null): void;
    toContainHTML(htmlText: string): void;
    toHaveDescription(text?: string | RegExp): void;
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): void;
    toHaveErrorMessage(text?: string | RegExp): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toHaveFormValues(expectedValues: Record<string, any>): void;
    toHaveAccessibleDescription(text?: string | RegExp): void;
    toHaveAccessibleName(text?: string | RegExp): void;
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toBeInTheDocument(): void;
    toHaveNoViolations(): void;
  }
}

// Makes this file a MODULE so `declare module 'vitest'` above augments instead of replaces.
export {};
