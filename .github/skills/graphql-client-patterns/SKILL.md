# Skill: graphql-client-patterns

Apply this skill when implementing any GraphQL data fetching, mutations, or cache management in a React frontend that uses Apollo Client v4.

**Source**: Apollo Client v4 official docs (https://www.apollographql.com/docs/react).

---

## When to use

- Any component that fetches data from a GraphQL API.
- Any mutation (create, update, delete) triggered from the UI.
- Whenever you need optimistic UI, pagination (`fetchMore`), or cache normalization.
- When the OpenSpec contract specifies `contracts: graphql` or `contracts: both`.

---

## Client initialisation

Create the client once at app root:

```typescript
// src/lib/apolloClient.ts
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, path }) =>
      console.error(`[GraphQL error]: ${message}`, path),
    );
  if (networkError) console.error('[Network error]:', networkError);
});

// This project uses Vite — env vars are prefixed VITE_ (not NEXT_PUBLIC_)
const httpLink = new HttpLink({ uri: import.meta.env.VITE_GRAPHQL_URL });

export const apolloClient = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      User: { keyFields: ['id'] }, // default; explicit for clarity
      Product: { keyFields: ['sku'] }, // custom key field
    },
  }),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-first' },
    query: { fetchPolicy: 'cache-first', errorPolicy: 'all' },
  },
});
```

---

## ApolloProvider (app root)

```typescript
// apps/web/src/app/providers.tsx
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/lib/apolloClient';

export function Providers({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
// Wire Providers in apps/web/src/main.tsx wrapping the router.
```

---

## useQuery

```typescript
import { useQuery, gql } from '@apollo/client';

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery(GET_USER, {
    variables: { id: userId },
    fetchPolicy: 'cache-first', // default; override per query
    errorPolicy: 'all',          // return partial data even on error
  });

  if (loading) return <Skeleton />;
  if (error)   return <ErrorMessage error={error} />;
  if (!data?.user) return <EmptyState />;

  return <div>{data.user.name}</div>;
}
```

### fetchPolicy values

| Policy              | Behaviour                               | When to use              |
| ------------------- | --------------------------------------- | ------------------------ |
| `cache-first`       | Read cache; fetch only on miss          | Default; most queries    |
| `cache-and-network` | Return cache immediately, then update   | High-freshness UIs       |
| `network-only`      | Always fetch; write to cache            | Mutations, dashboards    |
| `no-cache`          | Always fetch; do NOT write to cache     | Sensitive/real-time data |
| `cache-only`        | Only read cache; error on miss          | Offline-first            |
| `standby`           | Like cache-first but does not re-render | Background queries       |

---

## Conditional queries with skipToken (preferred)

`skipToken` is type-safe and preferred over the `skip: !variable` pattern:

```typescript
import { useQuery, skipToken } from '@apollo/client';

function UserProfile({ userId }: { userId?: string }) {
  // ✅ Type-safe: variables object is typed correctly when userId is defined
  const { data, loading } = useQuery(
    GET_USER,
    userId ? { variables: { id: userId } } : skipToken,
  );

  // ❌ Avoid: not type-safe, variables can be undefined
  // const { data } = useQuery(GET_USER, { variables: { id: userId }, skip: !userId });
}
```

---

## useLazyQuery (triggered by user action)

```typescript
import { useLazyQuery } from '@apollo/client';

function SearchBar() {
  const [search, { loading, data }] = useLazyQuery(SEARCH_QUERY);

  return (
    <input
      onKeyDown={(e) => {
        if (e.key === 'Enter') search({ variables: { term: e.currentTarget.value } });
      }}
    />
  );
}
```

---

## useMutation

```typescript
import { useMutation, gql } from '@apollo/client';

const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      status
      total
    }
  }
`;

function CheckoutButton({ input }: { input: CreateOrderInput }) {
  const [createOrder, { loading, error }] = useMutation(CREATE_ORDER, {
    // Invalidate cache entries that depend on orders list
    refetchQueries: ['GetOrders'],
    onCompleted: (data) => {
      router.push(`/orders/${data.createOrder.id}`);
    },
    onError: (err) => {
      logger.error('Mutation failed', err);
    },
  });

  return (
    <button disabled={loading} onClick={() => createOrder({ variables: { input } })}>
      {loading ? 'Processing…' : 'Place Order'}
    </button>
  );
}
```

### Cache update after mutation

```typescript
const [deleteItem] = useMutation(DELETE_ITEM, {
  update(cache, { data }) {
    cache.modify({
      fields: {
        items(existingRefs, { readField }) {
          return existingRefs.filter(
            (ref: Reference) => readField('id', ref) !== data.deleteItem.id,
          );
        },
      },
    });
  },
});
```

---

## Fragments

```typescript
// src/graphql/fragments/userFields.ts
import { gql, useFragment } from '@apollo/client';

export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    name
    email
    avatar
  }
`;

// Usage in a component
function UserCard({ userId }: { userId: string }) {
  const { complete, data } = useFragment({
    fragment: USER_FIELDS,
    from: { __typename: 'User', id: userId },
  });

  if (!complete) return <Skeleton />;
  return <div>{data.name}</div>;
}
```

---

## Pagination with fetchMore

```typescript
function ProductList() {
  const { data, fetchMore, loading } = useQuery(GET_PRODUCTS, {
    variables: { cursor: null, limit: 20 },
  });

  const loadMore = () => {
    fetchMore({
      variables: { cursor: data?.products.pageInfo.endCursor },
      updateQuery(prev, { fetchMoreResult }) {
        if (!fetchMoreResult) return prev;
        return {
          products: {
            ...fetchMoreResult.products,
            items: [...prev.products.items, ...fetchMoreResult.products.items],
          },
        };
      },
    });
  };
}
```

---

## TypeScript codegen

Always generate types from the GraphQL schema instead of writing them manually:

```bash
npx @graphql-codegen/cli init
```

```yaml
# codegen.yml
schema: packages/contracts/graphql/*.graphql
documents: apps/web/src/**/*.tsx
generates:
  apps/web/src/__generated__/types.ts:
    plugins:
      - typescript
      - typescript-operations
      - typescript-react-apollo
```

---

## Testing with MockedProvider

```typescript
import { MockedProvider } from '@apollo/client/testing';
import { render, screen, waitFor } from '@testing-library/react';

const mocks = [
  {
    request: { query: GET_USER, variables: { id: '123' } },
    result: { data: { user: { id: '123', name: 'Ada Lovelace', email: 'ada@test.com' } } },
  },
];

it('renders user name', async () => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <UserProfile userId="123" />
    </MockedProvider>
  );

  await waitFor(() => screen.getByText('Ada Lovelace'));
});

// Error state
const errorMocks = [
  {
    request: { query: GET_USER, variables: { id: '999' } },
    error: new Error('User not found'),
  },
];

it('renders error state', async () => {
  render(
    <MockedProvider mocks={errorMocks} addTypename={false}>
      <UserProfile userId="999" />
    </MockedProvider>
  );

  await waitFor(() => screen.getByText(/error/i));
});
```

> Use `addTypename={false}` in tests unless your queries explicitly include `__typename` fields.

---

## Query and mutation file organisation

```
apps/web/src/
  graphql/
    queries/
      getUser.gql.ts           ← gql tagged template
      getProducts.gql.ts
    mutations/
      createOrder.gql.ts
      deleteItem.gql.ts
    fragments/
      userFields.ts
  __generated__/
    types.ts                    ← codegen output (never edit manually)
```

---

## Anti-patterns

| Anti-pattern                                                        | Why it breaks                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| `fetchPolicy: 'no-cache'` by default                                | Defeats caching; hammers the server                   |
| `skip: !variable` instead of `skipToken`                            | `variables` type is `Partial`; safer with `skipToken` |
| Inlining `gql` strings in components                                | Can't deduplicate with fragments; harder to test      |
| Manual TypeScript types for query responses                         | Drift from schema; use codegen                        |
| Not handling `loading` and `error` states                           | Components crash or show stale data silently          |
| `refetchQueries` with string names but no matching query registered | Silent no-op; cache not invalidated                   |
| Creating a new `ApolloClient` per render                            | Destroys cache on every render                        |

---

## Checklist

- [ ] `ApolloClient` created once at module scope, not inside a component.
- [ ] `ApolloProvider` wraps the app in `providers.tsx`.
- [ ] `skipToken` used for conditional queries (not `skip: !var`).
- [ ] All query/mutation files in `src/graphql/queries|mutations/`.
- [ ] TypeScript types generated via codegen — not written manually.
- [ ] Every component handles `loading`, `error`, and empty state.
- [ ] `MockedProvider` used in component tests.
- [ ] Fragments extracted for reused field sets.
- [ ] `cache.modify` or `refetchQueries` used after mutations that affect lists.
- [ ] No PII or tokens in graphql query variables logged or stored in fixtures.
