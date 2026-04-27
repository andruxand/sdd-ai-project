````skill
---
name: tailwind-patterns
description: Tailwind CSS v3 — utility-first styling patterns, cn()/cva conventions, design tokens via CSS custom properties, responsive mobile-first approach, dark mode, and Storybook integration. Apply when ui_library = 'tailwind'.
type: conditional
condition: ui_library == 'tailwind'
agents: [frontend-implementer, tester-frontend]
---

## Prerequisite: verify ui_library

Read `ui_library` from `openspec/config.yaml` before styling anything.
This skill applies **only** when `ui_library: 'tailwind'`. If the value is different, stop and use the correct skill.

---

## 1. Project setup (post-bootstrap)

After `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p`:

```js
// tailwind.config.js — required content paths
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/shared/ui/**/*.{ts,tsx}',
  ],
  darkMode: 'class', // mandatory — toggled via <html class="dark">
  theme: {
    extend: {
      colors: {
        // map CSS custom properties → Tailwind tokens
        primary: 'var(--color-primary)',
        surface: 'var(--color-surface)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
````

```css
/* src/index.css — design tokens as CSS custom properties */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-primary: #2563eb;
    --color-surface: #ffffff;
    --font-sans: 'Inter', system-ui, sans-serif;
  }
  .dark {
    --color-primary: #3b82f6;
    --color-surface: #0f172a;
  }
}
```

---

## 2. `cn()` — the only way to compose classes

Install: `npm install clsx tailwind-merge`

```typescript
// src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Rules:

- **Always** use `cn()` for conditional or composed class strings. Never use template literals or ternary string building directly in `className`.
- `twMerge` resolves Tailwind conflicts (`cn('p-4', 'p-2')` → `'p-2'`).

```typescript
// ✅ correct
<button className={cn('px-4 py-2 rounded', isActive && 'bg-primary text-white', className)}>

// ❌ wrong — class conflicts not resolved, hard to follow
<button className={`px-4 py-2 rounded ${isActive ? 'bg-primary text-white' : ''} ${className}`}>
```

---

## 3. `cva` — multi-variant components

Install: `npm install class-variance-authority`

```typescript
// packages/shared/ui/atoms/Button/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  // base classes applied to all variants
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

---

## 4. Responsive — mobile-first

Breakpoints in `tailwind.config.js` defaults:

| Prefix | Min-width |

|--------|-----------|

| `sm:` | 640px |

| `md:` | 768px |

| `lg:` | 1024px |

| `xl:` | 1280px |

| `2xl:` | 1536px |

```typescript
// ✅ mobile-first: base → sm → md → lg
<div className="flex flex-col sm:flex-row md:items-center gap-4 md:gap-6">

// ❌ don't target mobile with a max breakpoint as primary
<div className="hidden max-sm:block"> // use sparingly and only for truly inverted logic
```

---

## 5. Dark mode

- Configure `darkMode: 'class'` in `tailwind.config.js`.
- Toggle by adding/removing `dark` class on `<html>`.
- Reference CSS custom properties in your color tokens so dark mode works via a single CSS variable swap.

```typescript
// hook to toggle
import { useEffect, useState } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}
```

```typescript
// component
<div className="bg-surface text-gray-900 dark:text-gray-100">
```

---

## 6. `@layer` — when to extend Tailwind

```css
@layer components {
  /* reusable component classes extracted to avoid repetition — but prefer cva */
  .card {
    @apply rounded-xl border bg-surface p-6 shadow-sm;
  }
}

@layer utilities {
  /* custom utility not in Tailwind core */
  .text-balance {
    text-wrap: balance;
  }
}
```

Rules:

- Avoid `@apply` in component `.tsx` files — use `cn()` instead.
- Use `@layer components` only for truly global patterns used 5+ times.
- Never use `@apply` to reproduce Tailwind utilities in custom CSS classes that are then used on HTML — it defeats JIT purging and tooling.

---

## 7. Storybook integration

```typescript
// .storybook/preview.ts
import '../src/index.css'; // imports @tailwind directives

export const parameters = {
  backgrounds: {
    default: 'light',
    values: [
      { name: 'light', value: '#ffffff' },
      { name: 'dark', value: '#0f172a' },
    ],
  },
};
```

For dark mode toggling in stories:

```typescript
import { useEffect } from 'react';
import type { Decorator } from '@storybook/react';

export const withDarkMode: Decorator = (Story, context) => {
  const { theme } = context.globals;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return <Story />;
};
```

---

## 8. Mandatory guardrails

| Rule | Rationale |

| ------------------------------------------------------- | --------------------------------------------------- |

| No CSS Modules alongside Tailwind in the same component | Conflicts, two sources of truth |

| No `sx` props (MUI), no `style-components` | One approach per project |

| No inline `style={{}}` for responsive or variant logic | Use Tailwind utilities |

| No hardcoded hex/rgb in `className` | Use tokens via `theme.extend` or CSS variables |

| No `!important` in `@apply` | Indicates a specificity fight — rethink the cascade |

| No arbitrary values (`w-[347px]`) for repeated values | Add to `theme.extend` instead |

---

## 9. TypeScript checklist

- Export `buttonVariants` (or equivalent) so consumers can compose without reimplementing.
- Export `VariantProps<typeof xyzVariants>` as the public props type.
- `cn()` accepts `ClassValue` — no need for `string | undefined | false` dance.

- Never import `classnames` — only use `clsx` (already a dep of `class-variance-authority`).

---

## 10. Anti-patterns

```typescript
// ❌ string concat — class conflicts not resolved
className={`flex ${isFull ? 'w-full' : 'w-auto'}`}

// ❌ inline style for spacing — not responsive, not themeable
style={{ marginTop: 16 }}

// ❌ mixing MUI sx with Tailwind
<Box sx={{ mt: 2 }} className="flex gap-4">

// ❌ hardcoded color not in config
className="bg-[#2563eb]" // add to theme.extend.colors instead

// ❌ purging risk: dynamic class name assembly
className={`text-${color}-500`} // Tailwind JIT can't detect — use full strings
// ✅ safe
const colorClass = { red: 'text-red-500', blue: 'text-blue-500' }[color];
```

```

```
