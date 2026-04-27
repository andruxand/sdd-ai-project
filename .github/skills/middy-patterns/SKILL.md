````skill
---
name: middy-patterns
description: Middy v5 middleware stack for AWS Lambda — core middleware chain, custom middleware, error flow, correlation ID propagation, Powertools integration, and testing. Every Lambda handler must use Middy.
type: always-active
agents: [backend-implementer, tester-backend]
---

## Canonical handler structure

```typescript
// infrastructure/http/handlers/createOrder.ts
import middy from '@middy/core';
import httpJsonBodyParser    from '@middy/http-json-body-parser';
import httpErrorHandler      from '@middy/http-error-handler';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics }           from '@aws-lambda-powertools/metrics/middleware';
import { logger, tracer, metrics } from '@/shared/observability';
import { correlationIdMiddleware }  from '@/shared/middleware/correlationId';
import { zodValidatorMiddleware }   from '@/shared/middleware/zodValidator';
import { mapDomainErrorToHttp }     from '@/shared/errors/errorMapper';
import { CreateOrderSchema }        from '@/domain/value-objects/createOrderSchema';
import { createOrderUseCase }       from '@/application/use-cases/createOrder';

const rawHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const input = event.body as CreateOrderInput; // already validated + parsed by middleware
  const result = await createOrderUseCase(input);
  return { statusCode: 201, body: JSON.stringify(result) };
};

export const handler = middy(rawHandler)
  // 1. Parse JSON body first
  .use(httpJsonBodyParser())
  // 2. Inject correlation ID before any logging
  .use(correlationIdMiddleware())
  // 3. Powertools: logger context (requestId, cold start, correlation ID)
  .use(injectLambdaContext(logger, { resetKeys: true }))
  // 4. Powertools: X-Ray tracing
  .use(captureLambdaHandler(tracer))
  // 5. Powertools: metrics flush
  .use(logMetrics(metrics, { captureColdStartMetric: true }))
  // 6. Input validation — rejects with 400 before handler runs
  .use(zodValidatorMiddleware({ bodySchema: CreateOrderSchema }))
  // 7. Error handler MUST be last — catches errors from all above
  .use(httpErrorHandler({ fallbackMessage: 'Internal server error' }))
  .use(mapDomainErrorToHttp());
````

**Middleware order is significant.** Middlewares run in registration order for `before` hooks and in reverse order for `after`/`onError` hooks.

---

## Core middleware — always included

| Middleware                | Purpose                                       | Position                     |
| ------------------------- | --------------------------------------------- | ---------------------------- |
| `httpJsonBodyParser`      | Parses `event.body` string to object          | First                        |
| `correlationIdMiddleware` | Sets `X-Correlation-ID` on context + response | Second                       |
| `injectLambdaContext`     | Attaches requestId/cold start to logger       | Third                        |
| `captureLambdaHandler`    | X-Ray tracing segment                         | Fourth                       |
| `logMetrics`              | Flushes Powertools metrics on response        | Fifth                        |
| `zodValidatorMiddleware`  | Input validation, rejects 400 early           | Before handler               |
| `httpErrorHandler`        | Maps errors to HTTP responses                 | Last before `mapDomainError` |
| `mapDomainErrorToHttp`    | Translates domain errors to HTTP codes        | Absolute last                |

---

## Building a custom middleware

```typescript
// shared/middleware/correlationId.ts
import type { MiddlewareObj } from '@middy/core';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { logger } from '@/shared/observability';

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
    (request.context as Record<string, unknown>).correlationId = correlationId;
    logger.appendKeys({ correlationId });
  },
  after: async (request) => {
    // Propagate correlation ID in response headers
    const correlationId = (request.context as Record<string, unknown>)
      .correlationId as string;
    request.response = {
      ...request.response,
      headers: {
        ...(request.response as APIGatewayProxyResult).headers,
        'X-Correlation-ID': correlationId,
      },
    };
  },
});
```

**Custom middleware contract:**

- `before`: runs before handler. Mutate `request.event` or `request.context`. Return early to short-circuit (return `request.response`).
- `after`: runs after handler. Mutate `request.response`.
- `onError`: runs when any middleware or handler throws. Must either re-throw or set `request.response` to suppress.

---

## Zod validator middleware

```typescript
// shared/middleware/zodValidator.ts
import type { MiddlewareObj } from '@middy/core';
import type { ZodSchema } from 'zod';
import createError from 'http-errors';

interface Options {
  bodySchema?: ZodSchema;
  querySchema?: ZodSchema;
  pathSchema?: ZodSchema;
}

export const zodValidatorMiddleware = (options: Options): MiddlewareObj => ({
  before: async (request) => {
    if (options.bodySchema) {
      const result = options.bodySchema.safeParse(request.event.body);
      if (!result.success) {
        throw createError(400, 'Validation error', {
          details: result.error.flatten(),
        });
      }
      (request.event as Record<string, unknown>).body = result.data;
    }

    if (options.querySchema) {
      const result = options.querySchema.safeParse(
        request.event.queryStringParameters ?? {},
      );
      if (!result.success)
        throw createError(400, 'Invalid query parameters', {
          details: result.error.flatten(),
        });
      (request.event as Record<string, unknown>).queryStringParameters =
        result.data;
    }
  },
});
```

---

## Domain error → HTTP mapper middleware

```typescript
// shared/errors/errorMapper.ts
import type { MiddlewareObj } from '@middy/core';
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '@/domain/errors';

const ERROR_MAP: Record<string, number> = {
  NotFoundError: 404,
  ConflictError: 409,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  ValidationError: 400,
};

export const mapDomainErrorToHttp = (): MiddlewareObj => ({
  onError: async (request) => {
    const error = request.error;
    const statusCode = ERROR_MAP[error.constructor.name] ?? 500;

    request.response = {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: statusCode < 500 ? error.message : 'Internal server error',
        // Never expose stack traces or internal details in 5xx responses
      }),
    };
    // Do not re-throw — error is handled
  },
});
```

---

## SQS handler with Middy

```typescript
import middy from '@middy/core';
import sqsPartialBatchFailure from '@middy/sqs-partial-batch-failure';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logger } from '@/shared/observability';
import type { SQSEvent, SQSRecord } from 'aws-lambda';

const processRecord = async (record: SQSRecord): Promise<void> => {
  const payload = JSON.parse(record.body);
  await processOrderUseCase(payload);
};

const rawHandler = async (event: SQSEvent) => {
  const promises = event.Records.map((record) =>
    processRecord(record).catch((err) => {
      logger.error('Record processing failed', {
        messageId: record.messageId,
        error: err,
      });
      throw err; // rethrow so sqsPartialBatchFailure marks it failed
    }),
  );
  return Promise.allSettled(promises);
};

export const handler = middy(rawHandler)
  .use(injectLambdaContext(logger, { resetKeys: true }))
  .use(sqsPartialBatchFailure()); // reports partial failures — only failed messages return to queue
```

---

## Testing handlers with Middy

```typescript
// createOrder.handler.test.ts
import { handler } from './createOrder';
import { mockEvent, mockContext } from '@/test-utils/lambda';

it('returns 201 for valid input', async () => {
  const event = mockEvent({
    body: JSON.stringify({
      userId: 'usr_1',
      items: [{ productId: 'p1', qty: 1 }],
    }),
  });

  const response = await handler(event, mockContext(), () => {});
  expect(response.statusCode).toBe(201);
});

it('returns 400 for invalid body', async () => {
  const event = mockEvent({ body: JSON.stringify({ userId: '' }) });
  const response = await handler(event, mockContext(), () => {});
  expect(response.statusCode).toBe(400);
});

it('returns 404 for unknown resource (domain error)', async () => {
  // Mock the use case to throw NotFoundError
  vi.mocked(createOrderUseCase).mockRejectedValueOnce(
    new NotFoundError('User not found'),
  );
  const event = mockEvent({
    body: JSON.stringify({ userId: 'usr_999', items: [] }),
  });
  const response = await handler(event, mockContext(), () => {});
  expect(response.statusCode).toBe(404);
});
```

**Test at the handler level** (with the full Middy stack) to verify middleware behavior. Unit test use cases separately.

---

## Anti-patterns

| Anti-pattern                               | Problem                                               | Fix                                                  |
| ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------- |
| Handler without Middy                      | No correlation ID, no error mapping, no observability | Always use `middy()` wrapper                         |
| Business logic in handler                  | Untestable, violates hexagonal arch                   | Move to `application/use-cases/`                     |
| `httpErrorHandler` not last                | Domain error mapper can't run                         | Put `httpErrorHandler` + `mapDomainErrorToHttp` last |
| Catching and swallowing errors in handler  | Bypasses `onError` chain                              | Let errors propagate to Middy                        |
| Parsing body manually in handler           | Duplicates `httpJsonBodyParser`                       | Remove — body is pre-parsed by middleware            |
| Custom middleware without `onError`        | Leaves resources open on failure                      | Add `onError` to release resources                   |
| Not using `sqsPartialBatchFailure` for SQS | All-or-nothing retry behavior                         | Always use partial batch failure middleware          |

---

## Checklist

- [ ] Every handler wrapped with `middy()`.
- [ ] `httpJsonBodyParser` is first middleware.
- [ ] `correlationIdMiddleware` propagates and returns `X-Correlation-ID` header.
- [ ] `injectLambdaContext`, `captureLambdaHandler`, `logMetrics` present.
- [ ] `zodValidatorMiddleware` validates all external inputs before handler runs.
- [ ] `httpErrorHandler` + `mapDomainErrorToHttp` are the last middlewares.
- [ ] SQS handlers use `sqsPartialBatchFailure`.
- [ ] Handler integration tests cover 200/201, 400, 401, 404, 500 paths.
- [ ] No business logic in handler function body.

```

```
