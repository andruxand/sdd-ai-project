---
applyTo: 'apps/web/**/*.tsx,apps/web/**/*.ts'
---

# Frontend Instructions

## Architecture: FSD + Atomic Design

This project uses **Feature-Sliced Design (FSD)** as the primary structure **from the first file**.
Do NOT default to a flat `components/` folder at any point.

```
apps/web/src/
  app/          Global providers, router, theme. Composition root only.
  pages/        Route-level components. Compose features — no business logic.
  features/     Self-contained slices: ui/ + model/ + api/ + index.ts
  entities/     Domain models shared across 2+ features (read-only).
  shared/       App-level hooks, utils, constants, base HTTP client.

packages/shared/ui/   ← Atomic Design design system
  atoms/        Button, Input, Badge, Icon, Spinner…
  molecules/    FormField, SearchBar, Dropdown…
  organisms/    DataTable, Modal, Header…
```

## Dependency rules (hard)

- Features do NOT import from other features. Compose at page level.
- `shared/ui` atoms/molecules/organisms do NOT import from features or entities.
- New reusable components → `packages/shared/ui/atoms|molecules|organisms/`.
- New feature-only components → `features/<name>/ui/`.

These rules are automatically enforced by `eslint-plugin-boundaries` in `eslint.config.mjs`.
Violations fail `npm run lint` and the dedicated CI step `arch:lint`.
Run `npm run arch:lint` locally to check before pushing.

## React standards

- React 18+ with TypeScript. Functional components + hooks only.
- Component files: `ComponentName.tsx` (PascalCase).
- Co-locate tests as `ComponentName.test.tsx` and stories as `ComponentName.stories.tsx`.
- Use `vitest` + `@testing-library/react` for component tests.
- Prefer `data-testid` for test selectors.
- Never use `any`. Use `unknown` + type narrowing when types are uncertain.
- CSS: CSS Modules or the active `ui_library` conventions. No inline styles for reusable elements.
- Every interactive element: visible label or `aria-label`. Use semantic HTML.
- Import order: React → external libs → internal shared → relative. Enforced by ESLint import/order.
- Do not import from `services/` or `packages/contracts/` directly — use types from `packages/shared/`.

## Storybook — React Query stories

> **Hard rule (DIG-123456):** per-query options in `useQuery({ staleTime: 0, retry: 2 })` **always override** `QueryClient.defaultOptions`. There is no external mechanism to suppress them. MSW cannot prevent loading flashes when `retry: 2` is hard-coded in the hook — the component fires 3 requests before `isError: true` shows.

### Required: split before you story

Before writing any story for a component that wraps a data-fetching hook:

1. **Split** the component into `ComponentView` (pure presentational, props only) + `Component` (thin connected wrapper calling the hook).
2. **Story** the `ComponentView` only — pass `isLoading`, `isError`, `data` as plain `args`.

```tsx
// MyComponent.tsx
export function MyComponentView({ isLoading, isError, data }: MyComponentViewProps) { /* render only */ }
export function MyComponent() {
  const { data, isLoading, isError } = useMyQuery();
  return <MyComponentView data={data} isLoading={isLoading} isError={isError} />;
}

// MyComponent.stories.tsx — zero QueryClient, zero MSW, zero async
export const OK:         Story = { args: { isLoading: false, isError: false, data: { ... } } };
export const ErrorState: Story = { args: { isLoading: false, isError: true,  data: undefined } };
export const Loading:    Story = { args: { isLoading: true,  isError: false,  data: undefined } };
```

### MSW: integration-level stories only

`msw-storybook-addon` (already configured in this project) is appropriate **only** for stories of the connected `Component` — e.g., to document the real fetch lifecycle or run Playwright tests against a mocked API. Always set `retry: false` in the story-local QueryClient when using MSW. URL patterns require a scheme: `http://*/path` not `*/path`.

See `docs/standards/frontend-storybook.md § React Query in Storybook` for full patterns and anti-patterns.
