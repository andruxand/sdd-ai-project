/**
 * shared/middleware/mapDomainErrorToHttp.ts
 *
 * Middy error handler middleware that maps DomainError subclasses to HTTP responses.
 * Must be registered as the LAST middleware in the chain (after httpErrorHandler).
 */
import type { MiddlewareObj } from '@middy/core';

import { DomainError } from '../../domain/errors/index.js';
import { logger } from '../observability.js';

export const mapDomainErrorToHttp = (): MiddlewareObj => ({
  onError: async (request) => {
    const error = request.error;

    if (error instanceof DomainError) {
      const isServerError = error.statusCode >= 500;

      if (isServerError) {
        logger.error('Unexpected domain error', {
          action: 'errorHandler',
          error: error.message,
          code: error.code,
          metadata: error.metadata,
          name: error.name,
        });
      } else {
        logger.warn('Business rule violation', {
          action: 'errorHandler',
          error: error.message,
          code: error.code,
          name: error.name,
        });
      }

      request.response = {
        statusCode: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: isServerError ? 'Internal server error' : error.message,
          code: error.code,
        }),
      };
      // Do not re-throw — error is handled
      return;
    }

    // Unknown error — treat as 500 and sanitize
    logger.error('Unhandled error', {
      action: 'errorHandler',
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    request.response = {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
    };
    // Do not re-throw — error is handled
  },
});
