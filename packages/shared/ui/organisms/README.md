# organisms/

Complex UI sections composed of molecules and atoms.

## Rules

- May import from `molecules/` and `atoms/`. May NOT import from features or pages.
- No direct API calls — data comes via props or React Query hooks injected by the page/feature.
- Every organism **must have a Storybook story**.
- Story title: `Organisms/<ComponentName>`.

## Common organisms to create

- `DataTable` — columns, rows, sorting, pagination, empty/loading state
- `Modal` — overlay, title, body slot, footer with action buttons
- `Header` — logo, nav links, user menu
- `Sidebar` — nav tree with collapsible sections
- `NotificationList` — list of toast/notification items
- `PageHeader` — title, breadcrumbs, optional action button

## Adding an organism

1. `organisms/<Name>/<Name>.tsx`
2. `organisms/<Name>/<Name>.stories.tsx`
3. `organisms/<Name>/<Name>.test.tsx`
4. Export from `packages/shared/ui/index.ts`
