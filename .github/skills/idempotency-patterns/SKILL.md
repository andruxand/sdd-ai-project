````skill
---
name: idempotency-patterns
description: Implement idempotency for Lambda write operations to prevent duplicate processing on retries.
---

## Why idempotency is mandatory

Lambda is invoked at-least-once. SQS, EventBridge, and API Gateway retries will
call the same handler multiple times. Without idempotency keys, retries cause
duplicate writes, duplicate charges, duplicate emails, or corrupted state.

**Rule**: every write operation (POST, PUT, PATCH, DELETE with side effects, SQS
handler) MUST be idempotent.

## Implementation — DynamoDB idempotency key

Use `@aws-lambda-powertools/idempotency` — it uses a DynamoDB table as the
idempotency store and is already in the tech stack.

### 1. DynamoDB idempotency table (CloudFormation)

Add once per service, shared across all handlers that need idempotency:

```yaml
# serverless.ts resources section
IdempotencyTable:
  Type: AWS::DynamoDB::Table
  DeletionPolicy: Retain
  Properties:
    TableName: ${self:service}-${sls:stage}-idempotency
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: id
        AttributeType: S
    KeySchema:
      - AttributeName: id
        KeyType: HASH
    TimeToLiveSpecification:
      AttributeName: expiration
      Enabled: true
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: true
    Tags:
      - Key: service
        Value: ${self:service}
      - Key: stage
        Value: ${sls:stage}
```

### 2. IAM — per-function least privilege

```yaml
# In the function definition in serverless.ts
iamRoleStatements:
  - Effect: Allow
    Action:
      - dynamodb:GetItem
      - dynamodb:PutItem
      - dynamodb:UpdateItem
      - dynamodb:DeleteItem
    Resource:
      - !GetAtt IdempotencyTable.Arn
```

### 3. Handler with Powertools idempotency middleware

```typescript
// services/api/src/handlers/orders/create.handler.ts
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import {
  makeIdempotent,
  IdempotencyConfig,
} from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import middy from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const logger = new Logger({ serviceName: process.env.SERVICE_NAME! });
const tracer = new Tracer({ serviceName: process.env.SERVICE_NAME! });
const metrics = new Metrics({ namespace: process.env.SERVICE_NAME! });

// Initialize persistence layer at module level (connection reuse)
const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME!,
});

const idempotencyConfig = new IdempotencyConfig({
  eventKeyJmespath: 'body.clientToken', // extract key from request body
  expiresAfterSeconds: 3600,             // 1 hour TTL
  throwOnNoIdempotencyKey: true,         // reject requests without a key
});

// Use makeIdempotent to wrap the handler function
const lambdaHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const body = JSON.parse(event.body ?? '{}');

  // Business logic here — only executes once per clientToken
  const result = await createOrder(body);

  return {
    statusCode: 201,
    body: JSON.stringify(result),
  };
};

export const handler = middy(
  makeIdempotent(lambdaHandler, {
    persistenceStore,
    config: idempotencyConfig,
  })
)
  .use(logger.injectLambdaContext())
  .use(tracer.captureLambdaHandler())
  .use(metrics.logMetrics());
```

### 4. SQS handler — idempotency by messageId

For SQS, use the `messageId` as the natural idempotency key — it is stable
across redeliveries of the same message:

```typescript
import { makeIdempotent, IdempotencyConfig } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import { SQSEvent, SQSBatchResponse } from 'aws-lambda';

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME!,
});

const idempotencyConfig = new IdempotencyConfig({
  eventKeyJmespath: 'messageId', // SQSRecord has messageId at root
  expiresAfterSeconds: 86400,    // 24 hours — longer than SQS visibility timeout
});

// processRecord is the function that must be idempotent
const processRecord = makeIdempotent(
  async (record: SQSEvent['Records'][number]) => {
    // process a single SQS message
    const body = JSON.parse(record.body);
    await processOrder(body);
  },
  { persistenceStore, config: idempotencyConfig }
);

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (err) {
      // idempotency errors (duplicate detected) are NOT failures — let them pass
      if ((err as Error).name === 'IdempotencyAlreadyInProgressError') {
        // in-flight duplicate — re-queue by marking as failure
        batchItemFailures.push({ itemIdentifier: record.messageId });
      } else if ((err as Error).name === 'IdempotencyItemAlreadyExistsError') {
        // successful duplicate — skip silently, message is already processed
        continue;
      } else {
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
  }

  return { batchItemFailures };
};
```

## Client-side idempotency key — API pattern

For HTTP API endpoints that accept writes, require the client to send a
`X-Idempotency-Key` header (UUID v4 generated client-side) or a `clientToken`
in the request body.

Document in the OpenAPI spec:

```yaml
parameters:
  - in: header
    name: X-Idempotency-Key
    required: true
    schema:
      type: string
      format: uuid
    description: >
      UUID generated by the client. Submitting the same key twice returns the
      cached response without executing the operation again. Valid for 1 hour.
```

Extract in handler:

```typescript
const idempotencyKey =
  event.headers['x-idempotency-key'] ??
  event.headers['X-Idempotency-Key'];

if (!idempotencyKey) {
  return { statusCode: 422, body: JSON.stringify({ error: 'X-Idempotency-Key header required' }) };
}
```

Configure `eventKeyJmespath: "headers.\"x-idempotency-key\""` in IdempotencyConfig.

## When NOT to use Powertools idempotency

| Scenario | Alternative |
|---|---|
| Read-only operations (GET, LIST) | No idempotency needed |
| Naturally idempotent writes (PUT with full resource replace) | No library needed — design is already idempotent |
| Very high throughput (>1000 TPS per function) | Consider conditional writes pattern instead |

## Conditional writes pattern (alternative for high throughput)

Instead of a separate idempotency table, use DynamoDB conditional expressions
on the target table:

```typescript
import { DynamoDBClient, PutItemCommand, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

async function createOrderIdempotent(orderId: string, data: OrderData) {
  try {
    await client.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall({ PK: `ORDER#${orderId}`, SK: 'METADATA', ...data }),
      ConditionExpression: 'attribute_not_exists(PK)', // idempotency check
    }));
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      // Already exists — idempotent success. Return the existing item.
      return getOrder(orderId);
    }
    throw err;
  }
}
```

## Anti-patterns

- ❌ Using timestamp (Date.now()) as idempotency key — not stable across retries.
- ❌ Using correlationId as idempotency key — correlation IDs can be reused across different requests.
- ❌ No TTL on idempotency table — table grows unbounded.
- ❌ Sharing one idempotency table across services — cross-service key collisions.
- ❌ Not handling `IdempotencyAlreadyInProgressError` — leads to incorrect batch failures in SQS.

## Checklist

- [ ] Every POST/PUT/PATCH/DELETE handler that has side effects uses idempotency.
- [ ] Every SQS consumer handler uses idempotency (by messageId or body field).
- [ ] Idempotency table defined in CloudFormation with TTL enabled.
- [ ] IAM scoped to only the idempotency table.
- [ ] OpenAPI spec documents `X-Idempotency-Key` header for writeable endpoints.
- [ ] `throwOnNoIdempotencyKey: true` so missing keys are caught early.
- [ ] Tests cover: first execution, duplicate execution (cached), in-flight duplicate.
````
