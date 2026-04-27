# molecules/

Combinations of atoms that form a unit of UI with a focused purpose.

## Rules

- May import from `atoms/`. May NOT import from `organisms/`.
- No feature-specific business logic.
- Every molecule **must have a Storybook story**.
- Story title: `Molecules/<ComponentName>`.

## Common molecules to create

- `FormField` — Label + Input + ErrorMessage
- `SearchBar` — Input + Button + Icon
- `Dropdown` — trigger Button + option list
- `Pagination` — Previous/Next + page indicator
- `EmptyState` — Illustration + heading + description + optional CTA

## Adding a molecule

1. `molecules/<Name>/<Name>.tsx`
2. `molecules/<Name>/<Name>.stories.tsx`
3. `molecules/<Name>/<Name>.test.tsx`
4. Export from `packages/shared/ui/index.ts`
