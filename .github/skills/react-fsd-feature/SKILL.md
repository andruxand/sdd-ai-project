```skill
---
name: react-fsd-feature
description: Create a frontend feature following FSD-inspired architecture and shared/ui atomic rules.
---

## Architecture (FSD + Atomic Design)

Use Feature-Sliced Design **from the first file**. Do not default to a flat `components/` folder.

### Layer map

```

apps/web/src/
app/ Global providers, router, theme. Composition root.
pages/ Route components — compose features, no business logic.
features/ Self-contained slices: ui/ + model/ + api/ + index.ts
entities/ Domain models shared across 2+ features (read-only).
shared/ App-level hooks, utils, constants, base HTTP client.

packages/shared/ui/ ← Atomic Design — cross-project primitives
atoms/ Button, Input, Badge, Icon, Spinner, Label, Divider
molecules/ FormField, SearchBar, Dropdown, Pagination
organisms/ DataTable, Modal, Header, Sidebar, NotificationList
tokens/ Design tokens (colors, spacing, typography)

```

### Feature slice structure

```

features/order-creation/
ui/ React components for this feature only
model/ Zustand store, types, Zod schemas, constants
api/ React Query hooks (useQuery, useMutation)
index.ts Public API of this feature — ONLY export what pages need

```

### Dependency rules

- Features do NOT import from other features. Compose at page level.
- Features may import from `entities/`, `shared/`, and `packages/shared/ui/`.
- `packages/shared/ui/` atoms/molecules/organisms do NOT import from features.
- Pages compose features — pages import features, not the other way.

## When to create where

| What                                      | Where                                          |
|-------------------------------------------|------------------------------------------------|
| Button, Input, Badge (cross-project)      | `packages/shared/ui/atoms/<Name>/<Name>.tsx`   |
| FormField, SearchBar (cross-project)      | `packages/shared/ui/molecules/<Name>/<Name>.tsx` |
| DataTable, Modal (cross-project)          | `packages/shared/ui/organisms/<Name>/<Name>.tsx` |
| Hook used by 2+ features in this app      | `apps/web/src/shared/hooks/`                   |
| Domain model used by 2+ features          | `apps/web/src/entities/`                       |
| Component only for one feature            | `features/<name>/ui/`                          |
| Route that composes features              | `pages/`                                       |

## When to create in shared/ui vs feature
- `packages/shared/ui/`: buttons, inputs, modals, cards — reusable across any project.
- `apps/web/src/shared/`: utilities or hooks used across multiple features within this app.
- `apps/web/src/features/X/ui/`: components specific to feature X.

## React patterns for features
- Wrap every feature slice async boundary with `<ErrorBoundary>` (react-error-boundary).
  Provide `features/X/ui/XErrorFallback.tsx` as the named fallback with retry action.
- Data fetching: React Query hooks in `features/X/api/` or `features/X/model/`.
  Never put fetch logic in component bodies.
- URL state: search params for filters, pagination, view modes — shareable and bookmarkable.
- Feature state: Zustand store in `features/X/model/store.ts` if needed across the slice.
- Forms: React Hook Form + Zod schema in `features/X/model/schema.ts`.
- Loading states: Skeleton loaders co-located with their component. Handle `isLoading`, `isError`, empty.

## Code quality
- One component per file. File name matches component name (PascalCase).
- Export only via `features/X/index.ts` — enforce the public API boundary.
- No cross-feature imports — compose at page level only.
- Descriptive names: `CreateOrderForm`, `OrderStatusBadge` — never `Form1`, `Badge`.
- TypeScript strictly: no `any`, explicit return types on hooks and utilities.
- No magic strings — constants in `features/X/model/constants.ts` or shared `shared/constants/`.

## Checklist
- [ ] Feature placed in correct layer.
- [ ] Dependencies flow downward (features -> entities -> shared).
- [ ] No cross-feature imports.
- [ ] Architecture boundaries verified: run `npm run arch:lint` — cross-feature imports and shared-ui violations are ESLint errors.
- [ ] No circular dependencies: `import-x/no-cycle` enforces this in `npm run lint`.
- [ ] Shared/ui primitives have Storybook stories.
- [ ] Feature components have unit/component tests.
- [ ] Types exported through feature's public API (index.ts).
```
