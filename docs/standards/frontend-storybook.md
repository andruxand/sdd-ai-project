# Frontend & Storybook Standards

## Architecture (FSD-inspired)

- `packages/shared/ui/`: cross-project design system primitives (atoms, molecules, organisms).
- `apps/web/src/features/`: feature slices with UI, logic, and API.
- `apps/web/src/entities/`: domain entities used across features.
- `apps/web/src/shared/`: app-level shared utilities and hooks.
- Features do NOT import from other features — compose at page level.

## Storybook requirements

### Mandatory

- Every component in `packages/shared/ui/` MUST have a Storybook story.
- Story co-located with component: `Button.stories.tsx` next to `Button.tsx`.
- Meta title follows hierarchy: `Shared/Button`, `Features/OrderForm`.

### States to cover

- Default / primary state.
- Disabled state (if applicable).
- Error state (if applicable).
- Loading state (if applicable).
- All size/variant options.

### Addons

- `@storybook/addon-docs`: auto-generated docs from JSDoc on props.
- `@storybook/addon-a11y`: accessibility checks — violations must be fixed.
- `@storybook/addon-interactions`: `play` functions for interaction tests.

### Interaction tests

For interactive components, add `play` function to test user interactions within Storybook.

## Component governance (reuse → extend → create)

Before implementing any component, agents MUST run an inventory check (see skill `component-governance`).

### Decision order

1. **Reuse** — component exists and the need is met by passing different props.
2. **Extend** — component exists but needs a new variant, state, or size → add the prop.
3. **Compose** — wrap the existing component in a new composition layer.
4. **Create new** — semantically different role → document with JSDoc `@remarks`.

> **Never** fork (`ButtonV2`, `ModalNew`), never delete without a two-step deprecation PR.

### Naming rules

- Name after the semantic role, not the visual appearance: `Avatar` not `CircleImage`.
- No `*Primary`, `*Secondary` suffix files — use `variant` prop.
- No `*V2` or `*Legacy` suffixes — deprecate and migrate.

### Deprecation

- Mark with `@deprecated` JSDoc and `console.warn` (dev-only).
- Add `tags: ['deprecated']` in the Storybook story.
- Delete only after `grep` confirms zero consumer usages.

### Scalable prop API

- Prefer union types for variants: `variant?: 'primary' | 'secondary' | 'ghost'`.
- Extend native element props via `React.ComponentPropsWithoutRef<'button'>` — do not redeclare HTML attrs.
- Use `slots` (render prop regions) for structural customization instead of brittle boolean flags.
- Apply `forwardRef` to all leaf DOM-rendering components.
- Split props into grouped objects if a component exceeds 8 props.
- Polymorphic `as` prop for elements that can render as different HTML tags.

## Component guidelines

- Use semantic HTML elements.
- Add ARIA attributes when HTML semantics are insufficient.
- Support keyboard navigation for all interactive elements.
- Export types through the component's public API.
- Add JSDoc comments to all component props.

## Anti-patterns

- Do NOT create components without stories in `shared/ui`.
- Do NOT skip a11y violations without documented justification.
- Do NOT use inline styles — use CSS modules, styled-components, or Tailwind.
- Do NOT import from `features/` inside `shared/ui/`.
- Do NOT create `ButtonPrimary.tsx` — use `Button variant="primary"`.
- Do NOT fork a component with `V2` or `Copy` suffix — extend or compose.
- Do NOT remove a component without a two-step deprecation PR.

## React component patterns

- **Error boundaries**: wrap every feature slice and every async boundary with an `ErrorBoundary`.
  Use `react-error-boundary` library. Provide fallback UI with retry action, never blank screens.
- **Suspense**: use `<Suspense fallback={<Skeleton />}>` for lazy-loaded routes and async data.
  Co-locate skeleton loaders with their component, not in page files.
- **Loading states**: every component that fetches data must handle `isLoading`, `isError`, and empty states.
  Use skeleton loaders (not spinners) for content that has a known shape.
- **State management**:
  - Server state: React Query (`@tanstack/react-query`) — never store server data in component state.
  - Client/UI state: React context or Zustand for cross-feature shared state.
  - Form state: React Hook Form + Zod for validation.
  - URL state: prefer URL params / search params over local state for shareable views.
- **Memoization**: apply `React.memo`, `useMemo`, `useCallback` only when profiling confirms a need.
  Premature memoization adds noise without measurable benefit.
- **Custom hooks**: extract any stateful logic beyond 3 lines into a named hook in `hooks/` or the
  feature's `model/` folder. Hooks should be testable in isolation.
- **Prop design**: prefer composition over prop drilling beyond 2 levels. Use React context or
  component slots. Keep prop interfaces small — if a component has more than 8 props, split it.

## Frontend security & runtime hardening

### React Strict Mode

Wrap the app root in `<React.StrictMode>` in all non-production-equivalent environments.
Strict Mode surfaces double-invocation bugs and deprecated lifecycle warnings during development.

```tsx
// apps/web/src/main.tsx
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### Vite env var typesafety

Every `import.meta.env.*` access MUST be typed. Extend `ImportMetaEnv` in
`src/vite-env.d.ts` (already generated by Vite) and add project-specific vars:

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DD_APPLICATION_ID: string;
  readonly VITE_DD_CLIENT_TOKEN: string;
  readonly VITE_ENV: 'development' | 'staging' | 'production';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Validate required env vars at app startup (before `createRoot`):

```ts
const REQUIRED = ['VITE_API_BASE_URL', 'VITE_ENV'] as const;
for (const key of REQUIRED) {
  if (!import.meta.env[key]) throw new Error(`Missing env var: ${key}`);
}
```

### Code splitting and lazy loading

Route-level code splitting is mandatory. Use `React.lazy()` + `Suspense` per route
so that only the active feature's bundle is loaded:

```tsx
const OrdersPage = React.lazy(
  () => import('./features/orders/pages/OrdersPage'),
);

<Suspense fallback={<PageSkeleton />}>
  <OrdersPage />
</Suspense>;
```

- Never statically import page-level components into the router.
- Feature-level dynamic imports are encouraged for heavy sub-components.

### Content Security Policy

Configure CSP at the infrastructure layer (CloudFront response headers policy or
API Gateway), not via `<meta http-equiv>` tags (which cannot block navigation
requests). Minimum recommended directives:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';   # relax only if UI library requires it
img-src 'self' data: https:;
connect-src 'self' https://api.datadoghq.com;
frame-ancestors 'none';
```

- `unsafe-eval` is forbidden \u2014 confirm bundler does not require it.
- Report violations to a `/csp-report` endpoint or Datadog Logs.
- Document any relaxed directive with a justification comment in IaC.

### Lighthouse CI performance budget

Every PR to `apps/web/**` triggers a Lighthouse CI run (`.github/workflows/lighthouse.yml`)
that enforces performance budgets defined in `.lighthouserc.cjs`.

Current budgets (adjust in `.lighthouserc.cjs` — never relax without team agreement):

| Metric                   | Budget    | Severity             |
| ------------------------ | --------- | -------------------- |
| Performance score        | ≥ 80      | warn                 |
| Accessibility score      | ≥ 90      | error (blocks merge) |
| Best Practices score     | ≥ 90      | error (blocks merge) |
| Largest Contentful Paint | ≤ 2500 ms | error (blocks merge) |
| Total Blocking Time      | ≤ 300 ms  | error (blocks merge) |
| Cumulative Layout Shift  | ≤ 0.1     | error (blocks merge) |
| Total bundle weight      | ≤ 500 KB  | warn                 |
| Unused JavaScript        | ≤ 100 KB  | warn                 |

**If a budget is failing:**

1. Run locally: `npm run build --workspace=apps/web && npx @lhci/cli autorun`.
2. Inspect `.lighthouseci/` reports for the specific failing audit.
3. Fix the root cause (lazy loading, image optimization, CLS-causing layout shift).
4. Do not relax the budget thresholds to make the check pass.

**Accessibility errors block merge** (`error` severity). Accessibility is not optional.

## Code quality

- **Single Responsibility**: one reason to change per component, hook, or utility.
- **Naming**: components are PascalCase and describe what they render (`OrderSummaryCard`, not `Card2`).
  Hooks are `use`-prefixed and describe their purpose (`useOrderStatus`, not `useData`).
- **No magic values**: extract strings, numbers, and configuration into named constants.
- **TypeScript strictly**: no `any`, explicit prop types, no non-null assertions (`!`) without comment.
- **Accessibility first**: design for keyboard, screen reader, and color-blind users from the start.
  ARIA should supplement semantic HTML, not replace it.
- **Observability**: instrument key user actions with Datadog RUM `addAction` calls.
  Follow `docs/standards/aws-logging-observability.md` for RUM setup and privacy rules.

## UI library conventions

The project's UI library is defined at bootstrap time (`ui_library` in `openspec/config.yaml`).
Agents must read this value at session start and apply the corresponding conventions below.

---

### `tailwind`

- **Class composition**: always use `cn()` (clsx + tailwind-merge) for conditional classes — never string interpolation.
- **Design tokens**: prefer CSS custom properties (`var(--color-primary)`) over hardcoded Tailwind values in reusable components.
- **No custom CSS classes** except for tokens. Utility-first throughout.
- **Component variants**: use `cva` (class-variance-authority) for multi-variant components.
- **Responsive**: mobile-first (`sm:`, `md:`, `lg:` prefixes). Never use inline media queries.
- **Dark mode**: use Tailwind's `dark:` modifier. Configure `darkMode: 'class'` in `tailwind.config`.
- **Never mix**: no `sx` props, no styled-components, no CSS Modules alongside Tailwind in the same component.

### `mui`

- **Theme first**: define typography, palette, shape, and spacing in a single `createTheme()` call in `app/theme.ts`. Never override per-component.
- **`sx` prop**: use only for one-off layout adjustments. Extract to `styled()` or theme overrides if the same `sx` appears more than once.
- **MUI components over raw HTML**: use `<Box>`, `<Stack>`, `<Typography>` etc. Never render a raw `<div>` when an MUI primitive exists.
- **No inline `style`** objects.
- **`styled()` API**: for components that need complex or repeated style logic.
- **TypeScript**: always pass `theme` to `sx` callbacks (`sx={{ mt: (t) => t.spacing(2) }}`). No magic numbers.

### `antd`

- **Global theme**: configure all design decisions in `<ConfigProvider theme={{ token: {…} }}>` at the app root. Never in individual components.
- **No inline `style` props** on Ant Design components — use `className` with CSS Modules or the token system.
- **Layout**: use Ant Design's `Space`, `Flex`, and `Grid` layout primitives, not raw CSS flexbox/grid.
- **Form**: always use Ant Design's `<Form>` + `<Form.Item>` with `rules` for validation. Integrate with React Hook Form only if Ant Form is insufficient.
- **Icons**: import from `@ant-design/icons` only — no mixing with other icon libraries.

### `chakra`

- **`ChakraProvider`**: wrap the app root with a single `<ChakraProvider theme={customTheme}>`. Define customTheme in `app/theme.ts`.
- **Chakra primitives first**: use `<Box>`, `<Flex>`, `<Text>`, `<Heading>` etc. No raw HTML except semantic structure (`<main>`, `<nav>`, `<section>`).
- **Style props over `sx`**: use Chakra's shorthand style props (`mt`, `px`, `bg`) directly on components.
- **Dark mode**: use `useColorMode()` — never hardcode light/dark colors.
- **No CSS Modules alongside Chakra**. Only Chakra style props.

### `bootstrap`

- **Always via `react-bootstrap`**: never use raw `className="btn btn-lg"`. Import `<Button variant="lg">` from `react-bootstrap`.
- **Theme customization**: via SCSS variable overrides in `src/styles/_variables.scss`, not inline styles or `!important`.
- **Spacing / layout**: Bootstrap Grid (`<Container>`, `<Row>`, `<Col>`) for page layout. No custom grid.
- **No mixing**: do not use Tailwind utilities alongside Bootstrap classes in the same component.

### `none`

- **CSS Modules per component**: one `.module.css` file per component, co-located.
- **BEM-inspired naming** in module files: `.root`, `.label`, `.icon--active`.
- **Design tokens**: define all colors, spacing, and typography in `shared/tokens/tokens.css` as CSS custom properties.
- **No inline styles** for reusable components.

## Checklist

- [ ] Story file co-located with component.
- [ ] All meaningful visual states represented (default, disabled, error, loading, empty).
- [ ] a11y addon shows no violations.
- [ ] Interaction tests for interactive components.
- [ ] Props documented with JSDoc.
- [ ] Component in correct architectural layer.
- [ ] Error boundary wrapping async feature boundaries.
- [ ] Loading/skeleton state handled.
- [ ] No `any` types, no magic values, no inline styles.
- [ ] Datadog RUM `addAction` for key user interactions (if RUM enabled).
- [ ] Lighthouse CI green (performance + accessibility budgets).
- [ ] Feature flag guard in place for rollback-sensitive features.
