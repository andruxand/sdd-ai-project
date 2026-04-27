# packages/shared/ui — Atomic Design

Cross-project design system primitives. Used by `apps/web` and any future app.

## Structure (Atomic Design)

```
shared/ui/
  atoms/        Smallest indivisible UI units. No composition logic.
                Examples: Button, Input, Badge, Icon, Spinner, Label, Divider
  molecules/    Combinations of atoms that form a unit of UI.
                Examples: FormField (Label + Input + ErrorMessage), SearchBar, Dropdown
  organisms/    Complex sections composed of molecules and atoms.
                Examples: DataTable, Modal, Header, Sidebar, NotificationList
  tokens/       Design tokens: colors, spacing, typography, shadows, breakpoints
  index.ts      Barrel export — all public components exported from here
```

## Rules

- **Atoms** may NOT import from molecules or organisms.
- **Molecules** may import atoms. May NOT import from organisms.
- **Organisms** may import molecules and atoms.
- Nothing here may import from `apps/web/src/features/`, `entities/`, or `pages/`.
- Every component **MUST have a co-located Storybook story**: `Button.stories.tsx` next to `Button.tsx`.
- Components are style-agnostic: accept `className` / `sx` / Tailwind classes per the active `ui_library`.

## Story title convention

| Layer     | Title format          | Example               |
| --------- | --------------------- | --------------------- |
| Atoms     | `Atoms/ComponentName` | `Atoms/Button`        |
| Molecules | `Molecules/Name`      | `Molecules/FormField` |
| Organisms | `Organisms/Name`      | `Organisms/DataTable` |
