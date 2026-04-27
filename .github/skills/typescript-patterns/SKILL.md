````skill
---
name: typescript-patterns
description: TypeScript strict-mode patterns for the full stack — generics, discriminated unions, branded types, utility types, Zod-as-type-source, and common anti-patterns. Applies to every .ts/.tsx file in the monorepo.
type: always-active
agents: [backend-implementer, frontend-implementer, tester-backend, tester-frontend, contracts-implementer]
---

## Compiler settings (tsconfig.base.json — never weaken)

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
````

- `noUncheckedIndexedAccess`: every array/record access returns `T | undefined`. Handle it explicitly.
- `exactOptionalPropertyTypes`: `{ a?: string }` and `{ a: string | undefined }` are different shapes.
- Never add `@ts-ignore`. Use `@ts-expect-error` with a comment explaining why, and only when unavoidable.
- Never use `any`. Use `unknown` + narrowing for external inputs.

---

## Discriminated unions — the primary modeling tool

Use discriminated unions for state machines, results, and polymorphic domain types.

```typescript
// ✅ Discriminated union — exhaustive switch possible
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function render<T>(state: RequestState<T>) {
  switch (state.status) {
    case 'idle':    return null;
    case 'loading': return <Spinner />;
    case 'success': return <Data value={state.data} />;
    case 'error':   return <ErrorView error={state.error} />;
    // TypeScript errors here if a case is unhandled (noImplicitReturns)
  }
}
```

```typescript
// ✅ Domain result type (replaces thrown exceptions in functional pipelines)
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function toResult<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch {
    return { ok: false, error: e as Error };
  }
}
```

---

## Branded / opaque types — prevent primitive obsession

```typescript
// ✅ Brand helper (zero runtime cost)
type Brand<T, B> = T & { readonly __brand: B };

type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;
type Cents = Brand<number, 'Cents'>;

// Constructors validate and brand
function makeUserId(raw: string): UserId {
  if (!raw.match(/^usr_/)) throw new Error('invalid UserId');
  return raw as UserId;
}

// ❌ Type error: cannot pass OrderId where UserId expected
declare function getUser(id: UserId): Promise<User>;
const orderId: OrderId = 'ord_123' as OrderId;
getUser(orderId); // TypeScript error ✅
```

Use branded types for:

- IDs from DynamoDB (`UserId`, `OrderId`, `ProductId`)
- Currency amounts (`Cents`, `EUR`)
- Validated strings (`Email`, `E164Phone`, `Slug`)

---

## Zod as the single source of truth for runtime types

Never write a TypeScript type manually if it comes from an external boundary (HTTP, SQS, env).

```typescript
import { z } from 'zod';

// ✅ Schema first — type derived automatically
const CreateOrderSchema = z.object({
  userId: z.string().min(1),
  items: z.array(
    z.object({ productId: z.string(), qty: z.number().int().positive() }),
  ),
  coupon: z.string().optional(),
});

type CreateOrderInput = z.infer<typeof CreateOrderSchema>; // derived, not hand-written

// ✅ Parse, don't validate
function parseInput(raw: unknown): CreateOrderInput {
  return CreateOrderSchema.parse(raw); // throws ZodError with detailed path
}

// ✅ Safe parse for use cases that need the error shape
const result = CreateOrderSchema.safeParse(body);
if (!result.success) {
  return badRequest(result.error.flatten());
}
```

**Rules:**

- Zod schemas live in `domain/value-objects/` (backend) or `features/<name>/model/schema.ts` (frontend).
- Never duplicate: if the OpenAPI contract defines the shape, generate the Zod schema from it (`openapi-zod-client` or `zod-openapi`).
- `.parse()` on external input boundaries; `.safeParse()` inside use cases.

---

## Generics — when and how

```typescript
// ✅ Constrain generics to meaningful shapes
function first<T extends { id: string }>(items: T[]): T | undefined {
  return items[0];
}

// ✅ Return type inference — let TypeScript infer when obvious
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ✅ Generic repository interface (domain layer)
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}
```

- Limit type parameter count to 3. More than 3 → split the abstraction.
- Name single-purpose generics `T`. Name meaningful ones (`ID`, `Input`, `Output`).
- Avoid `extends object` — use precise constraints.

---

## Utility types — use the built-ins

```typescript
// ✅ Common patterns
type CreateUserDTO = Omit<User, 'id' | 'createdAt'>;
type UpdateUserDTO = Partial<Pick<User, 'name' | 'email'>>;
type UserSummary = Readonly<Pick<User, 'id' | 'name'>>;
type UserByEmail = Record<string, User>;

// ✅ Deep readonly for domain aggregates
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// ✅ Extract union members
type SuccessState = Extract<RequestState<User>, { status: 'success' }>;

// ✅ Template literal types for event naming
type DomainEvent = `${string}Created` | `${string}Updated` | `${string}Deleted`;
```

---

## Type narrowing patterns

```typescript
// ✅ Type guard function
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Record<string, unknown>).id === 'string'
  );
}

// ✅ Assertion function (throws on failure)
function assertDefined<T>(
  value: T | null | undefined,
  msg: string,
): asserts value is T {
  if (value == null) throw new Error(msg);
}

// ✅ Exhaustive check
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

switch (event.type) {
  case 'OrderCreated':
    /* ... */ break;
  case 'OrderCancelled':
    /* ... */ break;
  default:
    assertNever(event); // TypeScript error if new case added to union
}
```

---

## Function overloads — use sparingly

```typescript
// ✅ Only when return type genuinely differs by input type
function parseId(value: string): UserId;
function parseId(value: number): string;
function parseId(value: string | number): UserId | string {
  if (typeof value === 'string') return value as UserId;
  return String(value);
}
```

Prefer discriminated union parameters over overloads when possible.

---

## TypeScript in React components

```typescript
// ✅ Props interface — always explicit, never inline for reusable components
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
  'data-testid'?: string; // allow test selectors
}

// ✅ React 19: forwardRef no longer needed — refs are plain props
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
  label: string;
  error?: string;
}

// ✅ Event handlers — use React synthetic event types
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  /* ... */
};
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  /* ... */
};

// ✅ Children — be explicit
interface CardProps {
  children: React.ReactNode; // any renderable
  icon?: React.ReactElement; // only JSX elements
  renderFooter?: () => React.ReactNode; // render prop
}
```

---

## Async patterns

```typescript
// ✅ Async function always returns a Promise — annotate return type
async function getUser(id: UserId): Promise<User> {
  /* ... */
}

// ✅ Never swallow errors silently
async function safeFetch<T>(url: string): Promise<Result<T>> {
  try {
    const data = await fetchJson<T>(url);
    return { ok: true, value: data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// ✅ Promise.all with typed tuple — preserves individual types
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
// user: User, orders: Order[] — not (User | Order[])[]

// ❌ Never use Promise.all when one failure should not cancel others — use Promise.allSettled
```

---

## Module patterns

```typescript
// ✅ Barrel exports (index.ts) — export public API only
// features/auth/index.ts
export { LoginForm } from './ui/LoginForm';
export { useAuth } from './model/useAuth';
export type { AuthUser } from './model/types';
// Do NOT re-export internal modules

// ✅ Type-only imports — use when importing only types
import type { User } from '@/entities/user';
// Prevents circular dependencies and reduces bundle size
```

---

## Anti-patterns table

| Anti-pattern                                   | Problem                              | Fix                                       |
| ---------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `as any`                                       | Disables type checking               | Use `unknown` + narrowing                 |
| `as Type` casting external data                | No runtime safety                    | Use `ZodSchema.parse()`                   |
| `!` non-null assertion on external data        | Runtime crash                        | Assert with `assertDefined()`             |
| `interface I { [key: string]: any }`           | Defeats the type system              | Use discriminated unions or generics      |
| Duplicating Zod schema as separate TS type     | Drift and maintenance                | `z.infer<typeof Schema>`                  |
| `export default` for everything                | Hard to rename/refactor              | Named exports only                        |
| Importing `type` without `import type`         | Bundle bloat                         | `import type { X }`                       |
| hand-writing `Promise<void>` on event handlers | Unhandled rejection silently ignored | Explicit try/catch or `.catch()`          |
| `T extends any` in generics                    | No constraint                        | Specific constraint or `T extends object` |
| Widening with `as unknown as T`                | Bypasses safety                      | Redesign the abstraction                  |

---

## Checklist

- [ ] No `any`. All external inputs use `unknown` + Zod parsing.
- [ ] All IDs and value types are branded.
- [ ] Discriminated unions for multi-state shapes (loading/success/error, event types).
- [ ] Zod schemas are the single source of truth — TypeScript types derived with `z.infer`.
- [ ] `assertNever` used in switch/if exhaustive checks.
- [ ] Generics constrained meaningfully (not `T extends any`).
- [ ] `import type` for type-only imports.
- [ ] Component props use explicit named interfaces.
- [ ] No `@ts-ignore` (only `@ts-expect-error` with comment).
- [ ] `exactOptionalPropertyTypes` respected — no `| undefined` on optional props unless intentional.

```

```
