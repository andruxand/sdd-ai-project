/**
 * shared/error-mapper.ts
 *
 * Maps DomainError subclasses to HTTP responses.
 * Import in handlers — never in use cases or domain.
 *
 * Response shape: { error: string, code: string }
 *   - `error`: human-readable message (only for 4xx, generic for 5xx)
 *   - `code`: machine-readable code from domain error (for client error handling)
 *   - `metadata` stays in logs only — NEVER sent to client
 */
import { DomainError } from '../domain/errors/index.js';

import { logger } from './observability.js';

export interface ErrorResponse {
  statusCode: number;
  body: string;
}

export function mapDomainErrorToHttp(err: unknown): ErrorResponse {
  if (err instanceof DomainError) {
    const isServerError = err.statusCode >= 500;

    if (isServerError) {
      logger.error('Unexpected domain error', {
        error: err.message,
        code: err.code,
        metadata: err.metadata,
        name: err.name,
      });
    } else {
      logger.warn('Business rule violation', {
        error: err.message,
        code: err.code,
        name: err.name,
      });
    }

    return {
      statusCode: err.statusCode,
      body: JSON.stringify({
        error: isServerError ? 'Internal server error' : err.message,
        code: err.code,
      }),
    };
  }

  // Unknown error — never leak internals
  logger.error('Unhandled error', { error: String(err) });
  return {
    statusCode: 500,
    body: JSON.stringify({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    }),
  };
}
