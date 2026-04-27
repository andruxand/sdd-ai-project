````skill
---
name: component-governance
description: >
  Pre-implementation protocol for any UI component task. Defines when to reuse,
  extend, or create a component from scratch. Covers component API design for
  scalability, deprecation rules, and redundancy prevention.
type: always-active
---

## When to load this skill

Load BEFORE writing any component code. This skill is mandatory for
`@frontend-implementer` and `@tester-frontend` on every component task.

---

## Step 1 — Inventory check (mandatory before any component work)

Before writing a single line of component code, search the shared library:

```bash
# 1. Check packages/shared/ui for an existing component
find packages/shared/ui -type f -name "*.tsx" | sort

# 2. Check apps/web/src/shared for app-level components
find apps/web/src/shared -type f -name "*.tsx" | sort

# 3. Search by concept (e.g. "button", "modal", "table")
grep -rn "export.*function\|export.*const\|export default" packages/shared/ui --include="*.tsx"
````

Only proceed to the decision tree AFTER completing this search.
If there is no result, also check Storybook stories as index:

- stories are co-located: `Button.stories.tsx` → `Button.tsx` exists nearby.

---

## Step 2 — Decision tree

```
TASK: implement component X
        │
        ▼
┌───────────────────────────────────┐
│  Does a component with the same   │
│  semantic role exist in           │
│  packages/shared/ui/ or           │
│  apps/web/src/shared/?            │
└───────────────────────────────────┘
        │
   YES ─┤                      NO
        │                       │
        ▼                       ▼
┌───────────────┐       ┌──────────────────────────────┐
│ Can the new   │       │ Would this component be       │
│ need be met   │       │ reused in 2+ features or      │
│ ONLY by       │       │ projects?                     │
│ passing       │       └──────────────────────────────┘
│ different     │               │
│ props/args?   │          YES──┤           NO
└───────────────┘               │            │
        │                       ▼            ▼
   YES──┤             packages/shared/ui/   apps/web/src/
   NO   │             <layer>/<Name>.tsx    features/<F>/
        ▼                                   ui/<Name>.tsx
┌───────────────────────────────────┐
│ Is the gap a NEW VARIANT or a     │
│ NEW STATE (loading, error, empty, │
│ size, density)?                   │
└───────────────────────────────────┘
        │
   YES: extend the existing component (add prop/variant) — do NOT duplicate
   NO:  the components are semantically different → create new component
        Document WHY in a JSDoc @remarks on the new component
```

### Decision summary table

| Situation                                 | Action                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| Component exists, need = different args   | **Reuse** — pass different props                      |
| Component exists, need = new variant/size | **Extend** — add prop/variant to existing             |
| Component exists, need = new composition  | **Compose** — wrap, do not fork                       |
| Semantically different role               | **Create new** — document why in JSDoc `@remarks`     |
| Similar name but different domain         | **Create new** with distinct name — document in JSDoc |

### Strict rules

- **Never fork** an existing component into a `*Copy`, `*V2`, `*New` file. Extend or compose.
- **Never create** `ButtonPrimary` if `Button` with `variant="primary"` already exists.
- If extending would break existing consumers, open an OpenSpec proposal before proceeding.
- If you find TWO components doing the same thing: deduplicate in the same PR (add to tasks).

---

## Step 3 — Component API design (scalable & extensible)

### 3.1 Props interface rules

```typescript
// ✅ Union type for variants — extensible without breaking existing consumers
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isDisabled?: boolean;
  leftIcon?: React.ReactNode; // slot: icon before label
  rightIcon?: React.ReactNode; // slot: icon after label
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  // Forward all native button attrs — do not redeclare individually
  // Use ComponentPropsWithoutRef to avoid type conflicts
}

// ✅ Extend native element props — consumers can pass any valid HTML attr
type ButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};
```

### 3.2 The 8-prop rule

If a component needs more than 8 props:

1. Identify groups → extract into a sub-component or compound component.
2. Use the `slots` pattern for layout regions.
3. Use a `config` object prop for related options (e.g. `pagination={{ page, pageSize, total }}`).

```typescript
// ❌ Too many props — hard to extend
interface TableProps {
  columns: Column[];
  data: Row[];
  pageSize: number;
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  emptyMessage: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (col: string, dir: 'asc' | 'desc') => void;
}

// ✅ Grouped props — extensible without breaking signature
interface TableProps {
  columns: Column[];
  data: Row[];
  pagination?: PaginationConfig; // { page, pageSize, total, onChange }
  sorting?: SortingConfig; // { column, direction, onChange }
  state?: TableState; // { isLoading, isEmpty, emptyMessage }
}
```

### 3.3 Slots pattern (render props / composition)

Use `slots` when consumers need to customize structural regions of a component:

```typescript
// ✅ Slots — consumers control regions without forking
interface CardProps {
  header?: React.ReactNode;     // slot: title area
  footer?: React.ReactNode;     // slot: action area
  children: React.ReactNode;    // slot: body content
  actions?: React.ReactNode;    // slot: CTA buttons
}

// ✅ Compound component pattern for complex UI
// Card.Header, Card.Body, Card.Footer — consumer assembles the layout
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="card">{children}</div>
);
Card.Header = ({ children }: { children: React.ReactNode }) => (
  <div className="card-header">{children}</div>
);
```

### 3.4 Polymorphic `as` prop

Allow changing the rendered element without prop explosion:

```typescript
// ✅ Polymorphic component — renders as any HTML element or React component
type PolymorphicTextProps<T extends React.ElementType = 'span'> = {
  as?: T;
  children: React.ReactNode;
  variant?: 'body' | 'caption' | 'label';
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children' | 'variant'>;

function Text<T extends React.ElementType = 'span'>({
  as,
  variant = 'body',
  children,
  ...rest
}: PolymorphicTextProps<T>) {
  const Tag = as ?? 'span';
  return <Tag {...rest}>{children}</Tag>;
}

// Consumer: <Text as="h1">Title</Text> — no separate Heading component needed
```

### 3.5 `forwardRef` — mandatory for all leaf components

Any component that renders a single DOM element MUST forward the ref:

```typescript
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, ...props }, ref) => (
    <div>
      <label>{label}</label>
      <input ref={ref} {...props} />
      {error && <span role="alert">{error}</span>}
    </div>
  )
);
Input.displayName = 'Input';
```

### 3.6 TypeScript — public API exports

```typescript
// ✅ Export types from the component file — consumers should not import from internals
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { Button } from './Button';

// In packages/shared/ui/index.ts — barrel export
export * from './atoms/Button';
export * from './atoms/Input';
```

---

## Step 4 — Deprecation protocol

When a component must be replaced (not just extended):

1. **Never delete** in the same PR as the new component. Two-step process:
   - Step 1 PR: mark deprecated, point to replacement.
   - Step 2 PR: remove after all consumers migrated (grep to confirm zero usages).

2. **Mark deprecated with JSDoc + runtime warning (dev only)**:

```typescript
/**
 * @deprecated Since v2.0 — use `<Avatar>` instead.
 * @see {@link Avatar}
 */
export function UserAvatar(props: UserAvatarProps) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[UserAvatar] Deprecated: use <Avatar> instead.');
  }
  return <Avatar {...props} />;
}
```

3. **Storybook**: add `tags: ['deprecated']` and a `### ⚠️ Deprecated` section in the story's docs page.

4. **Zero usages check before deletion**:

```bash
grep -rn "UserAvatar" apps/ packages/ --include="*.tsx" --include="*.ts"
# Must return zero results outside the component file itself
```

---

## Step 5 — Redundancy audit (end of session)

At the end of any frontend implementation session:

```bash
# Check for potential duplicates by fuzzy-matching component names
ls packages/shared/ui/atoms packages/shared/ui/molecules packages/shared/ui/organisms
```

If you find two components with the same role, log it in the PR description
under `## Component governance notes` and create a follow-up task.

---

## Anti-patterns (NEVER do)

| Anti-pattern                                               | Correct approach                    |
| ---------------------------------------------------------- | ----------------------------------- |
| `ButtonPrimary`, `ButtonSecondary` files                   | Single `Button` with `variant` prop |
| `ModalV2.tsx` alongside `Modal.tsx`                        | Extend `Modal` with new props       |
| Copy-paste a component with small changes                  | Compose or use `as` prop            |
| Hardcode `className="text-blue-500"` in a shared atom      | Use design token / variant          |
| `props.type === 'special' && <div>…` inside a generic atom | Extract to a Molecule               |
| Props named `isNewDesign`, `legacyMode`, `useOldBehavior`  | Deprecate and remove                |

```

```
