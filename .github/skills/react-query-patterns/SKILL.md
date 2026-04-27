````skill
---
name: react-query-patterns
description: Implement server state management with React Query — queries, mutations, caching, and invalidation patterns.
---

## State type decision

| State type | Tool |
|---|---|
| Server state (data from API) | **React Query** (`@tanstack/react-query`) |
| Client UI state (modals, toggles, ephemeral) | React `useState` / `useReducer` |
| Shared client state across components | React Context or Zustand |
| Forms | React Hook Form + Zod |

Never put server state in Redux/Zustand/Context — it duplicates React Query's
cache and causes synchronization bugs.

## Setup (once per app)

```typescript
// apps/web/src/app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1 minute before refetch
      gcTime: 5 * 60_000,       // 5 minutes before garbage collected
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors — they won't succeed
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0, // never auto-retry mutations
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
````

## Query key factory pattern (mandatory)

Query keys must be structured and centralized — not scattered as inline arrays.
This prevents stale-state bugs from key mismatches.

```typescript
// apps/web/src/features/orders/api/order-query-keys.ts
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

// Usage: queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
```

## Query hook pattern

```typescript
// apps/web/src/features/orders/api/use-order.ts
import { useQuery } from '@tanstack/react-query';
import { orderKeys } from './order-query-keys';
import { fetchOrder } from './order-api';
import type { Order } from '../types';

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => fetchOrder(orderId),
    enabled: !!orderId, // don't fetch if orderId is empty
    staleTime: 30_000, // override default if needed
  });
}

// Usage in component:
// const { data: order, isLoading, isError, error } = useOrder(orderId);
```

## All states must be handled in components

```tsx
// apps/web/src/features/orders/ui/OrderDetail.tsx
import { useOrder } from '../api/use-order';

export function OrderDetail({ orderId }: { orderId: string }) {
  const { data: order, isLoading, isError, error } = useOrder(orderId);

  if (isLoading) {
    return <OrderDetailSkeleton />; // never null — show skeleton
  }

  if (isError) {
    return (
      <ErrorMessage
        message="Failed to load order"
        detail={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    );
  }

  if (!order) {
    return <EmptyState message="Order not found" />;
  }

  return <OrderCard order={order} />;
}
```

## Mutation with optimistic update

```typescript
// apps/web/src/features/orders/api/use-cancel-order.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderKeys } from './order-query-keys';
import { cancelOrder } from './order-api';
import type { Order } from '../types';

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),

    onMutate: async (orderId) => {
      // Cancel in-flight queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(orderId) });

      // Snapshot previous value for rollback
      const previous = queryClient.getQueryData<Order>(
        orderKeys.detail(orderId),
      );

      // Optimistically update
      queryClient.setQueryData<Order>(orderKeys.detail(orderId), (old) =>
        old ? { ...old, status: 'CANCELLED' } : old,
      );

      return { previous, orderId };
    },

    onError: (_err, orderId, context) => {
      // Rollback on failure
      if (context?.previous) {
        queryClient.setQueryData(orderKeys.detail(orderId), context.previous);
      }
    },

    onSettled: (_data, _err, orderId) => {
      // Always refetch after mutation to sync with server
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
```

## Mutation without optimistic update (simpler, safer)

For most mutations, skip the optimistic update and just invalidate:

```typescript
return useMutation({
  mutationFn: (orderId: string) => cancelOrder(orderId),
  onSuccess: (_data, orderId) => {
    queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
  },
  onError: (error) => {
    toast.error(
      error instanceof ApiError ? error.message : 'Failed to cancel order',
    );
  },
});
```

## Pagination — cursor-based

```typescript
export function useOrderList(filters: OrderFilters) {
  return useInfiniteQuery({
    queryKey: orderKeys.list(filters),
    queryFn: ({ pageParam }) => fetchOrders({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

// Component:
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  useOrderList(filters);
const orders = data?.pages.flatMap((page) => page.items) ?? [];
```

## Prefetching (for known next pages)

```typescript
// Prefetch order detail before user navigates to it
const queryClient = useQueryClient();

<OrderRow
  onMouseEnter={() =>
    queryClient.prefetchQuery({
      queryKey: orderKeys.detail(order.id),
      queryFn: () => fetchOrder(order.id),
      staleTime: 60_000,
    })
  }
/>
```

## Anti-patterns

- ❌ Putting API responses in `useState` — bypasses caching and deduplication.
- ❌ Using `useEffect` + `fetch` directly — reinvents React Query poorly.
- ❌ Inline query keys (`useQuery({ queryKey: ['orders', id] })`) — use the key factory.
- ❌ Not handling `isLoading`, `isError`, and empty states — causes blank screens.
- ❌ Mutating query cache directly in `onSuccess` instead of invalidating — cache inconsistency.
- ❌ Retrying mutations automatically — mutations must be idempotent for that to be safe; use `retry: 0`.
- ❌ Fetching in `useEffect` after a mutation to refresh — use `invalidateQueries` in `onSettled`.

## Checklist

- [ ] `QueryClientProvider` is configured with project-wide defaults.
- [ ] Query key factory defined per feature — no inline key arrays.
- [ ] Every component handles loading, error, and empty states.
- [ ] Mutations use `onSettled` + `invalidateQueries` to sync state.
- [ ] Optimistic updates used only where UX clearly benefits and rollback is implemented.
- [ ] Infinite queries use cursor-based pagination (not page numbers for server-rendered lists).
- [ ] `ReactQueryDevtools` shown only in development.
- [ ] Tests mock via `QueryClientProvider` wrapper + `msw` handlers (not direct mock of hooks).

```

```
