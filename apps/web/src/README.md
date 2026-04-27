# Feature-Sliced Design (FSD) — apps/web/src

This app follows [Feature-Sliced Design](https://feature-sliced.design) **from day one**, regardless of app size.

## Layer map

```
src/
  app/          Global providers, router, theme setup. Composes pages.
  pages/        Route-level components. Compose features — no business logic here.
  features/     Self-contained feature slices (UI + model + API).
  entities/     Domain models shared across multiple features (read-only, no mutations).
  shared/       App-level utilities, hooks, constants, base HTTP client.
```

## Dependency rules (strictly enforced)

```
app → pages → features → entities → shared
                       ↘           ↗
                        packages/shared/ui  ← atomic design primitives
```

- **Features do NOT import from other features.** Compose at page level.
- `shared/` may not import from `features/`, `entities/`, or `pages/`.
- `packages/shared/ui/` may not import from any layer above.

## Feature slice anatomy

```
features/order-creation/
  ui/               React components (only for this feature)
  model/            Zustand store, types, Zod schemas, constants
  api/              React Query hooks (useQuery, useMutation)
  index.ts          Public API — ONLY export what pages need
```

## When to place code where

| Code type                          | Location                        |
| ---------------------------------- | ------------------------------- |
| Button, Input, Badge (reusable)    | `packages/shared/ui/atoms/`     |
| SearchBar, FormField (reusable)    | `packages/shared/ui/molecules/` |
| DataTable, Modal (reusable)        | `packages/shared/ui/organisms/` |
| Hook used by 2+ features           | `apps/web/src/shared/hooks/`    |
| Domain model used by 2+ features   | `apps/web/src/entities/`        |
| Component only used in one feature | `features/<name>/ui/`           |
| Page that composes features        | `pages/`                        |
