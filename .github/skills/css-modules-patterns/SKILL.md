```skill
---
name: css-modules-patterns
description: CSS Modules with TypeScript and Vite — naming conventions, composition, theming with CSS custom properties, responsive utilities, and animations. Apply to all component styling in apps/web and packages/shared/ui.
type: always-active
agents: [frontend-implementer]
---

## When to use CSS Modules vs alternatives

```

Feature component styles → CSS Modules (.module.css)
Design tokens → CSS custom properties in :root (global.css)
Dynamic runtime styles → inline style with CSS var overrides (not className logic)
Conditional variants → data-\* attributes + CSS attribute selectors
Global resets / base → global.css (not modules)
Third-party overrides → :global() inside module

```

Never mix styled-components, Tailwind utilities, and CSS Modules in the same component tree. One approach per project — check `ui_library` in `openspec/config.yaml`.

---

## File naming and co-location

```

features/auth/ui/
LoginForm.tsx
LoginForm.module.css ← co-located, same name
LoginForm.test.tsx
LoginForm.stories.tsx

packages/shared/ui/atoms/Button/
Button.tsx
Button.module.css
Button.test.tsx
Button.stories.tsx

````

Rules:
- One `.module.css` per component file. Never share a module between two components.
- Name matches the component: `Button.tsx` → `Button.module.css`.
- Never put styles in a global `styles/` folder for component-specific styles.

---

## TypeScript integration

Vite generates type declarations automatically. For manual setup or stricter typing:

```typescript
// vite.config.ts — CSS Modules with TypeScript declarations
export default defineConfig({
  css: {
    modules: {
      localsConvention: 'camelCase', // .my-class → styles.myClass
      generateScopedName: '[name]__[local]__[hash:5]', // dev-readable + collision-safe
    },
  },
});
````

```typescript
// Button.tsx
import styles from './Button.module.css';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size?:   'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

export function Button({ variant, size = 'md', disabled, children, onClick }: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

---

## Class composition with `composes`

```css
/* Button.module.css */

/* Base button — all variants inherit */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    box-shadow 150ms ease;
}

.button:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Variants */
.primary {
  composes: button; /* ← CSS Modules composition */
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.secondary {
  composes: button;
  background-color: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}

.ghost {
  composes: button;
  background-color: transparent;
  color: var(--color-text-secondary);
}

/* Sizes */
.sm {
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
}
.md {
  padding: 0.5rem 1.25rem;
  font-size: 1rem;
}
.lg {
  padding: 0.75rem 2rem;
  font-size: 1.125rem;
}
```

Use `composes` to share base styles without duplicating declarations. `composes` must be the first declaration in the rule.

---

## Design tokens via CSS custom properties

```css
/* apps/web/src/app/styles/tokens.css  — loaded once in main.tsx */
:root {
  /* Colors */
  --color-primary: hsl(221deg 83% 53%);
  --color-primary-hover: hsl(221deg 83% 46%);
  --color-on-primary: hsl(0deg 0% 100%);
  --color-text-primary: hsl(220deg 13% 13%);
  --color-text-secondary: hsl(220deg 9% 46%);
  --color-focus-ring: hsl(221deg 83% 53%);
  --color-error: hsl(0deg 72% 51%);
  --color-success: hsl(142deg 71% 45%);

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Typography */
  --font-family-base: 'Inter', system-ui, sans-serif;
  --font-size-base: 1rem;
  --line-height-base: 1.5;
}

/* Dark mode — override tokens only */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: hsl(220deg 13% 91%);
    --color-text-secondary: hsl(220deg 9% 64%);
  }
}
```

**Rules:**

- All colors, spacing, and radii in components use CSS vars, never hard-coded hex/px.
- Tokens live in `tokens.css`, not in individual module files.
- Dark mode overrides only CSS vars — no duplicate rule sets in modules.

---

## Dynamic styles — data attributes over className logic

```tsx
// ❌ Class toggling with conditional logic — hard to read, hard to test
className={`${styles.card} ${isActive ? styles.active : ''} ${hasError ? styles.error : ''}`}

// ✅ Data attributes — clean CSS, easy to select in tests
<div
  className={styles.card}
  data-active={isActive}
  data-error={hasError}
>
```

```css
/* Card.module.css */
.card {
  border: 1px solid var(--color-border);
}
.card[data-active='true'] {
  border-color: var(--color-primary);
}
.card[data-error='true'] {
  border-color: var(--color-error);
}
```

Benefits: No class string manipulation, readable selectors, easy `getByRole` + `data-*` in tests.

---

## Responsive design

```css
/* breakpoints via CSS custom properties (set from JS once if needed) */
/* Or use media queries directly — never use JS for breakpoint logic */

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

Breakpoint values should match the design system. Define them once in `tokens.css` as custom media queries if PostCSS is available, otherwise duplicate them in modules.

---

## Animations

```css
/* ✅ Define keyframes in the module — they are locally scoped */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toast {
  animation: fadeIn 200ms ease-out forwards;
}

/* ✅ Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none;
  }
}
```

- Always provide `prefers-reduced-motion: reduce` fallback for animations.
- Prefer `transform` and `opacity` for animations (GPU composited, no layout thrash).
- Never animate `width`, `height`, `top`, `left` — use `transform: translate/scale` instead.

---

## Global overrides for third-party components

```css
/* ✅ Use :global() for third-party class overrides inside modules */
.container :global(.react-select__control) {
  border-color: var(--color-border);
  border-radius: var(--radius-md);
}

.container :global(.react-select__control--is-focused) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}
```

Confine `global` usage to the component that owns the third-party element. Never write naked `:global()` that bleeds into other components.

---

## Anti-patterns

| Anti-pattern                                    | Problem                          | Fix                                         |
| ----------------------------------------------- | -------------------------------- | ------------------------------------------- |
| Shared `.module.css` between 2+ components      | Tight coupling, breaks isolation | One module per component                    |
| Hard-coded colors/sizes (`color: #3b82f6`)      | Can't theme, drift               | Use CSS custom properties                   |
| Class string manipulation with ternaries        | Hard to read, easy to break      | Use `data-*` attributes                     |
| Animating layout properties (`width`, `height`) | Triggers expensive layout        | Animate `transform`/`opacity`               |
| Missing `prefers-reduced-motion`                | Accessibility violation          | Always pair animations with the media query |
| Importing from another component's module       | Breaks encapsulation             | Extract shared styles to tokens             |
| Using `!important`                              | Cascade hack                     | Increase specificity correctly              |

---

## Checklist

- [ ] One `.module.css` per component, co-located.
- [ ] All colors/spacing use CSS custom properties from `tokens.css`.
- [ ] No hard-coded hex values or pixel sizes (except border-width).
- [ ] Variants use `composes` or `data-*` attributes — no ternary class strings.
- [ ] `prefers-reduced-motion` fallback for all animations.
- [ ] Animations use `transform`/`opacity` only.
- [ ] Third-party overrides scoped with `:global()` inside the owner module.
- [ ] Dark mode handled by CSS var override in `tokens.css` only.
- [ ] `focus-visible` styles on all interactive elements.

```

```
