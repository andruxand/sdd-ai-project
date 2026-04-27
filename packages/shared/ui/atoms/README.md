# atoms/

Smallest indivisible UI units. **No composition logic.**

An atom renders one thing. It accepts props for its variant/state and renders the corresponding HTML element with the correct ARIA and event handlers.

## Rules

- No imports from `molecules/` or `organisms/`.
- No business logic or feature-specific behaviour.
- Every atom **must have a Storybook story** covering all variants and states.
- Story title format: `Atoms/<ComponentName>` (e.g. `Atoms/Button`).

## Existing atoms

- [Button](./Button/Button.tsx)

## Adding a new atom

1. Create `atoms/<Name>/<Name>.tsx` — component + types.
2. Create `atoms/<Name>/<Name>.stories.tsx` — story with all variants.
3. Create `atoms/<Name>/<Name>.test.tsx` — unit tests.
4. Export from `packages/shared/ui/index.ts`.
