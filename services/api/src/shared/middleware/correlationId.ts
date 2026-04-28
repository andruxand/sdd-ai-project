/**
 * shared/middleware/correlationId.ts
 *
 * Correlation ID middleware for request tracing across services.
 * Reads X-Correlation-ID from incoming headers or generates a new UUID.
 * Propagates the ID in response headers.
 */
import { randomUUID } from 'node:crypto';

import type { MiddlewareObj } from '@middy/core';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { logger } from '../observability.js';

interface ContextWithCorrelationId {
  correlationId?: string;
}

export const correlationIdMiddleware = (): MiddlewareObj<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> => ({
  before: async (request) => {
    const correlationId =
      request.event.headers?.['x-correlation-id'] ??
      request.event.headers?.['X-Correlation-ID'] ??
      randomUUID();

    // Attach to context for use in handler and downstream middleware
    const ctx = request.context as unknown as ContextWithCorrelationId;
    ctx.correlationId = correlationId;
    logger.appendKeys({ correlationId });
  },
  after: async (request) => {
    // Propagate correlation ID in response headers
    const ctx = request.context as unknown as ContextWithCorrelationId;
    const correlationId = ctx.correlationId ?? randomUUID();

    if (request.response) {
      request.response = {
        ...request.response,
        headers: {
          ...(request.response as APIGatewayProxyResult).headers,
          'X-Correlation-ID': correlationId,
        },
      };
    }
  },
});
