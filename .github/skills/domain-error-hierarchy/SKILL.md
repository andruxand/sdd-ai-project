```skill
---
name: domain-error-hierarchy
description: Define and use the DomainError class hierarchy for consistent error handling in Lambda services.
---

## Why a typed error hierarchy

Generic `throw new Error('...')` forces handler code to string-match error
messages to decide on status codes. A typed hierarchy lets handlers map errors
to HTTP codes structurally, and lets loggers/tracers treat them differently.

**Rule**: never throw `new Error()`. Always throw a `DomainError` subclass.

## Error taxonomy

```

DomainError (base — never thrown directly)
├── ValidationError → 400 Bad Request
├── AuthenticationError → 401 Unauthorized
├── AuthorizationError → 403 Forbidden
├── NotFoundError → 404 Not Found
├── ConflictError → 409 Conflict (duplicate key, optimistic lock)
├── UnprocessableError → 422 Unprocessable Entity (business rule violation)
├── RateLimitError → 429 Too Many Requests
└── ExternalDependencyError→ 502 Bad Gateway (upstream service failure)
└── (never surface detail to client)

```

Internal errors that should never leave the service boundary:

```

InternalError → 500 Internal Server Error (catch-all, sanitized message)

````

## Implementation

### Base class and all subclasses

```typescript
// services/api/src/errors/domain-errors.ts

export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  readonly code: string;

  constructor(
    message: string,
    code: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends DomainError {
  readonly statusCode = 400;
  constructor(
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message, 'VALIDATION_ERROR', { fields });
  }
}

export class AuthenticationError extends DomainError {
  readonly statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends DomainError {
  readonly statusCode = 403;
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends DomainError {
  readonly statusCode = 404;
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      'NOT_FOUND_ERROR'
    );
  }
}

export class ConflictError extends DomainError {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message, 'CONFLICT_ERROR');
  }
}

export class UnprocessableError extends DomainError {
  readonly statusCode = 422;
  constructor(message: string, rule?: string) {
    super(message, 'UNPROCESSABLE_ERROR', { rule });
  }
}

export class RateLimitError extends DomainError {
  readonly statusCode = 429;
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalDependencyError extends DomainError {
  readonly statusCode = 502;
  // Never expose upstream detail — message is internal-only
  constructor(
    upstream: string,
    public readonly cause?: unknown
  ) {
    super(`Upstream dependency '${upstream}' failed`, 'EXTERNAL_DEPENDENCY_ERROR', {
      upstream,
    });
  }
}

export class InternalError extends DomainError {
  readonly statusCode = 500;
  constructor(message = 'An unexpected error occurred') {
    super(message, 'INTERNAL_ERROR');
  }
}
````

### Error mapper — handler → HTTP response

```typescript
// services/api/src/errors/error-mapper.ts
import { APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import {
  DomainError,
  ExternalDependencyError,
  InternalError,
} from './domain-errors';

export function mapErrorToResponse(
  err: unknown,
  logger: Logger,
  correlationId: string,
): APIGatewayProxyResult {
  if (err instanceof DomainError) {
    // ExternalDependencyError and InternalError must not expose their message
    const isSafe = err.statusCode < 500;
    const clientMessage = isSafe ? err.message : 'An unexpected error occurred';

    if (!isSafe) {
      logger.error('Unrecoverable error', {
        error: err.message,
        code: err.code,
        correlationId,
        // metadata may contain upstream info — safe to log, not to return
        metadata: err.metadata,
        stack: err.stack,
      });
    } else {
      logger.warn('Domain error', {
        code: err.code,
        message: err.message,
        correlationId,
      });
    }

    return {
      statusCode: err.statusCode,
      body: JSON.stringify({ error: clientMessage, code: err.code }),
    };
  }

  // Unknown error — treat as 500 and sanitize
  logger.error('Unexpected error', {
    error: String(err),
    correlationId,
    stack: err instanceof Error ? err.stack : undefined,
  });

  return {
    statusCode: 500,
    body: JSON.stringify({
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    }),
  };
}
```

### Usage in use cases

```typescript
// services/api/src/usecases/orders/get-order.usecase.ts
import {
  NotFoundError,
  ExternalDependencyError,
} from '../../errors/domain-errors';

export async function getOrder(orderId: string): Promise<Order> {
  let item: Order | null;

  try {
    item = await orderRepository.findById(orderId);
  } catch (err) {
    throw new ExternalDependencyError('DynamoDB', err);
  }

  if (!item) {
    throw new NotFoundError('Order', orderId); // safe to show id since it came from the user
  }

  return item;
}
```

### Usage in handler (with mapper)

```typescript
// services/api/src/handlers/orders/get.handler.ts
import { mapErrorToResponse } from '../../errors/error-mapper';
import { getOrder } from '../../usecases/orders/get-order.usecase';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => {
  const correlationId = event.requestContext.requestId;
  try {
    const order = await getOrder(event.pathParameters!.orderId!);
    return { statusCode: 200, body: JSON.stringify(order) };
  } catch (err) {
    return mapErrorToResponse(err, logger, correlationId);
  }
};
```

## Error response shape (document in OpenAPI)

All error responses share the same shape:

```json
{
  "error": "Human-readable description (safe for client)",
  "code": "MACHINE_READABLE_CODE"
}
```

Document in `packages/contracts/rest/components/errors.yaml`:

```yaml
ErrorResponse:
  type: object
  required: [error, code]
  properties:
    error:
      type: string
      description: Human-readable error description safe for client display.
    code:
      type: string
      enum:
        - VALIDATION_ERROR
        - AUTHENTICATION_ERROR
        - AUTHORIZATION_ERROR
        - NOT_FOUND_ERROR
        - CONFLICT_ERROR
        - UNPROCESSABLE_ERROR
        - RATE_LIMIT_ERROR
        - INTERNAL_ERROR
```

## Anti-patterns

- ❌ `throw new Error('User not found')` — loses type, leads to 500 for a 404.
- ❌ Including stack traces in API responses — exposes internals.
- ❌ Exposing upstream error messages from `ExternalDependencyError` to clients.
- ❌ Using error messages for branching logic (`if (e.message === 'Not found')`) — use instanceof.
- ❌ Catching and swallowing errors without logging.

## Checklist

- [ ] All thrown errors are `DomainError` subclasses — no raw `new Error()`.
- [ ] `mapErrorToResponse` (or equivalent) used in all handler catch blocks.
- [ ] `ExternalDependencyError` wraps all third-party / AWS SDK failures.
- [ ] 5xx errors log full detail internally, return sanitized message to client.
- [ ] OpenAPI spec documents error response shape with `ErrorResponse` component.
- [ ] Tests cover each error subclass and verify correct HTTP status code returned.

```

```
