# Skill: msw-mock-patterns

Apply this skill whenever writing tests that require mocking HTTP requests — both in frontend component tests (Vitest + Testing Library) and backend integration tests (Vitest + Node).

**Source**: MSW v2 official docs (https://mswjs.io/docs).

---

## When to use

- Frontend component tests that render a component making `fetch` / Axios / React Query calls.
- Backend integration tests that test a handler calling an external HTTP API.
- Any test where you want to test error states (network failures, 4xx, 5xx) in isolation.
- Replacing `jest.mock('axios', ...)` or manual fetch stubs with deterministic, contract-aligned mocks.

---

## File structure

```
src/
  mocks/
    handlers.ts        ← shared handlers (happy path)
    node.ts            ← Node/Vitest server setup (backend + frontend tests)
    browser.ts         ← browser ServiceWorker setup (if using MSW in dev)
vitest.setup.ts        ← lifecycle hooks
```

---

## handlers.ts

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Happy path: GET /users/:id
  http.get('https://api.example.com/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Ada Lovelace' });
  }),

  // Happy path: POST /orders
  http.post('https://api.example.com/orders', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { orderId: 'order-123', ...body },
      { status: 201 },
    );
  }),

  // Pass through unhandled requests (do NOT silence them silently in CI)
  // Remove this line if you want warnings for unmocked requests:
  // http.all('*', () => passthrough()),
];
```

---

## node.ts (Vitest / Node.js)

```typescript
// src/mocks/node.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## vitest.setup.ts — global lifecycle

```typescript
// vitest.setup.ts
import { server } from './src/mocks/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' })); // fail on unmocked
afterEach(() => server.resetHandlers()); // remove per-test overrides
afterAll(() => server.close());
```

> `onUnhandledRequest: 'error'` is strongly preferred over `'warn'` — it forces developers to declare all expected calls.

---

## Per-test overrides with server.use()

Override the default handler for a single test (e.g., to test error states):

```typescript
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/node';

it('shows error state when API fails', async () => {
  server.use(
    http.get('https://api.example.com/users/:id', () => {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }),
  );

  // render component and assert error state...
});

it('shows network failure state', async () => {
  server.use(
    http.get('https://api.example.com/users/:id', () => {
      return HttpResponse.error(); // simulates a network-level failure (no response)
    }),
  );
});
```

> `server.resetHandlers()` in `afterEach` ensures these overrides do not leak into other tests.

---

## One-shot handlers

To apply an override only once (first matching request), use the `{ once: true }` option:

```typescript
server.use(
  http.get(
    'https://api.example.com/users/:id',
    () => HttpResponse.json({ id: '1', name: 'Test' }),
    { once: true },
  ),
);
```

---

## React Query integration

When testing components that use `useQuery` / `useMutation`, MSW integrates transparently — no special wiring needed. Render the component inside `QueryClientProvider` and MSW intercepts the underlying fetch:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProfile } from '../UserProfile';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

it('renders user name from API', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <UserProfile userId="123" />
    </QueryClientProvider>
  );

  await waitFor(() => screen.getByText('Ada Lovelace'));
});
```

> Set `retry: false` on the test `QueryClient` to prevent React Query retries from interfering with error state tests.

---

## Debugging

```typescript
// Log every request MSW intercepts
server.events.on('request:start', ({ request }) => {
  console.log('MSW intercepted:', request.method, request.url);
});

// Log unhandled requests
server.events.on('request:unhandled', ({ request }) => {
  console.warn('No handler for:', request.method, request.url);
});
```

---

## Path patterns

| Pattern                 | Example                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| Exact URL               | `http.get('https://api.example.com/users')`                        |
| Path param              | `http.get('https://api.example.com/users/:id', ({params}) => ...)` |
| Wildcard                | `http.get('https://api.example.com/users/*', ...)`                 |
| Regex                   | `http.get(/\/users\/\d+/, ...)`                                    |
| Relative (browser only) | `http.get('/api/users', ...)`                                      |

---

## vitest.config.ts wiring

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environment: 'jsdom', // for frontend
    // environment: 'node', // for backend
  },
});
```

---

## Anti-patterns

| Anti-pattern                                                      | Why it breaks                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `jest.mock` / `vi.mock` on `fetch` or `axios`                     | Brittle — tied to implementation; MSW tests actual network layer |
| Global handler that always returns 200 without per-test overrides | Hides error path coverage gaps                                   |
| `onUnhandledRequest: 'warn'` in CI                                | Silent — unmocked calls pass silently, masking missing coverage  |
| Creating a new `setupServer` per test file                        | Share `node.ts` singleton; per-file setup causes port conflicts  |
| Not calling `server.resetHandlers()` in `afterEach`               | Per-test overrides leak, causing flaky tests                     |
| Putting real API base URLs in handlers without env var            | Handlers break when base URL changes                             |

---

## Checklist

- [ ] `src/mocks/handlers.ts` contains all happy-path routes.
- [ ] `src/mocks/node.ts` exports the shared `server` singleton.
- [ ] `vitest.setup.ts` has `beforeAll / afterEach / afterAll` lifecycle.
- [ ] `onUnhandledRequest: 'error'` set in `server.listen(...)`.
- [ ] Error states tested via `server.use(...)` per-test overrides.
- [ ] React Query test client has `retry: false`.
- [ ] No real network calls in unit or integration tests.
- [ ] No sensitive data (tokens, PII) hardcoded in handler responses.
