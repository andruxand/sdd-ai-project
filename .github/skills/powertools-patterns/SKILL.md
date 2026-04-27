````skill
---
name: powertools-patterns
description: AWS Lambda Powertools v2 (TypeScript) — Logger, Tracer, Metrics singleton setup, Middy integration, custom subsegments, business metrics with dimensions, cold start handling, and testing patterns. Mandatory for every Lambda handler.
type: always-active
agents: [backend-implementer, tester-backend, observability-implementer]
---

## Singleton setup — one file per service

Create once, import everywhere. Never instantiate per handler.

```typescript
// services/api/src/shared/observability.ts
import { Logger }  from '@aws-lambda-powertools/logger';
import { Tracer }  from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

export const logger = new Logger({
  serviceName:  process.env.SERVICE_NAME  ?? 'api',
  logLevel:     (process.env.LOG_LEVEL as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') ?? 'INFO',
  persistentLogAttributes: {
    environment: process.env.STAGE ?? 'unknown',
  },
});

export const tracer = new Tracer({
  serviceName: process.env.SERVICE_NAME ?? 'api',
});

export const metrics = new Metrics({
  namespace:   process.env.METRICS_NAMESPACE ?? 'AppMetrics',
  serviceName: process.env.SERVICE_NAME ?? 'api',
});

// Re-export MetricUnit for convenience
export { MetricUnit };
````

**Rules:**

- One `observability.ts` per service — never per handler.
- `SERVICE_NAME` and `METRICS_NAMESPACE` from env vars (validated at module load via Zod).
- Do NOT pass `Logger` instances as constructor arguments down to domain or application layers. Inject via `logger.appendKeys` in the handler context, not in use cases.

---

## Logger — mandatory patterns

```typescript
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logger } from '@/shared/observability';

// ✅ Every log line must include 'action' describing what the code is doing
logger.info('Processing order', {
  action: 'processOrder',
  orderId: order.id, // branded ID — safe to log
  userId: hashedUserId, // hash PII before logging
  itemCount: order.items.length,
});

logger.error('Order processing failed', {
  action: 'processOrder',
  orderId: input.orderId,
  error: err instanceof Error ? err.message : String(err),
  // ❌ Never: error: err (leaks stack trace + potentially sensitive data)
  // ❌ Never: userId: user.email (PII)
});

// ✅ Conditional extra context in DEBUG only (never in prod by default)
logger.debug('DynamoDB response', {
  action: 'fetchUser',
  itemCount: result.Items?.length,
  // ❌ Never: response: result (full DynamoDB payload)
});
```

### Correlation ID propagation

```typescript
// Correlation ID is set by the correlationId middleware (see middy-patterns).
// Powertools picks it up automatically from the Lambda context via injectLambdaContext.
// Propagate manually to downstream SQS messages:

await sqs.send(
  new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload),
    MessageAttributes: {
      correlationId: {
        DataType: 'String',
        StringValue: (context as Record<string, unknown>)
          .correlationId as string,
      },
    },
  }),
);
```

---

## Tracer — mandatory patterns

```typescript
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { tracer } from '@/shared/observability';

// ✅ Capture DynamoDB client — adds subsegment automatically for every DDB call
const dynamoClient = tracer.captureAWSv3Client(
  new DynamoDBDocumentClient(baseClient),
);

// ✅ Custom subsegment for external HTTP call
async function callExternalApi(orderId: string) {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('callPaymentApi');

  try {
    const response = await paymentClient.charge(orderId);
    subsegment?.addAnnotation('paymentStatus', response.status); // IDs + statuses only
    subsegment?.addMetadata('chargeResult', { amount: response.amount }); // sanitized
    return response;
  } catch (err) {
    subsegment?.addError(err as Error, false); // false = do not capture stack in metadata
    throw err;
  } finally {
    subsegment?.close();
  }
}

// ✅ Annotation guidelines:
// - putAnnotation: searchable in X-Ray. Use for IDs and status codes only.
// - putMetadata: NOT searchable. Use for sanitized response shapes.
// ❌ Never annotate: email, phone, SSN, tokens, raw error messages
tracer.putAnnotation('orderId', orderId);
tracer.putAnnotation('userId', userId); // branded ID — not PII
tracer.putAnnotation('httpStatus', response.statusCode);
```

---

## Metrics — mandatory patterns

```typescript
import {
  logMetrics,
  MetricUnit,
} from '@aws-lambda-powertools/metrics/middleware';
import { metrics } from '@/shared/observability';

// ✅ Standard metrics — add in every handler
metrics.addMetric('FunctionInvocationsCount', MetricUnit.Count, 1);

// ✅ Business metrics — add for meaningful domain events
// Include dimensions for filtering by service, feature, and environment
metrics.addDimension('feature', 'order-processing');
metrics.addMetric('OrdersCreated', MetricUnit.Count, 1);
metrics.addMetric('OrderItemCount', MetricUnit.Count, order.items.length);
metrics.addMetric('OrderValueCents', MetricUnit.Count, order.totalCents);

// ✅ Error metric — increment on caught errors
metrics.addMetric('FunctionErrorsCount', MetricUnit.Count, 1);

// ✅ Duration — use Performance API, not Date.now()
const start = performance.now();
await processOrder(input);
metrics.addMetric(
  'ProcessingDuration',
  MetricUnit.Milliseconds,
  performance.now() - start,
);

// logMetrics Middy middleware flushes all metrics at handler end.
// Do NOT call metrics.publishStoredMetrics() manually when using the middleware.
```

### Cold start metric

```typescript
// ✅ In the Middy stack — captureColdStartMetric: true handles this automatically
.use(logMetrics(metrics, { captureColdStartMetric: true }))
// This publishes a ColdStart metric (Count=1) on the first invocation only.
// No manual cold start tracking needed.
```

---

## Complete Middy stack order (reference)

```typescript
export const handler = middy(rawHandler)
  .use(httpJsonBodyParser())
  .use(correlationIdMiddleware())
  .use(injectLambdaContext(logger, { resetKeys: true })) // Logger context
  .use(captureLambdaHandler(tracer)) // Tracer segment
  .use(logMetrics(metrics, { captureColdStartMetric: true })) // Metrics flush
  .use(zodValidatorMiddleware({ bodySchema: InputSchema }))
  .use(httpErrorHandler({ fallbackMessage: 'Internal server error' }))
  .use(mapDomainErrorToHttp());
```

`resetKeys: true` on `injectLambdaContext` clears previously appended log keys between warm invocations — prevents key leakage from one request to the next.

---

## Powertools Idempotency

```typescript
import {
  makeHandlerIdempotent,
  IdempotencyConfig,
} from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import middy from '@middy/core';

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME!,
});

const idempotencyConfig = new IdempotencyConfig({
  expiresAfterSeconds: 3600, // 1 hour - tune per domain requirement
  useLocalCache: true, // avoids DDB hit on warm cache
  eventKeyJmesPath: 'body', // or 'requestContext.requestId' for API GW
});

const rawHandler = async (event: APIGatewayProxyEvent) => {
  /* ... */
};

export const handler = middy(
  makeHandlerIdempotent(rawHandler, {
    persistenceStore,
    config: idempotencyConfig,
  }),
).use(/* ... standard middleware stack */);
```

**When to use:**

- All `POST`/`PUT`/`PATCH` Lambda handlers (creates and mutations).
- All SQS consumers that perform writes (DynamoDB, email, payment).
- NOT needed for `GET` handlers (idempotent by definition).

See `idempotency-patterns` skill for full test scenarios.

---

## Serverless.ts — Powertools environment variables

```typescript
// serverless.ts — provider.environment (shared across all functions)
environment: {
  SERVICE_NAME:         '${self:service}',
  STAGE:                '${sls:stage}',
  METRICS_NAMESPACE:    '${self:service}-${sls:stage}',
  LOG_LEVEL:            '${param:logLevel, "INFO"}',
  POWERTOOLS_LOGGER_LOG_EVENT: '${param:logEvent, "false"}', // log full event in debug only
  POWERTOOLS_TRACER_CAPTURE_RESPONSE:  'false', // do not capture full response in prod
  POWERTOOLS_TRACER_CAPTURE_ERROR:     'true',
},
```

---

## Testing — Powertools in unit tests

```typescript
import { vi, beforeEach } from 'vitest';

// ✅ Mock Powertools logger to prevent log noise in test output
vi.mock('@aws-lambda-powertools/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    appendKeys: vi.fn(),
    removeKeys: vi.fn(),
  })),
}));

// ✅ Mock tracer
vi.mock('@aws-lambda-powertools/tracer', () => ({
  Tracer: vi.fn().mockImplementation(() => ({
    captureAWSv3Client: (client: unknown) => client, // return client as-is
    getSegment: vi.fn().mockReturnValue({
      addNewSubsegment: vi.fn().mockReturnValue({
        close: vi.fn(),
        addAnnotation: vi.fn(),
        addMetadata: vi.fn(),
        addError: vi.fn(),
      }),
    }),
    putAnnotation: vi.fn(),
    putMetadata: vi.fn(),
  })),
}));

// ✅ Mock metrics
vi.mock('@aws-lambda-powertools/metrics', () => ({
  Metrics: vi.fn().mockImplementation(() => ({
    addMetric: vi.fn(),
    addDimension: vi.fn(),
    publishStoredMetrics: vi.fn(),
  })),
  MetricUnit: { Count: 'Count', Milliseconds: 'Milliseconds' },
}));

// ✅ Mock the singleton module (shared/observability.ts)
vi.mock('@/shared/observability', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    appendKeys: vi.fn(),
  },
  tracer: {
    captureAWSv3Client: (c: unknown) => c,
    putAnnotation: vi.fn(),
    putMetadata: vi.fn(),
  },
  metrics: { addMetric: vi.fn(), addDimension: vi.fn() },
  MetricUnit: { Count: 'Count', Milliseconds: 'Milliseconds' },
}));
```

---

## Anti-patterns

| Anti-pattern                                              | Problem                                         | Fix                                        |
| --------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `console.log` / `console.error`                           | Not structured, no cold_start, no correlationId | `logger.info()` / `logger.error()`         |
| `new Logger()` in every handler                           | Multiple logger instances, inconsistent context | Singleton in `shared/observability.ts`     |
| Annotating PII in traces (`email`, `phone`)               | Data leak to X-Ray console                      | Annotate IDs and status codes only         |
| `metrics.publishStoredMetrics()` with middleware          | Double flush                                    | Remove manual call — middleware handles it |
| Logging full `event` object                               | Leaks headers, tokens, body                     | Extract only safe fields                   |
| `resetKeys: false` on injectLambdaContext                 | Keys from previous request leak into next       | Always `resetKeys: true`                   |
| Not mocking Powertools in tests                           | Noise in test output, test pollution            | Mock `shared/observability.ts` singleton   |
| Creating new DynamoDB client without `captureAWSv3Client` | Missing DDB subsegments in X-Ray                | `tracer.captureAWSv3Client(client)`        |

---

## Checklist

- [ ] Singleton `shared/observability.ts` created with Logger, Tracer, Metrics.
- [ ] `SERVICE_NAME`, `METRICS_NAMESPACE`, `LOG_LEVEL` from env vars.
- [ ] Every handler uses `injectLambdaContext(logger, { resetKeys: true })`.
- [ ] Every handler uses `captureLambdaHandler(tracer)`.
- [ ] Every handler uses `logMetrics(metrics, { captureColdStartMetric: true })`.
- [ ] DynamoDB client wrapped with `tracer.captureAWSv3Client()`.
- [ ] External HTTP calls wrapped in custom subsegments.
- [ ] No PII in annotations or metadata — IDs and status codes only.
- [ ] Business metrics defined with dimensions (`env`, `service`, `feature`).
- [ ] Every metric has a CloudWatch alarm or Datadog monitor.
- [ ] Write handlers use `makeHandlerIdempotent`.
- [ ] Tests mock `shared/observability.ts` singleton.

```

```
