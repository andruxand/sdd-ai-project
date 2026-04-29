/**
 * apps/web/src/features/health/api/health-query-keys.ts
 *
 * React Query key factory for health check queries.
 * Centralized keys prevent stale-state bugs from key mismatches.
 */

export const healthKeys = {
  all: ['health'] as const,
  check: () => [...healthKeys.all, 'check'] as const,
};
