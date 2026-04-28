/**
 * apps/web/src/features/health/api/use-health-check.ts
 *
 * React Query hook for health check polling.
 * Fetches health status every 30 seconds.
 */
import { useQuery } from '@tanstack/react-query';

import { fetchHealthCheck } from './health-api.js';
import { healthKeys } from './health-query-keys.js';

/**
 * React Query hook for health check with 30-second polling.
 *
 * States:
 * - isLoading: true on initial mount before first response
 * - isError: true when fetch fails (network error or non-200 status)
 * - data: HealthResponse when successful
 *
 * Polling continues in background every 30 seconds (refetchInterval).
 */
export function useHealthCheck() {
  return useQuery({
    queryKey: healthKeys.check(),
    queryFn: fetchHealthCheck,
    refetchInterval: 30_000, // 30 seconds
    staleTime: 0, // always refetch on mount
    retry: 2, // retry twice on failure before showing error state
  });
}
