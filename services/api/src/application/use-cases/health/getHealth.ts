/**
 * application/use-cases/health/getHealth.ts
 *
 * GetHealth use case — returns service health status with version and timestamp.
 * Stateless operation with no external dependencies.
 *
 * Returns:
 *   - status: 'ok' | 'degraded' (always 'ok' for now — future: check dependencies)
 *   - version: from process.env.npm_package_version or 'unknown'
 *   - timestamp: ISO 8601 UTC string
 */

export interface HealthCheckOutput {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
}

export class GetHealthUseCase {
  execute(): HealthCheckOutput {
    const version =
      process.env.APP_VERSION ?? process.env.npm_package_version ?? 'unknown';
    const timestamp = new Date().toISOString();

    return {
      status: 'ok',
      version,
      timestamp,
    };
  }
}
