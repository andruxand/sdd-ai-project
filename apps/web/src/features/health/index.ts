/**
 * apps/web/src/features/health/index.ts
 *
 * Public API for health feature.
 * Export only what pages need.
 */
export { HealthStatus } from './ui/HealthStatus.js';
export type {
  HealthResponse,
  HealthStatus as HealthStatusType,
} from './types.js';
