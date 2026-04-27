# Skill: react-patterns

> Source: react.dev (official React 19 documentation), React RFC/Changelog, TkDodo's React Query blog
> Type: **always-active** — loaded by `@frontend-implementer` and `@tester-frontend` agents

## Scope

React 19 + TypeScript. This skill covers the **React programming model**: rendering, hooks, memoization,
effects, state, composition, concurrent features, and React 19 new APIs.
Apply alongside task-specific skills (`react-query-patterns`, `form-validation-patterns`, etc.).

---

## 1. Rendering model — the mental model

A React component is a **pure function** of its props and state. Every render must produce the
same output for the same inputs. **Side effects belong in event handlers or `useEffect`.**

### When React re-renders

React re-renders a component when:

1. Its own state changes (`useState`, `useReducer`).
2. A context it subscribes to changes.
3. Its parent re-renders (even if props haven't changed — unless wrapped with `React.memo`).

> Key insight: re-renders are **cheap** by default. Only optimize after profiling with React DevTools.

### Component purity rules

```typescript
// ✅ Pure — no side effects during render
function ProductCard({ product }: { product: Product }) {
  const discount = product.price * 0.1; // pure calculation
  return <div>{product.name} — {discount}</div>;
}

// ❌ Impure — mutates external state during render
let count = 0;
function Counter() {
  count++; // side effect during render — breaks Strict Mode, concurrent features
  return <div>{count}</div>;
}
```

---

## 2. useState — rules and patterns

```typescript
// ✅ Functional update — always use when new state depends on previous state
setCount((prev) => prev + 1);

// ❌ Stale closure bug
setCount(count + 1); // if called twice fast, both reads stale count

// ✅ Lazy initializer — for expensive initial values (runs only once)
const [data, setData] = useState(() =>
  JSON.parse(localStorage.getItem('data') ?? '{}'),
);

// ❌ Derived state — never mirror props in state
const [fullName, setFullName] = useState(
  props.firstName + ' ' + props.lastName,
);
// ✅ Compute during render instead
const fullName = `${props.firstName} ${props.lastName}`;
```

### State structure rules

```typescript
// ✅ Group related state
const [position, setPosition] = useState({ x: 0, y: 0 });

// ❌ Unnecessary state — if derivable from other state/props, do NOT store in state
// ✅ Compute during render — cheaper and always in sync
const isExpired = expiresAt < Date.now(); // derived from props, not state

// ✅ Avoid deeply nested state — prefer flat structures
// Avoid: { user: { profile: { address: { city: 'Madrid' } } } }
// Prefer: separate state pieces or normalize to flat map
```

---

## 3. useReducer — when to replace useState

Use `useReducer` instead of `useState` when:

- Next state depends on the previous state AND involves multiple sub-values.
- The update logic is complex enough to be tested independently.
- Multiple actions can cause state transitions (action-driven model).

```typescript
// ✅ useReducer for complex, multi-field state with events
type Action =
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' }
  | { type: 'RESET'; payload: number };

function counterReducer(state: number, action: Action): number {
  switch (action.type) {
    case 'INCREMENT': return state + 1;
    case 'DECREMENT': return Math.max(0, state - 1);
    case 'RESET': return action.payload;
  }
}

function Counter() {
  const [count, dispatch] = useReducer(counterReducer, 0);
  return (
    <div>
      <button onClick={() => dispatch({ type: 'DECREMENT' })}>−</button>
      <span>{count}</span>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
    </div>
  );
}
```

> Rule: reducer must be **pure**. No API calls, no side effects inside the reducer.

---

## 4. useRef — two distinct use cases

### 4a. DOM reference

```typescript
function TextInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = () => {
    inputRef.current?.focus(); // imperative DOM access — only in event handlers
  };

  return <input ref={inputRef} />;
}
```

### 4b. Mutable value that does NOT trigger re-render

```typescript
// ✅ Store interval ID — changing it shouldn't cause a re-render
function Timer() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    intervalRef.current = setInterval(() => {
      /* tick */
    }, 1000);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}

// ✅ Store previous value
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
```

> Anti-pattern: never read or write `ref.current` during render — it breaks concurrent mode.

---

## 5. useEffect — rules, cleanup, and anti-patterns

### The dependency array contract

`useEffect(fn, deps)` runs `fn` after every render where any value in `deps` changed.

```typescript
useEffect(() => {
  /* runs every render */
});
useEffect(() => {
  /* runs once on mount */
}, []);
useEffect(() => {
  /* runs when userId changes */
}, [userId]);
```

**Every value from the component scope used inside useEffect MUST be in deps.**
Use `eslint-plugin-react-hooks` (`exhaustive-deps` rule) — it is mandatory.

### Cleanup pattern

```typescript
useEffect(() => {
  const controller = new AbortController();

  fetchUser(userId, controller.signal).then(setUser);

  return () => {
    controller.abort(); // cleanup: cancel in-flight request on unmount or dep change
  };
}, [userId]);
```

### When NOT to use useEffect

Replace `useEffect` with a direct calculation or event handler whenever possible.

```typescript
// ❌ Anti-pattern: synchronizing state with useEffect
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${firstName} ${lastName}`); // causes double render
}, [firstName, lastName]);

// ✅ Compute during render
const fullName = `${firstName} ${lastName}`;

// ❌ Anti-pattern: fetching in useEffect (use React Query instead)
useEffect(() => {
  fetch('/api/orders')
    .then((r) => r.json())
    .then(setOrders);
}, []);

// ✅ Use React Query
const { data: orders } = useQuery({
  queryKey: ['orders'],
  queryFn: fetchOrders,
});

// ❌ Anti-pattern: initializing third-party library in useEffect
useEffect(() => {
  const map = new MapLibre(containerRef.current!);
}, []);

// ✅ For one-time setup: use a ref initialized on first render instead
const mapRef = useRef<MapLibre | null>(null);
if (containerRef.current && !mapRef.current) {
  mapRef.current = new MapLibre(containerRef.current);
}
```

### Legitimate useEffect use cases

- Subscribe to external store/event (browser event, WebSocket, Intersection Observer).
- Set document title or body attributes reactively.
- Sync with non-React imperative libraries (D3, Leaflet, MapLibre) that need cleanup.
- Set a timer with cleanup.

---

## 6. useMemo — memoize expensive calculations

`useMemo` caches the return value of a function between renders.

### When to use

```typescript
// ✅ Genuinely expensive computation (> 1ms measured with profiler)
const sortedProducts = useMemo(
  () =>
    products
      .filter((p) => p.category === selectedCategory)
      .sort((a, b) => a.price - b.price),
  [products, selectedCategory],
);

// ✅ Stable reference needed as dep for useEffect or child component
const options = useMemo(
  () => ({ timeout: 5000, retries: 3 }),
  [], // object created in render would be new reference every render
);
```

### When NOT to use

```typescript
// ❌ Cheap calculation — useMemo has overhead, not worth it
const total = useMemo(() => price * quantity, [price, quantity]);
// ✅
const total = price * quantity;

// ❌ Never use useMemo for side effects — that's useEffect
const _ = useMemo(() => {
  analytics.track('viewed');
}, []);
```

> Rule: add `useMemo` only after React DevTools Profiler shows the component rendering > 16ms frequently.

---

## 7. useCallback — memoize function references

`useCallback(fn, deps)` returns a stable function reference that only changes when deps change.

### When to use

```typescript
// ✅ Stable callback passed to a React.memo child — prevents child re-render
const handleDelete = useCallback(
  (id: string) => {
    deleteItem(id);
    invalidateQueries({ queryKey: ['items'] });
  },
  [deleteItem, invalidateQueries], // all values from outer scope go in deps
);

// ✅ Callback used as dep in useEffect or another hook
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleKeyDown]); // handleKeyDown must be stable, so wrap it in useCallback
```

### When NOT to use

```typescript
// ❌ Memoizing a callback that is NOT passed to a child or used as a dep
const handleClick = useCallback(() => setCount((c) => c + 1), []);
// ✅ Just define it inline — no benefit from memoization here
const handleClick = () => setCount((c) => c + 1);
```

---

## 8. React.memo — prevent re-renders when props haven't changed

`React.memo` wraps a component and skips re-rendering if props are shallowly equal.

```typescript
// ✅ Expensive child that receives stable props from parent
const ProductRow = React.memo(function ProductRow({
  product,
  onDelete,
}: {
  product: Product;
  onDelete: (id: string) => void;
}) {
  return (
    <tr>
      <td>{product.name}</td>
      <td>
        <button onClick={() => onDelete(product.id)}>Delete</button>
      </td>
    </tr>
  );
});

// Usage: ensure onDelete is stable with useCallback
const handleDelete = useCallback((id: string) => { /* ... */ }, []);
<ProductRow product={p} onDelete={handleDelete} />
```

### Pitfalls

```typescript
// ❌ Passing an inline object — new reference every render, memo is useless
<ProductRow product={{ id: 1, name: 'Shoe' }} onDelete={() => {}} />

// ❌ Wrapping every component — memo has overhead too; only apply where measured
// ✅ Default: don't use memo. Add it when:
//   1. React DevTools profiler shows the component rendering unnecessarily.
//   2. The component renders frequently (e.g., in a long list).
//   3. Its props are stable references (primitives or memoized objects/functions).
```

---

## 9. Context — global state without prop drilling

### When to use Context

- Theme, locale, current user, feature flags — **low-frequency updates**.
- Avoid for high-frequency updates (mouse position, scroll — use Zustand instead).

```typescript
// ✅ Typed context with default guard
type ThemeContextType = { theme: 'light' | 'dark'; toggle: () => void };

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

// Provider — memoize value to prevent all consumers re-rendering on parent updates
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const toggle = useCallback(() => setTheme(t => (t === 'light' ? 'dark' : 'light')), []);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

### Split contexts by update frequency

```typescript
// ❌ One context for both static config and dynamic data
// Every consumer re-renders on every cart change
<AppContext.Provider value={{ user, config, cart }}>

// ✅ Split — config consumers don't re-render when cart changes
<UserContext.Provider value={user}>
  <ConfigContext.Provider value={config}>
    <CartContext.Provider value={cart}>
      {children}
    </CartContext.Provider>
  </ConfigContext.Provider>
</UserContext.Provider>
```

---

## 10. Custom hooks — extraction rules

Extract into a custom hook when:

- Stateful logic is > 5 lines and involves multiple hooks together.
- The same logic is reused in 2+ components.
- You want to test the logic independently of the component.

```typescript
// ✅ Custom hook — combines state + effect + derived values
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue = useCallback(
    (newValue: T | ((val: T) => T)) => {
      const valueToStore =
        typeof newValue === 'function'
          ? (newValue as (val: T) => T)(value)
          : newValue;
      setValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    },
    [key, value],
  );

  return [value, setStoredValue] as const;
}

// ✅ Custom hook for async operation with status
function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    data: T | null;
    error: Error | null;
  }>({ status: 'idle', data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    fn()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', data: null, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
```

### Rules

- Custom hooks MUST start with `use` — enforced by ESLint `rules-of-hooks`.
- Do NOT call hooks inside conditions, loops, or nested functions.
- Custom hooks can call other hooks.
- Keep each hook focused on one concern.

---

## 11. useTransition + startTransition — concurrent features (React 18+)

Mark a state update as **non-urgent** so React can interrupt it and keep the UI responsive.

```typescript
// ✅ Wrap non-urgent updates (search filtering, tab switching)
import { useTransition, useState } from 'react';

function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value); // urgent — update input immediately

    startTransition(() => {
      setResults(filterProducts(value)); // non-urgent — can be deferred
    });
  };

  return (
    <div>
      <input value={query} onChange={handleSearch} />
      {isPending ? <Spinner /> : <ResultsList results={results} />}
    </div>
  );
}
```

> Use `startTransition` for: search filtering, tab switching, route navigation,
> sorting large lists. Do **NOT** use for: form input (must be immediate), animation triggers.

---

## 12. useDeferredValue — defer a derived value

```typescript
// ✅ Show stale results while new results are computed
import { useDeferredValue } from 'react';

function ProductSearch({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  const results = useMemo(
    () => filterProducts(deferredQuery),
    [deferredQuery],
  );

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <ResultsList results={results} />
    </div>
  );
}
```

> `useDeferredValue` vs `useTransition`: use `useDeferredValue` when you don't control the state update
> (e.g., value comes from a parent). Use `useTransition` when you own the dispatch.

---

## 13. React 19 — new APIs

### useOptimistic — optimistic UI updates

```typescript
import { useOptimistic } from 'react';

function LikeButton({ post }: { post: Post }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    post.likes,
    (currentLikes, increment: number) => currentLikes + increment,
  );

  async function handleLike() {
    addOptimisticLike(1); // instantly show +1
    await likePost(post.id); // actual API call — if it fails React reverts
  }

  return <button onClick={handleLike}>❤ {optimisticLikes}</button>;
}
```

### use() — read resources in render (React 19)

```typescript
import { use } from 'react';

// ✅ Read a Promise directly in render (must be wrapped in Suspense)
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // suspends until resolved
  return <div>{user.name}</div>;
}

// ✅ Read context with use() — can be called conditionally (unlike useContext)
function ThemedButton({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'test') return <button>{children}</button>;
  const { theme } = use(ThemeContext); // conditional context read — React 19 only
  return <button className={theme}>{children}</button>;
}
```

### Form Actions (React 19)

```typescript
// ✅ Native form action with useActionState
import { useActionState } from 'react';

async function submitOrderAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const name = formData.get('name') as string;
  try {
    await createOrder({ name });
    return { success: true, error: null };
  } catch {
    return { success: false, error: 'Failed to create order' };
  }
}

function OrderForm() {
  const [state, formAction, isPending] = useActionState(submitOrderAction, {
    success: false,
    error: null,
  });

  return (
    <form action={formAction}>
      <input name="name" />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Order'}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

> **Note**: When using React Hook Form + Zod (see `form-validation-patterns` skill) for complex
> client-side validation, prefer RHF over native Form Actions. Use `useActionState` for simple
> server-submitted forms or server actions without complex client validation.

---

## 14. React.lazy + Suspense — code splitting

```typescript
// ✅ Lazy-load heavy route components
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

function AppRouter() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Suspense>
  );
}

// ✅ Lazy-load heavy components (e.g., rich text editor, chart library)
const RichTextEditor = lazy(() => import('./components/RichTextEditor'));

function ArticleEditor({ isEditing }: { isEditing: boolean }) {
  return (
    <div>
      {isEditing && (
        <Suspense fallback={<div>Loading editor…</div>}>
          <RichTextEditor />
        </Suspense>
      )}
    </div>
  );
}
```

> Always: lazy-load at route level. Additionally: lazy-load components > 30 KB that are
> not needed on initial render (rich editors, charts, maps, PDF viewers).

---

## 15. Error Boundaries

React errors during render in a subtree are caught by the nearest `ErrorBoundary`.
Required for every async feature boundary.

```typescript
// ✅ Use react-error-boundary package (do not write your own class component)
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';

function OrdersErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Failed to load orders: {error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

function OrdersFeature() {
  return (
    <ErrorBoundary FallbackComponent={OrdersErrorFallback}>
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersList />
      </Suspense>
    </ErrorBoundary>
  );
}

// ✅ Programmatic error trigger from child
function useSubmitOrder() {
  const { showBoundary } = useErrorBoundary();
  return async (order: CreateOrderInput) => {
    try {
      await createOrder(order);
    } catch (error) {
      showBoundary(error); // propagate to nearest ErrorBoundary
    }
  };
}
```

---

## 16. List rendering and keys

```typescript
// ✅ Stable, unique keys — use entity IDs
{orders.map(order => (
  <OrderRow key={order.id} order={order} />
))}

// ❌ Index as key — breaks reordering, inserting, deleting
{orders.map((order, idx) => (
  <OrderRow key={idx} order={order} /> // breaks when list changes
))}

// ❌ Random keys — new key every render = unmount + remount
{orders.map(order => (
  <OrderRow key={Math.random()} order={order} />
))}

// ✅ When there is truly no stable ID: generate a stable ID once at data source level
// (e.g., useId() for form elements, crypto.randomUUID() at data generation time)
```

---

## 17. Component composition patterns

### Compound components — expose named sub-components

```typescript
// ✅ Compound component with Context sharing
function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}

Card.Header = function CardHeader({ title }: { title: string }) {
  return <div className="card-header">{title}</div>;
};
Card.Body = function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>;
};

// Usage
<Card>
  <Card.Header title="Order Summary" />
  <Card.Body>...</Card.Body>
</Card>
```

### Render props / children as function — share stateful logic

```typescript
// ✅ Headless component pattern (prefer over HOC)
function DisclosurePanel({
  children,
}: {
  children: (props: { isOpen: boolean; toggle: () => void }) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen(o => !o), []);
  return <>{children({ isOpen, toggle })}</>;
}

// Usage
<DisclosurePanel>
  {({ isOpen, toggle }) => (
    <>
      <button onClick={toggle}>{isOpen ? 'Hide' : 'Show'}</button>
      {isOpen && <Details />}
    </>
  )}
</DisclosurePanel>
```

---

## 18. Performance profiling workflow

Before adding any `memo`, `useMemo`, or `useCallback`:

1. Open React DevTools → **Profiler** tab.
2. Record an interaction that feels slow.
3. Identify components that render frequently with large "actual duration".
4. Only then apply memoization to those specific components.

```
Profiler checklist:
- "Why did this render?" → check "Highlight updates when components render" option.
- If a component shows "0.x ms" actual duration → do NOT memoize, overhead not worth it.
- If a component shows "5+ ms" actual duration AND renders on every keystroke → memoize.
- Use Chrome Performance tab for full-stack (JS + layout + paint) analysis.
```

---

## 19. TypeScript integration patterns

```typescript
// ✅ Explicit prop types with JSDoc
interface ButtonProps {
  /** Visual variant of the button */
  variant: 'primary' | 'secondary' | 'ghost';
  /** Disabled during form submission */
  isLoading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

// ✅ Discriminated union for component states
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// ✅ Generic component
function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  // ...
}

// ✅ Forward ref with proper typing (React 19: no longer needs forwardRef wrapper)
// React 19: ref is just another prop
function TextInput({
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
}) {
  return <input ref={ref} {...props} />;
}

// React < 19 (kept for compatibility reference):
// const TextInput = React.forwardRef<HTMLInputElement, InputProps>(...);
```

---

## 20. Anti-patterns summary

| Anti-pattern                        | Impact                                    | Fix                                 |
| ----------------------------------- | ----------------------------------------- | ----------------------------------- |
| `useEffect` for data fetching       | Waterfall requests, race conditions       | React Query / `use()`               |
| State for derived data              | Double render, stale values               | Compute during render               |
| Missing cleanup in `useEffect`      | Memory leaks, stale subscriptions         | Always return cleanup               |
| Index as list key                   | Broken state on reorder/insert/delete     | Use entity ID                       |
| `React.memo` on everything          | Overhead without benefit                  | Profile first                       |
| Inline objects/arrays as props      | Breaks `memo`, infinite `useEffect` loops | `useMemo` / extract to module level |
| Putting server data in `useState`   | Stale, out-of-sync with server            | React Query                         |
| Calling hooks conditionally         | Breaks rules of hooks, runtime error      | Move condition inside effect        |
| Missing `exhaustive-deps` lint rule | Stale closures, unpredictable behavior    | Enable lint rule, fix all warnings  |
| Giant context (all app state)       | Any change re-renders entire tree         | Split contexts by update frequency  |

---

## Checklist

- [ ] No side effects in render (only in event handlers or `useEffect`).
- [ ] `useEffect` has cleanup for subscriptions, timers, and fetch aborts.
- [ ] `exhaustive-deps` ESLint rule enabled and all warnings resolved.
- [ ] No `useEffect` for derived state — compute during render.
- [ ] No `useEffect` for data fetching — use React Query.
- [ ] Keys are entity IDs, not array indices or `Math.random()`.
- [ ] `React.memo` / `useMemo` / `useCallback` added only after Profiler confirms need.
- [ ] Context split by update frequency (low-freq config vs high-freq dynamic data).
- [ ] Every route lazy-loaded with `React.lazy` + `Suspense`.
- [ ] Every async feature boundary has `<ErrorBoundary>`.
- [ ] Props typed with explicit interfaces — no `any`.
- [ ] `useReducer` used for complex multi-action state transitions.
- [ ] Custom hooks follow `use` prefix convention.
- [ ] React 19 `useOptimistic` used for immediate feedback on mutations.
- [ ] `useTransition` / `startTransition` wraps non-urgent state updates.
