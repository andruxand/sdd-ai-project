````skill
---
name: vitest-patterns
description: Vitest patterns for both backend (Lambda) and frontend (React) testing — vi.mock() hoisting, vi.fn()/vi.spyOn(), async patterns, aws-sdk-client-mock, renderWithProviders, vitest.config.ts coverage config, and setup files. Replaces Jest in this stack.
type: always-active
agents: [tester-backend, tester-frontend]
---

## vi.mock() — hoisting rules

`vi.mock()` calls are **hoisted to the top of the file** by Vitest (same as Jest's `jest.mock()`). This means they execute BEFORE any imports or variable declarations.

```typescript
// ✅ Full module mock — factory runs at hoist time
vi.mock('@/application/use-cases/create-order.use-case', () => ({
  CreateOrderUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      orderId:    'mock-order-id',
      status:     'PENDING',
      totalCents: 1000,
      createdAt:  '2024-01-01T00:00:00.000Z',
    }),
  })),
}));

// ❌ WRONG — variables declared before vi.mock() are NOT available in the factory
// because mock factories are hoisted above variable declarations
const mockResult = { orderId: 'x' };
vi.mock('./module', () => ({
  execute: vi.fn().mockResolvedValue(mockResult), // ← mockResult is undefined here
}));

// ✅ FIX — use vi.hoisted() to hoist variable declarations along with the mock
const { mockResult } = vi.hoisted(() => ({
  mockResult: { orderId: 'x' },
}));

vi.mock('./module', () => ({
  execute: vi.fn().mockResolvedValue(mockResult),
}));
````

### Spy on a specific export without mocking the whole module

```typescript
// ✅ vi.spyOn on the module object
import * as ObservabilityModule from '@/shared/observability';

const loggerInfoSpy = vi.spyOn(ObservabilityModule.logger, 'info');
const loggerErrorSpy = vi.spyOn(ObservabilityModule.logger, 'error');

afterEach(() => {
  vi.restoreAllMocks(); // ✅ restores originals — use instead of mockRestore on each spy
});
```

---

## vi.fn() — common patterns

```typescript
// ✅ Return value
const fn = vi.fn().mockReturnValue(42);

// ✅ Resolved promise
const asyncFn = vi.fn().mockResolvedValue({ id: 'abc' });

// ✅ Rejected promise
const failFn = vi.fn().mockRejectedValue(new Error('Not found'));

// ✅ Implementation
const impl = vi.fn().mockImplementation((input: string) => input.toUpperCase());

// ✅ One-time return — first call returns X, subsequent calls return Y
const onceFn = vi
  .fn()
  .mockResolvedValueOnce({ status: 'PENDING' })
  .mockResolvedValueOnce({ status: 'CONFIRMED' });

// ✅ Assertions
expect(asyncFn).toHaveBeenCalledTimes(1);
expect(asyncFn).toHaveBeenCalledWith(
  expect.objectContaining({ userId: 'u-1' }),
);
expect(asyncFn).not.toHaveBeenCalled();
```

---

## beforeEach / afterEach — always clear mocks

```typescript
// ✅ Required in every test file that uses vi.fn() or vi.spyOn()
beforeEach(() => {
  vi.clearAllMocks(); // clears call history + return values
});

afterEach(() => {
  vi.restoreAllMocks(); // restores spies to original implementation
});

// Difference:
// clearAllMocks()   — resets .mock.calls, .mock.instances but keeps implementation
// resetAllMocks()   — also resets mock.return values to undefined
// restoreAllMocks() — restores vi.spyOn() targets to their real implementation
```

---

## aws-sdk-client-mock

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import 'aws-sdk-client-mock-jest'; // extends expect with toHaveReceivedCommand()

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset(); // ✅ reset between tests — prevents call history leakage
});

it('returns order when found', async () => {
  ddbMock.on(GetCommand).resolves({
    Item: {
      pk: 'ORDER#123',
      id: '123',
      userId: 'user-1',
      status: 'PENDING',
      items: [{ productId: 'p-1', quantity: 1, priceInCents: 1000 }],
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  });

  const result = await repository.findById(OrderId.of('123'));

  expect(result).not.toBeNull();
  expect(result!.status.value).toBe('PENDING');

  // ✅ Assert the command was called with correct parameters
  expect(ddbMock).toHaveReceivedCommandWith(GetCommand, {
    TableName: 'orders-table',
    Key: { pk: 'ORDER#123', sk: 'ORDER#123' },
  });
});

it('returns null when not found', async () => {
  ddbMock.on(GetCommand).resolves({ Item: undefined });

  const result = await repository.findById(OrderId.of('not-found'));

  expect(result).toBeNull();
});

it('throws on DynamoDB error', async () => {
  ddbMock
    .on(PutCommand)
    .rejects(new Error('ProvisionedThroughputExceededException'));

  await expect(repository.save(order)).rejects.toThrow(
    'ProvisionedThroughputExceededException',
  );
});
```

---

## Async testing patterns

```typescript
// ✅ async/await — preferred for Promise-based code
it('creates an order', async () => {
  const output = await useCase.execute(input);
  expect(output.orderId).toBeDefined();
});

// ✅ Testing thrown errors
it('throws when items is empty', async () => {
  await expect(useCase.execute({ ...input, items: [] }))
    .rejects.toThrow('Order must have at least one item');
});

// ✅ Testing error type
it('throws DomainError on invalid status', async () => {
  await expect(useCase.execute(input))
    .rejects.toMatchObject({ code: 'ORDER_NO_ITEMS' });
});

// ✅ waitFor — when state updates are async (React Testing Library)
import { waitFor } from '@testing-library/react';

it('shows success message after submit', async () => {
  render(<OrderForm />);
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(screen.getByText(/order created/i)).toBeInTheDocument();
  });
});
```

---

## MSW (Mock Service Worker) — API mocking for frontend tests

```typescript
// apps/web/src/tests/msw/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/orders', () => {
    return HttpResponse.json(
      { orderId: 'mock-id', status: 'PENDING' },
      { status: 201 },
    );
  }),

  http.get('/api/orders/:id', ({ params }) => {
    return HttpResponse.json({ orderId: params.id, status: 'CONFIRMED' });
  }),
];

// apps/web/src/tests/msw/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// apps/web/src/tests/setup.ts
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Override single handler in a test

```typescript
import { http, HttpResponse } from 'msw';
import { server }             from '@/tests/msw/server';

it('shows error when order fails', async () => {
  server.use(
    http.post('/api/orders', () =>
      HttpResponse.json({ message: 'Validation failed' }, { status: 400 })
    )
  );

  render(<OrderForm />);
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
  });
});
```

---

## renderWithProviders — React testing wrapper

```typescript
// apps/web/src/tests/render.tsx
import React         from 'react';
import { render }    from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,          // ✅ No retries in tests
        gcTime: 0,             // ✅ Disable GC to prevent stale data
      },
    },
  });
}

interface RenderOptions {
  initialEntries?: string[];
}

export function renderWithProviders(
  ui: React.ReactElement,
  { initialEntries = ['/'] }: RenderOptions = {},
) {
  const queryClient = createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
}
```

---

## vitest.config.ts — coverage thresholds

```typescript
// services/api/vitest.config.ts (backend)
import { defineConfig } from 'vitest/config';
import tsconfig from './tsconfig.json';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: [
        'src/shared/**', // observability setup, clients
        'src/**/*.d.ts',
        'serverless.ts',
      ],
    },
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
});
```

```typescript
// apps/web/vitest.config.ts (frontend)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      exclude: [
        'src/main.tsx',
        'src/tests/**',
        'src/**/*.stories.*',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
});
```

---

## Setup file — backend

```typescript
// services/api/src/tests/setup.ts
import { vi } from 'vitest';

// ✅ Mock Powertools — see powertools-patterns skill for full mock
vi.mock('@/shared/observability', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    appendKeys: vi.fn(),
  },
  tracer: {
    captureAWSv3Client: (c: unknown) => c,
    putAnnotation: vi.fn(),
    putMetadata: vi.fn(),
  },
  metrics: { addMetric: vi.fn(), addDimension: vi.fn() },
  MetricUnit: { Count: 'Count', Milliseconds: 'Milliseconds' },
}));

// ✅ Set env vars required by all Lambda handlers
process.env.ORDERS_TABLE_NAME = 'orders-table';
process.env.IDEMPOTENCY_TABLE_NAME = 'idempotency-table';
process.env.SERVICE_NAME = 'api';
process.env.STAGE = 'test';
process.env.AWS_REGION = 'us-east-1';
```

---

## Anti-patterns

| Anti-pattern                                               | Problem                                  | Fix                                     |
| ---------------------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| `jest.mock()`                                              | Wrong test runner                        | Use `vi.mock()`                         |
| `vi.mock()` inside `it()` or `beforeEach()`                | Mock not hoisted — factory runs too late | Declare at module level                 |
| Variable used in `vi.mock()` factory before `vi.hoisted()` | Variable is `undefined` at hoist time    | Use `vi.hoisted()`                      |
| `ddbMock.reset()` missing between tests                    | Previous test's mock bleeds into next    | `beforeEach(() => ddbMock.reset())`     |
| No `vi.clearAllMocks()` in `beforeEach`                    | Call history accumulates across tests    | Always clear in `beforeEach`            |
| `retry: true` in test `QueryClient`                        | Tests wait for retries → slow            | `retry: false`                          |
| Testing implementation details (internal methods)          | Brittle tests                            | Test behavior via public API            |
| `await new Promise(r => setTimeout(r, 100))`               | Flaky timing-based tests                 | Use `waitFor` or `act`                  |
| `screen.getByText('Order')` too broad                      | Passes accidentally                      | Use `getByRole` with name when possible |

---

## Checklist

- [ ] All test files use `vi.mock()` not `jest.mock()`.
- [ ] `vi.mock()` calls are at module level (not inside test blocks).
- [ ] Variables used inside `vi.mock()` factories are hoisted with `vi.hoisted()`.
- [ ] `vi.clearAllMocks()` called in `beforeEach`.
- [ ] `vi.restoreAllMocks()` called in `afterEach` when using `vi.spyOn()`.
- [ ] `ddbMock.reset()` called in `beforeEach` for all DynamoDB tests.
- [ ] MSW handlers registered in `setupFiles` for frontend.
- [ ] `renderWithProviders` used instead of bare `render` for components that use React Query or Router.
- [ ] `retry: false` set on test `QueryClient`.
- [ ] `vitest.config.ts` has coverage thresholds with `exclude` for generated/setup files.
- [ ] Coverage thresholds are enforced in CI (`npm run coverage` must pass).
- [ ] Backend setup file mocks `@/shared/observability` and sets `process.env`.
- [ ] Frontend setup file mocks `@datadog/browser-rum`.

```

```
