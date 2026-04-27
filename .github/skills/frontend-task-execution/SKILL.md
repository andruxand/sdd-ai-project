```skill
---
name: frontend-task-execution
description: Execute one approved frontend task group and report UI and Storybook implications.
---

## Context
Architecture: **FSD (Feature-Sliced Design) — strict, from the first file**. Never default to a flat `components/` folder.
UI primitives: `packages/shared/ui/` (Atomic Design: atoms/, molecules/, organisms/).
App code: `apps/web/src/` (app/, pages/, features/, entities/, shared/).
Storybook: `apps/web/.storybook/` with a11y + interactions addons.
UI library: read `ui_library` from `openspec/config.yaml` and apply library-specific conventions
(see `docs/standards/frontend-storybook.md` → UI library conventions).

## Pre-conditions
- Task group must be explicitly approved in OpenSpec tasks.
- Read the proposal, design, and any mockups before starting.
- Determine the correct layer: atom/molecule/organism (shared/ui) OR feature slice (features/).

## Structure conventions (FSD — strict)
- `apps/web/src/app/` — app shell, routing, providers. No business logic.
- `apps/web/src/pages/` — route-level compositions. Compose features, nothing else.
- `apps/web/src/features/<name>/` — feature slices: `ui/` + `model/` + `api/` + `index.ts`.
- `apps/web/src/entities/` — domain models used by 2+ features (read-only).
- `apps/web/src/shared/` — local hooks, utils, constants, base HTTP client.
- `packages/shared/ui/atoms/` — indivisible reusable primitives.
- `packages/shared/ui/molecules/` — combinations of atoms.
- `packages/shared/ui/organisms/` — complex UI sections.

**Dependency rule:** features → entities → shared → packages/shared/ui. No cross-feature imports.

## React patterns (mandatory)
- **Error boundaries**: every feature slice and async boundary must be wrapped with `ErrorBoundary`
  (react-error-boundary). Provide a meaningful fallback UI with retry. Never leave blank screens.
- **Suspense**: lazy-loaded routes and async data use `<Suspense fallback={<Skeleton />}>`.
  Co-locate skeleton components with their parent component.
- **Loading/empty/error states**: every data-fetching component handles all three states explicitly.
- **Server state**: use React Query (`@tanstack/react-query`) — never store server data in component state.
- **Client/UI state**: React context for low-frequency global state; Zustand for complex shared state.
- **Forms**: React Hook Form + Zod schema validation. Validate on submit and on blur.
- **Custom hooks**: extract stateful logic > 3 lines into named hooks in `model/` or `hooks/`.
- **Memoization and React patterns**: full rules for `React.memo`, `useMemo`, `useCallback`, hooks, effects, and composition in the `react-patterns` skill. Short rule: add only after React DevTools Profiler confirms a need.

## Consuming contracts (backend → frontend)
- Before implementing any API call, read the OpenAPI spec (`packages/contracts/rest/openapi.yaml`)
  or GraphQL schema (`packages/contracts/graphql/`) to understand the exact contract.
- Generate TypeScript types from the contract if a codegen tool is configured (e.g. openapi-typescript).
- Never hardcode API response shapes — derive them from contract types.
- If a required endpoint or shape is missing from the contract, stop and notify the orchestrator.
  Do not implement against an undocumented or assumed API shape.
- Include `X-Correlation-ID` and Datadog trace headers on all outgoing fetch calls by configuring
  your HTTP client to forward them automatically.

## Observability
- If Datadog RUM is enabled (`openspec/config.yaml` has `ui_library` set or observability pack active):
  - Call `datadogRum.addAction('event_name', { anonymizedId })` for key user interactions.
  - After authentication: `datadogRum.setUser({ id: hashedId, email: maskedEmail })`.
  - On logout: `datadogRum.clearUser()`.
  - Never include PII in RUM attributes.

## Code craft
- Components do one thing (Single Responsibility).
- PascalCase for components, `use`-prefixed camelCase for hooks — names describe intent.
- No `any` types. No magic values. No inline styles.
- Props interfaces: small and explicit. Over 8 props — split the component or use composition.
- Extract repeated logic to utilities in `shared/utils/` or `shared/hooks/`.

## Execution rules
1. Implement only the approved task group.
2. Reusable across projects -> `packages/shared/ui/`.
3. Reusable within the app -> `apps/web/src/shared/`.
4. Feature-specific -> `apps/web/src/features/<feature>/`.
5. Always add Storybook story for components in `shared/ui`.

## Accessibility
- Use semantic HTML elements.
- Add ARIA attributes when HTML semantics are insufficient.
- Test with Storybook a11y addon.
- Keyboard navigation must work for interactive elements.

## Adding dependencies

Before running `npm install` for any package:

1. Load `dependency-vetting` skill.
2. Follow its 8-step protocol: skill lookup → existing dep check → security audit → license → bundle size impact → peer deps → skill stub if warranted.
3. After any PR comment about a package's usage, update the package's skill immediately (do not wait for a second occurrence).

## Post-implementation checklist
- [ ] Component in correct FSD layer.
- [ ] UI library conventions applied (check `openspec/config.yaml` for `ui_library`).
- [ ] Error boundary wrapping async boundaries.
- [ ] Loading, error, and empty states handled.
- [ ] Storybook story added/updated for shared/ui or meaningful components.
- [ ] Interactive states covered (default, hover, disabled, error, loading).
- [ ] a11y addon shows no violations.
- [ ] Unit/component tests added for logic-heavy components.
- [ ] No `any`, no magic values, no inline styles.
- [ ] Datadog RUM action for key user interactions (if RUM enabled).
- [ ] No sensitive data in UI, fixtures, or stories.
- [ ] API calls typed against contract (not assumed shapes).
- [ ] OpenSpec tasks updated.

## Risk reporting
- Design system impact: none / new primitive / modified primitive.
- Storybook: stories added / updated / no change.
- Contract dependency: does the UI depend on a new/modified API?
```
