/**
 * apps/web/src/features/health/api/health-api.ts
 *
 * HTTP client for health check endpoint.
 * Calls backend GET /health endpoint.
 */
import type { HealthResponse } from '../types.js';

// TODO: read from env var in production (VITE_API_BASE_URL)
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/**
 * Fetches health check from the backend.
 * Endpoint: GET /health (public, no auth)
 *
 * @throws Error if HTTP status is not 200
 */
export async function fetchHealthCheck(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // X-Correlation-ID is not needed for health checks (no user context)
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as HealthResponse;
  return data;
}
