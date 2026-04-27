# AWS Architecture Standards

## Well-Architected principles

Every architecture decision should be reviewed against the six AWS Well-Architected pillars:

1. **Operational Excellence**: structured logging, tracing, runbooks, deployment automation.
2. **Security**: least-privilege IAM, encryption, secrets management, input validation.
3. **Reliability**: retries with backoff, DLQ for async, idempotency, circuit breakers.
4. **Performance**: right-sized Lambda memory/timeout, connection reuse, cold start optimization.
5. **Cost Optimization**: right-sized resources, log retention limits, cleanup unused resources.
6. **Sustainability**: efficient compute, minimal data transfer.

## Design principles

- **Stateless**: Lambda functions must not rely on local state between invocations.
- **Separation of concerns**: handler (wiring) vs business logic (use cases) vs infrastructure (serverless.ts).
- **Async when justified**: use SQS/SNS/EventBridge for operations that don't need synchronous response.
- **Idempotency**: write operations must be safe to retry.
- **Connection reuse**: use keep-alive for HTTP clients, connection pooling for DB.

## Lambda configuration

- Memory and timeout must be explicitly configured per function (not provider defaults).
- Use `logRetentionInDays: 30` minimum.
- Bundle with esbuild or equivalent for smaller packages and faster cold starts.
- Use layers only when shared across multiple functions.

## Idempotency (mandatory for write operations)

Every Lambda that performs a write (insert, update, delete, send message, charge)
MUST be idempotent. AWS retries on partial failures — duplicate execution must
produce the same observable outcome as a single execution.

Use `@aws-lambda-powertools/idempotency` with DynamoDB as the persistence layer:

```typescript
import {
  IdempotencyConfig,
  makeHandlerIdempotent,
} from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import middy from '@middy/core';

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME!,
});

const idempotencyConfig = new IdempotencyConfig({
  expiresAfterSeconds: 3600, // 1 hour — tune per business requirement
  useLocalCache: true, // avoids DDB call on warm hit
  eventKeyJmesPath: 'body', // use request body as idempotency key (or 'requestContext.requestId')
});

export const handler = middy(
  makeHandlerIdempotent(
    async (event: APIGatewayProxyEvent) => {
      // business logic here — runs at most once per unique key within TTL
    },
    { persistenceStore, config: idempotencyConfig },
  ),
);
```

Required DynamoDB table in `serverless.ts`:

```typescript
resources: {
  Resources: {
    IdempotencyTable: {
      Type: 'AWS::DynamoDB::Table',
      Properties: {
        TableName: '${self:service}-${opt:stage}-idempotency',
        BillingMode: 'PAY_PER_REQUEST',
        TimeToLiveSpecification: { AttributeName: 'expiration', Enabled: true },
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      },
    },
  },
},
```

IAM for the function:

```typescript
iamRoleStatements: [
  {
    Effect: 'Allow',
    Action: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
    Resource: { 'Fn::GetAtt': ['IdempotencyTable', 'Arn'] },
  },
],
```

## Dead Letter Queue (DLQ) for async invocations

Every Lambda triggered by SQS, SNS, or EventBridge MUST have a DLQ. Without it,
failed messages are silently dropped after the source's retry policy exhausts.

```typescript
// serverless.ts — SQS trigger with DLQ
functions: {
  orderProcessor: {
    handler: 'src/handlers/orders/process.handler',
    events: [
      {
        sqs: {
          arn: { 'Fn::GetAtt': ['OrderQueue', 'Arn'] },
          batchSize: 10,
          maximumBatchingWindow: 5,
          functionResponseType: 'ReportBatchItemFailures', // partial batch success
        },
      },
    ],
    onError: { 'Fn::GetAtt': ['OrderProcessorDLQ', 'Arn'] },
  },
},

resources: {
  Resources: {
    OrderQueue: {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: '${self:service}-${opt:stage}-orders',
        VisibilityTimeout: 300,
        RedrivePolicy: {
          deadLetterTargetArn: { 'Fn::GetAtt': ['OrderQueueDLQ', 'Arn'] },
          maxReceiveCount: 3, // retry 3 times before DLQ
        },
      },
    },
    OrderQueueDLQ: {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: '${self:service}-${opt:stage}-orders-dlq',
        MessageRetentionPeriod: 1209600, // 14 days
      },
    },
    OrderProcessorDLQ: {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: '${self:service}-${opt:stage}-order-processor-dlq',
        MessageRetentionPeriod: 1209600,
      },
    },
  },
},
```

**Alert on DLQ depth**: add a CloudWatch alarm for `ApproximateNumberOfMessagesVisible > 0`
on every DLQ. A message in the DLQ means data loss risk — it must page on-call.

## Error handling

- Retry transient failures with exponential backoff.
- DLQ for async invocations (SQS, SNS triggers) — see DLQ section above.
- Circuit breaker for external HTTP dependencies.
- Map domain errors to appropriate HTTP status codes.
- Use typed domain error classes — see `docs/standards/aws-security.md`.

## Anti-patterns

- Do NOT store state in `/tmp` across invocations.
- Do NOT set Lambda timeout to 15 minutes "just in case".
- Do NOT use synchronous calls for fire-and-forget operations.
- Do NOT deploy monolithic Lambda functions — one function per route/event.

## Checklist

- [ ] Stateless design verified.
- [ ] Memory and timeout explicitly configured.
- [ ] DLQ defined for every async trigger (SQS, SNS, EventBridge).
- [ ] DLQ CloudWatch alarm configured.
- [ ] Connection reuse enabled (SDK clients at module level).
- [ ] Handler separated from business logic.
- [ ] Write operations wrapped with Powertools idempotency.
- [ ] Feature flags used for any rollback-sensitive behavior change.
- [ ] Env vars validated at module load time.
