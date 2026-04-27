````skill
---
name: input-validation-patterns
description: Validate and sanitize all external inputs in Lambda handlers using Zod and middy — OWASP A03 defense.
---

## Why input validation is the first line of defense

Lambda handlers receive input from API Gateway (path params, query strings,
headers, body), SQS messages, EventBridge events, and S3 notifications. Every
field from these sources is attacker-controlled and must be validated before
reaching business logic.

Failing to validate enables: injection attacks, type confusion bugs, silent data
corruption, and crashes from unexpected shapes.

**Rule**: validate ALL external inputs at the handler boundary. Reject unknown
fields. Never pass raw event data into business logic or database calls.

## Zod schema patterns

### API Gateway — body, path params, query strings

```typescript
// services/api/src/schemas/orders/create-order.schema.ts
import { z } from 'zod';

// Request body
export const CreateOrderBodySchema = z.object({
  customerId: z.string().uuid('customerId must be a valid UUID'),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(100),
      })
    )
    .min(1, 'Order must have at least one item')
    .max(50, 'Order cannot have more than 50 items'),
  notes: z.string().max(500).optional(),
  // strip unknown fields — attackers cannot inject extra fields
}).strict();

// Path parameters
export const OrderPathParamsSchema = z.object({
  orderId: z.string().uuid('orderId must be a valid UUID'),
});

// Query string
export const ListOrdersQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

// Infer types for use in business logic
export type CreateOrderBody = z.infer<typeof CreateOrderBodySchema>;
export type OrderPathParams = z.infer<typeof OrderPathParamsSchema>;
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;
```

### Manual validation in handler (no middy)

```typescript
// services/api/src/handlers/orders/create.handler.ts
import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import { CreateOrderBodySchema, OrderPathParamsSchema } from '../../schemas/orders/create-order.schema';
import { ValidationError } from '../../errors/domain-errors';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResult> => {
  // 1. Parse and validate body
  let body: CreateOrderBody;
  try {
    const rawBody = JSON.parse(event.body ?? '{}');
    body = CreateOrderBodySchema.parse(rawBody); // throws ZodError on failure
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          fields: formatZodError(err),
        }),
      };
    }
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }) };
  }

  // 2. Validate path params
  const pathResult = OrderPathParamsSchema.safeParse(event.pathParameters ?? {});
  if (!pathResult.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid path parameters', code: 'VALIDATION_ERROR', fields: formatZodError(pathResult.error) }),
    };
  }

  // body and pathResult.data are now typed and safe to pass to business logic
  // ...
};

function formatZodError(err: ZodError): Record<string, string> {
  return Object.fromEntries(
    err.errors.map((e) => [e.path.join('.'), e.message])
  );
}
```

### middy validator middleware (preferred for complex handlers)

For handlers with multiple validation surfaces, use middy's validator middleware
with the Zod adapter:

```bash
npm install @middy/validator zod-to-json-schema
```

```typescript
// services/api/src/handlers/orders/create.handler.ts
import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import validator from '@middy/validator';
import httpErrorHandler from '@middy/http-error-handler';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CreateOrderBodySchema } from '../../schemas/orders/create-order.schema';

const lambdaHandler = async (event: ValidatedEvent) => {
  // event.body is already parsed and validated here — type-safe
  const { customerId, items } = event.body;
  // ...
};

export const handler = middy(lambdaHandler)
  .use(httpJsonBodyParser())
  .use(
    validator({
      eventSchema: zodToJsonSchema(
        z.object({ body: CreateOrderBodySchema })
      ),
    })
  )
  .use(httpErrorHandler()); // converts validation errors to 400 responses
```

## SQS message validation

SQS records have a `body` string that must be JSON-parsed and validated:

```typescript
// services/api/src/handlers/orders/process.handler.ts
import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { z } from 'zod';

const OrderEventSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  eventType: z.enum(['ORDER_CREATED', 'ORDER_UPDATED']),
  timestamp: z.string().datetime(),
});

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const parsed = JSON.parse(record.body);
      const validated = OrderEventSchema.parse(parsed); // throws on invalid
      await processOrderEvent(validated);
    } catch (err) {
      logger.error('Message validation/processing failed', {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
```

## Path parameter validation (critical for injection prevention)

Path parameters are strings and can contain injection payloads. Always validate
before using in queries or file paths:

```typescript
// ❌ BAD — direct use of path param in query
const orderId = event.pathParameters?.orderId;
await db.get({ TableName, Key: { PK: `ORDER#${orderId}` } });

// ✅ GOOD — validated UUID before use
const { orderId } = OrderPathParamsSchema.parse(event.pathParameters ?? {});
await db.get({ TableName, Key: { PK: `ORDER#${orderId}` } });
```

UUID validation prevents path traversal (`../../../etc/passwd`) and NoSQL
injection (`{"$gt": ""}`).

## Environment variable validation (startup, not per-request)

See also: `lambda-performance` skill. Validate at module load:

```typescript
// services/api/src/lib/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  TABLE_NAME: z.string().min(1),
  QUEUE_URL: z.string().url(),
  SERVICE_NAME: z.string().min(1),
  SLS_STAGE: z.enum(['dev', 'staging', 'prod']),
  IDEMPOTENCY_TABLE_NAME: z.string().min(1),
});

// Throws at cold start if any required var is missing
export const env = EnvSchema.parse(process.env);
```

## .strict() vs .passthrough() — always prefer .strict()

```typescript
// .strict() — rejects unknown fields (default recommendation)
z.object({ name: z.string() }).strict().parse({ name: 'Alice', injected: 'DROP TABLE' });
// → throws: Unrecognized key(s) in object: 'injected'

// .passthrough() — allows unknown fields (use only when explicitly needed)
// .strip() — silently removes unknown fields (safe but silent)
```

Use `.strict()` for all input schemas. It makes injection attempts visible
in logs instead of silently accepting them.

## Reusable primitive schemas

```typescript
// services/api/src/schemas/primitives.ts
import { z } from 'zod';

export const UUIDSchema = z.string().uuid();
export const EmailSchema = z.string().email().max(254).toLowerCase();
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});
export const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).refine(
  (v) => !v.from || !v.to || new Date(v.from) <= new Date(v.to),
  { message: "'from' must be before or equal to 'to'" }
);
```

## Anti-patterns

- ❌ `JSON.parse(event.body)` without schema validation — trust no external input.
- ❌ Using `event.pathParameters?.orderId` directly in DB queries — prevents injection.
- ❌ `z.object({}).passthrough()` as a "validate later" — validation deferred is validation skipped.
- ❌ Type assertions (`as CreateOrderBody`) instead of parsing — bypasses runtime safety.
- ❌ Validating only in the frontend — backend must always validate independently.
- ❌ Logging the raw request body on validation failure — it may contain PII or injection payload.

## Checklist

- [ ] All body, path param, query string, and header inputs validated with Zod schemas.
- [ ] Schemas use `.strict()` to reject unknown fields.
- [ ] Path parameters validated as UUIDs or enums before use in DB queries.
- [ ] SQS message bodies parsed and schema-validated per record.
- [ ] Environment variables validated with Zod at module load (not inside handler).
- [ ] ZodError formatted as `{ fields: { fieldPath: message } }` in 400 responses.
- [ ] Raw request body NOT logged on validation failure.
- [ ] Reusable primitive schemas extracted to `src/schemas/primitives.ts`.
- [ ] Schema types exported with `z.infer<typeof Schema>` for use in business logic.
````
