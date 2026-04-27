/**
 * shared/observability.ts
 *
 * Powertools singletons — import from here across all handlers.
 * Must be initialized at module level (NOT inside handlers) for cold-start
 * efficiency and warm-invocation reuse.
 */
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';

const serviceName = process.env.SERVICE_NAME ?? 'api';
const environment = process.env.STAGE ?? 'local';

export const logger = new Logger({ serviceName, logLevel: 'INFO' });
export const tracer = new Tracer({ serviceName });
export const metrics = new Metrics({
  namespace: serviceName,
  defaultDimensions: { environment },
});

export { MetricUnit };
