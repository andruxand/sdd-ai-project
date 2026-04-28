/**
 * apps/web/src/features/health/types.ts
 *
 * Health check API types. Derived from the REST contract.
 * Source: packages/contracts/rest/openapi.yaml § HealthResponse
 */

/**
 * Health status returned by the backend.
 * - 'ok': service is fully operational
 * - 'degraded': service is partially operational (future extensibility)
 */
export type HealthStatus = 'ok' | 'degraded';

/**
 * Health check response from GET /health endpoint.
 */
export interface HealthResponse {
  status: HealthStatus;
  version: string;
  timestamp: string; // ISO 8601 format
}
