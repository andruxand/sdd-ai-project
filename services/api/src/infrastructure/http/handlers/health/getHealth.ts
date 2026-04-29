/**
 * infrastructure/http/handlers/health/getHealth.ts
 *
 * GET /health endpoint handler.
 * Public endpoint (no authentication) returning service health status.
 *
 * Response:
 *   200 { status: 'ok' | 'degraded', version: string, timestamp: string }
 */
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { GetHealthUseCase } from '../../../../application/use-cases/health/getHealth.js';
import { correlationIdMiddleware } from '../../../../shared/middleware/correlationId.js';
import { mapDomainErrorToHttp } from '../../../../shared/middleware/mapDomainErrorToHttp.js';
import {
  logger,
  tracer,
  metrics,
  MetricUnit,
} from '../../../../shared/observability.js';

const useCase = new GetHealthUseCase();

const rawHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const start = performance.now();

  // Propagate Datadog trace ID from frontend for correlated traces
  const traceId = event.headers?.['x-datadog-trace-id'];
  if (traceId) {
    logger.appendKeys({ ddTraceId: traceId });
  }

  logger.info('Health check requested', { action: 'getHealth' });

  const result = useCase.execute();

  const durationMs = performance.now() - start;

  // Business metrics
  metrics.addMetric('HealthCheck.Requests', MetricUnit.Count, 1);
  metrics.addMetric('HealthCheck.Latency', MetricUnit.Milliseconds, durationMs);

  // X-Ray annotation
  tracer.putAnnotation('healthStatus', result.status);

  logger.info('Health check completed', {
    action: 'getHealth',
    status: result.status,
    version: result.version,
    durationMs,
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(result),
  };
};

export const handler = middy(rawHandler)
  .use(correlationIdMiddleware())
  .use(injectLambdaContext(logger, { resetKeys: true }))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics, { captureColdStartMetric: true }))
  .use(httpErrorHandler({ fallbackMessage: 'Internal server error' }))
  .use(mapDomainErrorToHttp());
