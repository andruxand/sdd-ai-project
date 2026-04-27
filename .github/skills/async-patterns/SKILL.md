````skill
---
name: async-patterns
description: Design and implement async event-driven patterns with SQS, SNS, EventBridge, and Step Functions on AWS serverless.
---

## When to use async

| Pattern | Use when |
|---|---|
| **SQS Standard** | Workloads that tolerate duplicate delivery and unordered processing. Decoupling producer from consumer. |
| **SQS FIFO** | Strict ordering required. Exactly-once processing within a message group. |
| **SNS fanout** | One event must be delivered to multiple consumers simultaneously. |
| **EventBridge** | Service-to-service integration, scheduled tasks, routing events across accounts. |
| **Step Functions** | Multi-step workflows with branching, retries, parallel execution, or human approval. |
| **Lambda → Lambda (sync)** | Only for very tight coupling where the caller needs the response immediately. |

Do NOT invoke Lambda→Lambda asynchronously via `InvokeAsync` — use SQS to get retries, DLQ, and observability.

## SQS Standard — trigger and handler

The SQS+DLQ pattern with `ReportBatchItemFailures` is the default choice for async Lambda processing. See `docs/standards/aws-architecture.md` for the complete CloudFormation template.

### Partial batch failure handling (mandatory)

Always use `functionResponseType: 'ReportBatchItemFailures'`. Without it, a single failed message fails the entire batch.

```typescript
// services/api/src/handlers/orders/process.handler.ts
import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import middy from '@middy/core';

const logger = new Logger({ serviceName: process.env.SERVICE_NAME! });
const tracer = new Tracer({ serviceName: process.env.SERVICE_NAME! });
const metrics = new Metrics({ namespace: process.env.METRICS_NAMESPACE!, serviceName: process.env.SERVICE_NAME! });

const processOrderBatch = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      logger.info('Processing order', { correlationId: body.correlationId, orderId: body.orderId });

      await processOrder(body); // delegate to use case

      metrics.addMetric('OrdersProcessed', MetricUnit.Count, 1);
    } catch (error) {
      logger.error('Failed to process order', { messageId: record.messageId, error });
      metrics.addMetric('OrderProcessingErrors', MetricUnit.Count, 1);
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
};

export const handler = middy(processOrderBatch)
  .use(tracer.captureLambdaHandler())
  .use(logger.injectLambdaContext())
  .use(metrics.logMetrics());
````

### Visibility timeout rule

**Visibility timeout MUST be at least 6× the Lambda function timeout.**

If your Lambda timeout is 30s, set visibility timeout to 180s minimum. Otherwise, the queue makes the message visible again before Lambda finishes processing, causing duplicate delivery.

```typescript
// serverless.ts
OrderQueue: {
  Type: 'AWS::SQS::Queue',
  Properties: {
    VisibilityTimeout: 180,  // 6× the Lambda timeout (e.g., 30s timeout → 180s)
    RedrivePolicy: {
      deadLetterTargetArn: { 'Fn::GetAtt': ['OrderQueueDLQ', 'Arn'] },
      maxReceiveCount: 3,
    },
  },
},
```

### DLQ alert — mandatory

Every DLQ MUST have a CloudWatch alarm. A message in the DLQ means potential data loss or processing failure.

```typescript
OrderQueueDLQAlarm: {
  Type: 'AWS::CloudWatch::Alarm',
  Properties: {
    AlarmName: '${self:service}-${opt:stage}-orders-dlq-not-empty',
    AlarmDescription: 'Messages in OrderQueue DLQ — potential data loss',
    MetricName: 'ApproximateNumberOfMessagesVisible',
    Namespace: 'AWS/SQS',
    Dimensions: [{ Name: 'QueueName', Value: { 'Fn::GetAtt': ['OrderQueueDLQ', 'QueueName'] } }],
    Statistic: 'Sum',
    Period: 60,
    EvaluationPeriods: 1,
    Threshold: 0,
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
  },
},
```

## SQS FIFO — when ordering matters

Use FIFO when messages in the same group must be processed in order and exactly once.

```typescript
// serverless.ts — FIFO queue
PaymentQueue: {
  Type: 'AWS::SQS::Queue',
  Properties: {
    QueueName: '${self:service}-${opt:stage}-payments.fifo',  // .fifo suffix mandatory
    FifoQueue: true,
    ContentBasedDeduplication: false,  // explicit deduplication ID is safer
    DeduplicationScope: 'messageGroup',  // dedup per group (more efficient than queue-level)
    FifoThroughputLimit: 'perMessageGroupId',  // allows multiple groups in parallel
    RedrivePolicy: {
      deadLetterTargetArn: { 'Fn::GetAtt': ['PaymentQueueDLQ', 'Arn'] },
      maxReceiveCount: 3,
    },
  },
},
PaymentQueueDLQ: {
  Type: 'AWS::SQS::Queue',
  Properties: {
    QueueName: '${self:service}-${opt:stage}-payments-dlq.fifo',  // DLQ must also be FIFO
    FifoQueue: true,
    ContentBasedDeduplication: false,
    MessageRetentionPeriod: 1209600,
  },
},
```

FIFO sender must include `MessageGroupId` and `MessageDeduplicationId`:

```typescript
await sqs.send(
  new SendMessageCommand({
    QueueUrl: process.env.PAYMENT_QUEUE_URL!,
    MessageBody: JSON.stringify(payload),
    MessageGroupId: `order-${orderId}`, // all messages for this order are ordered
    MessageDeduplicationId: `${orderId}-${action}-${Date.now()}`, // prevent exact duplicates
  }),
);
```

## SNS fanout

Use SNS when one event must reach multiple consumers simultaneously (audit log + processor + notification).

```typescript
// serverless.ts
OrderEventsTopic: {
  Type: 'AWS::SNS::Topic',
  Properties: {
    TopicName: '${self:service}-${opt:stage}-order-events',
  },
},

// Subscription from processor queue
OrderProcessorSubscription: {
  Type: 'AWS::SNS::Subscription',
  Properties: {
    Protocol: 'sqs',
    TopicArn: { Ref: 'OrderEventsTopic' },
    Endpoint: { 'Fn::GetAtt': ['OrderQueue', 'Arn'] },
    FilterPolicy: {                          // only send ORDER_PLACED events to this queue
      eventType: ['ORDER_PLACED'],
    },
    RawMessageDelivery: true,                // skip SNS envelope — SQS gets the raw body
  },
},

// SQS policy to allow SNS to write
OrderQueuePolicy: {
  Type: 'AWS::SQS::QueuePolicy',
  Properties: {
    Queues: [{ Ref: 'OrderQueue' }],
    PolicyDocument: {
      Statement: [{
        Effect: 'Allow',
        Principal: { Service: 'sns.amazonaws.com' },
        Action: 'sqs:SendMessage',
        Resource: { 'Fn::GetAtt': ['OrderQueue', 'Arn'] },
        Condition: { ArnEquals: { 'aws:SourceArn': { Ref: 'OrderEventsTopic' } } },
      }],
    },
  },
},
```

### SNS message filtering

Use `FilterPolicy` to route events to the right queue. Without filtering, every subscriber gets every message.

```typescript
// Audit log subscription — receives all events
AuditSubscription: {
  FilterPolicy: {},  // no filter = all messages

// Notification subscription — only FAILED events
NotificationSubscription: {
  FilterPolicy: { eventType: ['ORDER_FAILED', 'PAYMENT_FAILED'] },
```

## EventBridge — service integration and schedules

### Custom bus (recommended for domain events)

```typescript
// serverless.ts
OrderEventBus: {
  Type: 'AWS::Events::EventBus',
  Properties: {
    Name: '${self:service}-${opt:stage}-events',
  },
},

// Rule: route order events to processor Lambda
OrderCreatedRule: {
  Type: 'AWS::Events::Rule',
  Properties: {
    EventBusName: { Ref: 'OrderEventBus' },
    EventPattern: {
      source: ['order-service'],
      'detail-type': ['OrderCreated'],
    },
    Targets: [{
      Id: 'OrderProcessorTarget',
      Arn: { 'Fn::GetAtt': ['OrderProcessorLambdaFunction', 'Arn'] },
    }],
  },
},
```

Publishing an event:

```typescript
await eventbridge.send(
  new PutEventsCommand({
    Entries: [
      {
        EventBusName: process.env.EVENT_BUS_NAME!,
        Source: 'order-service',
        DetailType: 'OrderCreated',
        Detail: JSON.stringify({
          orderId,
          userId: hashedUserId, // never PII — use anonymized identifiers
          amount,
          currency,
          correlationId,
        }),
      },
    ],
  }),
);
```

### Scheduled tasks

```typescript
// serverless.ts — scheduled Lambda
dailyReport: {
  handler: 'src/handlers/reports/daily.handler',
  events: [
    {
      schedule: {
        rate: 'cron(0 8 * * ? *)',   // 8:00 UTC daily
        enabled: true,
        input: { action: 'generate-daily-report' },
      },
    },
  ],
},
```

- Use cron expressions for specific times; rate expressions (`rate(5 minutes)`) for intervals.
- Always pass input via `input` to avoid hardcoding in the handler.
- Add a CloudWatch alarm on invocation errors for scheduled functions.

## Step Functions — multi-step orchestration

Use Step Functions when your workflow has branching, parallel execution, waits, or human approval steps.

Do NOT chain Lambda→Lambda→Lambda in code. Use Step Functions for:

- Payment processing: authorize → capture → send receipt (sequential with compensation)
- Onboarding: create account → send email → provision resources → notify CRM (parallel steps)
- Approval workflow: submit → wait for human → approve/reject → notify

```typescript
// serverless.ts — Express Workflow (sync, max 5 min)
plugins: ['serverless-step-functions'],

stepFunctions: {
  stateMachines: {
    orderFulfillment: {
      type: 'EXPRESS',
      name: '${self:service}-${opt:stage}-order-fulfillment',
      definition: {
        Comment: 'Order fulfillment workflow',
        StartAt: 'ValidateOrder',
        States: {
          ValidateOrder: {
            Type: 'Task',
            Resource: { 'Fn::GetAtt': ['ValidateOrderLambdaFunction', 'Arn'] },
            Next: 'ChargePayment',
            Retry: [{ ErrorEquals: ['Lambda.ServiceException'], IntervalSeconds: 2, MaxAttempts: 3 }],
            Catch: [{ ErrorEquals: ['ValidationError'], Next: 'OrderFailed' }],
          },
          ChargePayment: {
            Type: 'Task',
            Resource: { 'Fn::GetAtt': ['ChargePaymentLambdaFunction', 'Arn'] },
            Next: 'FulfillOrder',
          },
          FulfillOrder: {
            Type: 'Task',
            Resource: { 'Fn::GetAtt': ['FulfillOrderLambdaFunction', 'Arn'] },
            End: true,
          },
          OrderFailed: {
            Type: 'Fail',
            Error: 'OrderFailed',
          },
        },
      },
    },
  },
},
```

### Express vs Standard workflows

|                     | Express                     | Standard                           |
| ------------------- | --------------------------- | ---------------------------------- |
| Max duration        | 5 minutes                   | 1 year                             |
| Execution semantics | At-least-once               | Exactly-once                       |
| Price               | Per execution-ms            | Per state transition               |
| Use for             | High-volume short workflows | Long-running or approval workflows |

## Correlation ID propagation through async chains

Correlation IDs MUST be propagated through all async messages:

```typescript
// Publishing to SQS — include correlationId in message
await sqs.send(
  new SendMessageCommand({
    QueueUrl: process.env.QUEUE_URL!,
    MessageBody: JSON.stringify({ ...payload, correlationId }),
    MessageAttributes: {
      correlationId: { DataType: 'String', StringValue: correlationId },
    },
  }),
);

// Consuming from SQS — extract and inject into logger
const correlationId =
  (record.messageAttributes?.correlationId?.stringValue ?? record.body)
    ? JSON.parse(record.body).correlationId
    : uuidv4(); // fallback only — should always be present

logger.appendKeys({ correlationId });
```

## Checklist

- [ ] Async pattern chosen based on ordering and delivery requirements (SQS/FIFO/SNS/EventBridge/Step Functions).
- [ ] SQS trigger uses `functionResponseType: 'ReportBatchItemFailures'`.
- [ ] Visibility timeout ≥ 6× Lambda function timeout.
- [ ] DLQ configured on every SQS queue.
- [ ] CloudWatch alarm on DLQ depth > 0.
- [ ] SNS FilterPolicy defined to avoid all-subscribers receiving all messages.
- [ ] SNS→SQS: `RawMessageDelivery: true` set.
- [ ] EventBridge events use custom bus (not default bus for domain events).
- [ ] No PII in SQS/SNS/EventBridge message bodies — use anonymized IDs.
- [ ] Correlation ID propagated in message body and message attributes.
- [ ] Step Functions: Retry and Catch defined for each Task state.
- [ ] Scheduled functions have CloudWatch alarm on invocation errors.
- [ ] IAM scoped per producer/consumer function (sqs:SendMessage, sqs:ReceiveMessage separately).

## Anti-patterns

- Do NOT invoke Lambda→Lambda asynchronously via `InvokeAsync` — use SQS.
- Do NOT skip DLQ — silent message loss is invisible in CloudWatch unless you look for it.
- Do NOT set visibility timeout less than Lambda timeout.
- Do NOT use default EventBridge bus for domain events — it shares space with AWS service events.
- Do NOT put PII in event bus messages, SQS bodies, or Step Functions input/output.
- Do NOT chain more than 3 synchronous Lambda calls — orchestrate with Step Functions.
- Do NOT forget `MessageGroupId` on FIFO queues — all messages go to group `default` and lose parallelism.

```

```
