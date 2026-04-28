/**
 * apps/web/src/features/health/api/use-health-check.test.ts
 *
 * Tests for the useHealthCheck hook.
 * Covers: 30s polling refetchInterval, initial fetch, error handling.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { HealthResponse } from '../types.js';

import { useHealthCheck } from './use-health-check.js';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------
const HEALTH_URL = 'http://localhost:3000/health';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { queryClient, wrapper };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHealthCheck', () => {
  describe('initial fetch', () => {
    it('returns data from GET /health on mount', async () => {
      const mockResponse: HealthResponse = {
        status: 'ok',
        version: '1.0.0',
        timestamp: '2026-04-27T00:00:00.000Z',
      };

      server.use(http.get(HEALTH_URL, () => HttpResponse.json(mockResponse)));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useHealthCheck(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
    });

    it('sets isError=true when GET /health returns 500', async () => {
      server.use(
        http.get(HEALTH_URL, () =>
          HttpResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 },
          ),
        ),
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useHealthCheck(), { wrapper });

      // Hook retries twice (retry: 2) before failing — allow up to 10s
      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 10_000,
      });
    });

    it('sets isError=true on network failure', async () => {
      server.use(http.get(HEALTH_URL, () => HttpResponse.error()));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useHealthCheck(), { wrapper });

      // Hook retries twice (retry: 2) before failing — allow up to 10s
      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 10_000,
      });
    });
  });

  describe('polling — 30 second refetch interval', () => {
    it('refetches every 30 seconds via refetchInterval', async () => {
      vi.useFakeTimers();

      let callCount = 0;

      server.use(
        http.get(HEALTH_URL, () => {
          callCount++;
          return HttpResponse.json<HealthResponse>({
            status: 'ok',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
          });
        }),
      );

      const { wrapper } = createWrapper();
      renderHook(() => useHealthCheck(), { wrapper });

      // Initial fetch
      await vi.advanceTimersByTimeAsync(500);
      const initialCount = callCount;
      expect(initialCount).toBeGreaterThanOrEqual(1);

      // Advance 30 seconds → refetchInterval fires
      await vi.advanceTimersByTimeAsync(30_000);
      expect(callCount).toBeGreaterThan(initialCount);

      vi.useRealTimers();
    });
  });
});
