```skill
---
name: zustand-patterns
description: Zustand client state management — store design, slices, selectors, devtools, persistence, React Query boundary, and testing. Use whenever managing UI or client-only state.
type: always-active
agents: [frontend-implementer, tester-frontend]
---

## State boundary rule — decide before creating a store

```

Server state → React Query (async, cached, synced with API)
URL state → search params / router state (shareable, bookmarkable)
Form state → React Hook Form (ephemeral, validated)
UI state → React useState / useReducer (local, component-scoped)
Client state → Zustand (global, shared across features, non-server, non-URL)

````

**Only reach for Zustand when state must be:**
1. Shared across 2+ unrelated components/features AND
2. Not derivable from server state (React Query) AND
3. Not ephemeral enough for `useState`

Examples of valid Zustand state: shopping cart, notification queue, selected workspace, sidebar collapsed, theme override, active filters (when shared across tabs).

---

## Store creation — typed, minimal surface

```typescript
// features/cart/model/cart.store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CartItem } from '@/entities/cart';

interface CartState {
  items: CartItem[];
  // Actions co-located — no separate actions file needed for small stores
  addItem:    (item: CartItem) => void;
  removeItem: (productId: string) => void;
  clear:      () => void;
}

export const useCartStore = create<CartState>()(
  devtools(
    persist(
      (set) => ({
        items: [],

        addItem: (item) =>
          set(
            (state) => ({
              items: state.items.some((i) => i.productId === item.productId)
                ? state.items.map((i) =>
                    i.productId === item.productId
                      ? { ...i, qty: i.qty + item.qty }
                      : i
                  )
                : [...state.items, item],
            }),
            false,           // replace: false — merge with existing state
            'cart/addItem',  // devtools action name
          ),

        removeItem: (productId) =>
          set(
            (state) => ({ items: state.items.filter((i) => i.productId !== productId) }),
            false,
            'cart/removeItem',
          ),

        clear: () => set({ items: [] }, false, 'cart/clear'),
      }),
      { name: 'cart-storage' }, // localStorage key
    ),
    { name: 'CartStore' },      // devtools store name
  ),
);
````

**Rules:**

- Always wrap with `devtools()` in development — essential for debugging.
- Add action name strings as third arg to `set()` — shows up in Redux DevTools.
- State must be serializable (no functions, no class instances, no `Date` objects — store ISO strings).
- Never mutate state directly. Always return a new object from `set()`.

---

## Selectors — always extract, never select the whole store

```typescript
// ❌ Rerenders on ANY state change
function CartBadge() {
  const cart = useCartStore();
  return <Badge count={cart.items.length} />;
}

// ✅ Memoized selector — only rerenders when items.length changes
function CartBadge() {
  const itemCount = useCartStore((s) => s.items.length);
  return <Badge count={itemCount} />;
}

// ✅ For derived values, co-locate selector factory with store
export const selectCartTotal = (s: CartState) =>
  s.items.reduce((acc, item) => acc + item.price * item.qty, 0);

// Usage
const total = useCartStore(selectCartTotal);
```

**For stable computed values across multiple selectors, use `useShallow`:**

```typescript
import { useShallow } from 'zustand/react/shallow';

// ✅ Only rerenders when items or coupon changes — not other store fields
const { items, coupon } = useCartStore(
  useShallow((s) => ({ items: s.items, coupon: s.coupon })),
);
```

---

## Slices — composing large stores

Split large stores into slices. Each slice = one domain concern.

```typescript
// stores/slices/ui.slice.ts
import type { StateCreator } from 'zustand';
import type { RootStore } from '../root.store';

export interface UISlice {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const createUISlice: StateCreator<RootStore, [], [], UISlice> = (
  set,
) => ({
  sidebarOpen: true,
  toggleSidebar: () =>
    set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, 'ui/toggleSidebar'),
});

// stores/root.store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createUISlice, type UISlice } from './slices/ui.slice';
import { createCartSlice, type CartSlice } from './slices/cart.slice';

export type RootStore = UISlice & CartSlice;

export const useRootStore = create<RootStore>()(
  devtools(
    (...args) => ({
      ...createUISlice(...args),
      ...createCartSlice(...args),
    }),
    { name: 'RootStore' },
  ),
);
```

Use slices when a store grows beyond ~5 state keys or 5 actions.

---

## Persistence — what to persist and what not to

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';

// ✅ Persist only UI preferences and cart — not loading/error states
export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system' as 'system' | 'light' | 'dark',
      language: 'en',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'user-prefs', // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, language: s.language }), // persist only these fields
      version: 1, // increment when shape changes
      migrate: (persisted, version) => {
        // handle old shape
        if (version === 0) return { ...persisted, language: 'en' };
        return persisted as PrefsState;
      },
    },
  ),
);
```

**Rules:**

- Persist only user preferences and cart-like data. Never persist auth tokens or server data.
- Always include a `version` + `migrate` when the persisted shape can evolve.
- Use `partialize` to whitelist what gets stored — never persist actions or derived state.
- Use `sessionStorage` for session-scoped state.

---

## Accessing store outside components (use sparingly)

```typescript
// ✅ Imperative access for non-React code (event handlers, services)
import { useCartStore } from '@/features/cart/model/cart.store';

async function onCheckoutComplete() {
  useCartStore.getState().clear(); // imperative — no hook needed
}

// ✅ Subscribe to changes outside React (analytics, side-effects)
const unsubscribe = useCartStore.subscribe(
  (state) => state.items,
  (items) => analytics.track('cart_changed', { count: items.length }),
);
// Call unsubscribe() when no longer needed
```

---

## React Query ↔ Zustand boundary

```typescript
// ✅ Server state drives local optimistic UI state
// After a successful mutation, update the Zustand store only if needed
// for immediate UI feedback not covered by React Query's own cache

const { mutate: addToCart } = useMutation({
  mutationFn: addCartItemApi,
  onMutate: async (newItem) => {
    // Optimistic update in Zustand UI store (badge count etc.)
    useCartStore.getState().addItem(newItem);
  },
  onError: (_err, newItem) => {
    // Rollback
    useCartStore.getState().removeItem(newItem.productId);
  },
  onSettled: () => {
    // Let React Query sync truth from server
    queryClient.invalidateQueries({ queryKey: cartKeys.all });
  },
});
```

If React Query already holds the truth, **do not mirror it into Zustand**. That creates two sources of truth.

---

## Testing Zustand stores

```typescript
// ✅ Reset store between tests — mandatory for isolation
import { act } from '@testing-library/react';
import { useCartStore } from './cart.store';

beforeEach(() => {
  act(() => useCartStore.setState({ items: [] }));
});

it('addItem increases item count', () => {
  act(() => {
    useCartStore.getState().addItem({ productId: 'p1', qty: 1, price: 10 });
  });
  expect(useCartStore.getState().items).toHaveLength(1);
});

// ✅ Testing components that use the store — wrap with real store
import { renderWithProviders } from '@/test-utils'; // includes QueryClientProvider

it('CartBadge shows correct count', () => {
  act(() => useCartStore.setState({ items: [{ productId: 'p1', qty: 2, price: 5 }] }));
  const { getByRole } = renderWithProviders(<CartBadge />);
  expect(getByRole('status')).toHaveTextContent('1');
});
```

---

## Anti-patterns

| Anti-pattern                                    | Problem                               | Fix                                           |
| ----------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| Selecting entire store (`useStore()`)           | Component rerenders on any change     | Use field selector `useStore((s) => s.field)` |
| Storing server data in Zustand                  | Two sources of truth                  | Use React Query for server state              |
| Storing loading/error state in Zustand          | Duplicates React Query's state        | Remove — use `useQuery` states                |
| Mutating state directly (`state.items.push(x)`) | Breaks reactivity                     | Return new object: `[...state.items, x]`      |
| Large monolithic store with unrelated domains   | Re-renders and coupling               | Split into slices                             |
| Not using `devtools` in dev                     | Hard to debug                         | Wrap all stores with `devtools()`             |
| Persisting derived/computed values              | Stale data after schema change        | Compute at read time with selectors           |
| No `partialize` on `persist`                    | Persisting actions and internal state | Always whitelist with `partialize`            |

---

## Checklist

- [ ] Store created only for state that is global, non-server, and non-URL.
- [ ] `devtools()` middleware applied (development debugging).
- [ ] Action name strings passed as third arg to `set()`.
- [ ] Components use field selectors — not the whole store.
- [ ] `useShallow` used for multi-field selectors.
- [ ] `persist` has `version` + `migrate` + `partialize` (if using).
- [ ] No auth tokens or server cache data in Zustand.
- [ ] Store reset in `beforeEach` of tests.
- [ ] No state mirrored from React Query into Zustand.

```

```
