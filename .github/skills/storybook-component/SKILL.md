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

```

## Documentation
- Add JSDoc comments to component props for automatic docs generation.
- Use `@storybook/addon-docs` for additional narrative documentation when needed.

## Checklist
- [ ] Story file co-located with component.
- [ ] All meaningful states represented.
- [ ] a11y addon shows no violations.
- [ ] Interaction tests for interactive components.
- [ ] Props documented with JSDoc.
```
