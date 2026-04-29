```skill
---
name: storybook-component
description: Create or update Storybook stories, docs, and interaction/a11y checks for a component.
---

## Before writing a story — inventory check

Load and apply the `component-governance` skill FIRST. Run the inventory check
(Step 1 of that skill) before creating a new story file. If the component already
exists, update its existing story rather than creating a new one.

## Context
Storybook: `apps/web/.storybook/` with addons: `docs`, `a11y`, `interactions`.
Shared UI: `packages/shared/ui/` — every component at every Atomic Design level must have a story.
Stories location: co-located with component (`Button.stories.tsx` next to `Button.tsx`).

## Story title convention (Atomic Design layers)

| Layer      | Title format              | Example                   |
|------------|---------------------------|---------------------------|
| Atoms      | `Atoms/<ComponentName>`   | `Atoms/Button`            |
| Molecules  | `Molecules/<Name>`        | `Molecules/FormField`     |
| Organisms  | `Organisms/<Name>`        | `Organisms/DataTable`     |
| Features   | `Features/<Feature>/<Name>` | `Features/Orders/CreateOrderForm` |

## Story structure
- Default export: `Meta<typeof Component>` with `title` following the **Atomic Design convention** above.
- Add `tags: ['autodocs']` for automatic prop documentation.
- Named exports for each state: `Primary`, `Secondary`, `Disabled`, `Loading`, `Error`.
- Use `args` for prop variations.
- Use `play` function for interaction tests.

## Required states
At minimum, every component story should cover:
- Default/primary state.
- Disabled state (if applicable).
- Error state (if applicable).
- Loading state (if applicable).
- Different sizes/variants (if applicable).

## Accessibility
- a11y addon is enabled — all stories must pass a11y checks.
- If a violation cannot be fixed, document why with a comment.
- Use semantic HTML and ARIA attributes.

## Interaction tests
For interactive components, add `play` function:
```

export const ClickTest: Story = {
play: async ({ canvasElement }) => {
const canvas = within(canvasElement);
await userEvent.click(canvas.getByRole('button'));
expect(canvas.getByText('Clicked')).toBeInTheDocument();
},
};

````

## Documentation
- Add JSDoc comments to component props for automatic docs generation.
- Use `@storybook/addon-docs` for additional narrative documentation when needed.

## React Query / connected components — mandatory decision gate

> **This section must be read before writing any story for a component that calls `useQuery()` or a custom hook built on top of it.**

### The problem with connected component stories

When a hook hard-codes per-query options — `staleTime`, `retry`, `refetchInterval` — directly inside `useQuery({ staleTime: 0, retry: 2 })`, those values **always override** `QueryClient.defaultOptions`. There is no external mechanism to neutralise them:

| Approach | Why it fails |
|---|---|
| `new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })` | Per-query `staleTime: 0` wins. A real `fetch()` fires on mount. |
| `client.setQueryDefaults(key, { queryFn: () => { throw } })` | `queryFn` is async — component renders `isError: false` on first paint (race condition). |
| `queryCache.build() + query.setState()` | Doesn't block the background refetch triggered by `staleTime: 0`. |
| MSW 503 handler | `retry: 2` = 3 total fetches before `isError: true` shows. Loading flash is unavoidable. |

### The correct pattern: presentational / connected split

Split every connected component before writing stories:

```tsx
// ---- ComponentView.tsx  (or export from Component.tsx) ----
// Pure presentational — accepts isLoading / isError / data as props.
// Zero hooks, zero side effects, zero network.
export interface HealthStatusViewProps {
  isLoading: boolean;
  isError: boolean;
  data?: HealthResponse;
}
export function HealthStatusView({ isLoading, isError, data }: HealthStatusViewProps) {
  if (isLoading) return <Spinner />;
  if (isError)   return <Badge color="red">Error</Badge>;
  return <Badge color={data?.status === 'ok' ? 'green' : 'yellow'}>{data?.status}</Badge>;
}

// ---- Component.tsx ----
// Thin connected wrapper — one job: call the hook, delegate to the view.
export function HealthStatus() {
  const { data, isLoading, isError } = useHealthCheck();
  return <HealthStatusView data={data} isLoading={isLoading} isError={isError} />;
}
````

```tsx
// ---- Component.stories.tsx ----
// Target HealthStatusView — plain args, zero QueryClient, zero MSW, zero async.
import type { Meta, StoryObj } from '@storybook/react';
import { HealthStatusView } from './HealthStatus.js';

const meta: Meta<typeof HealthStatusView> = {
  title: 'Features/Health/HealthStatus',
  component: HealthStatusView,
  tags: ['autodocs'],
  argTypes: {
    isLoading: { control: 'boolean' },
    isError: { control: 'boolean' },
    data: { control: 'object' },
  },
};
export default meta;
type Story = StoryObj<typeof HealthStatusView>;

export const OK: Story = {
  args: {
    isLoading: false,
    isError: false,
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  },
};
export const Degraded: Story = {
  args: {
    isLoading: false,
    isError: false,
    data: {
      status: 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  },
};
export const ErrorState: Story = {
  args: { isLoading: false, isError: true, data: undefined },
};
export const Loading: Story = {
  args: { isLoading: true, isError: false, data: undefined },
};
```

### When to use MSW in Storybook

MSW (`msw-storybook-addon`) is appropriate **only** for integration-level stories where you story the connected `Component` (not the view) — for example, to document the real fetch lifecycle in Docs or to run Playwright interaction tests against a mocked API. In that case:

- Use `http://*/path` (scheme required in MSW v2 — `*/path` without scheme never matches).
- Set `retry: false` in the story-local QueryClient — MSW cannot absorb retries without a count limit.
- Pre-populate the cache only for success/degraded states; let MSW drive error and loading states.

For unit/state stories, **always use the presentational/connected split above** — it is zero-risk and zero-async.

## Checklist

- [ ] Story file co-located with component.
- [ ] All meaningful states represented.
- [ ] a11y addon shows no violations.
- [ ] Interaction tests for interactive components.
- [ ] Props documented with JSDoc.
- [ ] **If component calls `useQuery()` or a custom data-fetching hook:** split into `ComponentView` (presentational) + `Component` (connected) before writing stories. Stories target `ComponentView` only.

```

```
