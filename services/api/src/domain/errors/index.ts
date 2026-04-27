/**
 * DomainError hierarchy - single source of truth for typed errors.
 *
 * Rule: never throw new Error. Always throw a DomainError subclass.
 *
 * Taxonomy (aligned with domain-error-hierarchy SKILL):
 *   ValidationError         -> 400  schema / input violation
 *   AuthenticationError     -> 401  caller not authenticated
 *   AuthorizationError      -> 403  authenticated but lacks permission
 *   NotFoundError           -> 404  resource does not exist
 *   ConflictError           -> 409  duplicate key / optimistic lock
 *   UnprocessableError      -> 422  input valid but business rule violated
 *   RateLimitError          -> 429  too many requests
 *   ExternalDependencyError -> 502  upstream service failure (never expose detail)
 *   InternalError           -> 500  unexpected catch-all (triggers alert)
 *
 * The shared/error-mapper maps these to HTTP status codes structurally.
 */
export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  /** Machine-readable code - included in API error response and OpenAPI spec. */
  readonly code: string;
  /** Internal context for logs. NEVER send to client. */
  readonly metadata: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.metadata = metadata;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }
}

/** 400 - input failed schema/format validation. */
export class ValidationError extends DomainError {
  readonly statusCode = 400;
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', { fields });
  }
}

/** 401 - caller is not authenticated. */
export class AuthenticationError extends DomainError {
  readonly statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR');
  }
}

/** 403 - authenticated but lacks permission. */
export class AuthorizationError extends DomainError {
  readonly statusCode = 403;
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR');
  }
}

/** 404 - resource does not exist. */
export class NotFoundError extends DomainError {
  readonly statusCode = 404;
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      'NOT_FOUND_ERROR',
    );
  }
}

/** 409 - duplicate key or optimistic lock conflict. */
export class ConflictError extends DomainError {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message, 'CONFLICT_ERROR');
  }
}

/** 422 - input is valid but violates a business rule. */
export class UnprocessableError extends DomainError {
  readonly statusCode = 422;
  constructor(message: string, rule?: string) {
    super(message, 'UNPROCESSABLE_ERROR', { rule });
  }
}

/** 429 - caller is sending too many requests. */
export class RateLimitError extends DomainError {
  readonly statusCode = 429;
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT_ERROR');
  }
}

/**
 * 502 - upstream dependency (DynamoDB, SQS, external HTTP) failed.
 * NEVER expose upstream detail in the API response - it stays in logs only.
 */
export class ExternalDependencyError extends DomainError {
  readonly statusCode = 502;
  constructor(upstream: string, cause?: unknown) {
    super(
      `Upstream dependency '${upstream}' failed`,
      'EXTERNAL_DEPENDENCY_ERROR',
      {
        upstream,
        cause: cause instanceof Error ? cause.message : String(cause),
      },
    );
  }
}

/** 500 - unexpected error. Triggers alert. */
export class InternalError extends DomainError {
  readonly statusCode = 500;
  constructor(message = 'An unexpected error occurred') {
    super(message, 'INTERNAL_ERROR');
  }
}
