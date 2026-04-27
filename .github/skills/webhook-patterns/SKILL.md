````skill
---
name: webhook-patterns
description: >
  Implement secure, reliable webhook receivers on AWS Lambda. Covers HMAC-SHA256
  signature verification, replay attack prevention, idempotent event processing via
  SQS, immediate 200 acknowledge pattern, provider-specific header handling (Stripe,
  GitHub, Slack), and testing strategies.
---

## Sources

- Stripe Webhook Best Practices — stripe.com/docs/webhooks/best-practices
- GitHub Securing Webhooks — docs.github.com/en/webhooks/using-webhooks/securing-your-webhooks
- Slack Verifying Requests — api.slack.com/authentication/verifying-requests-from-slack
- OWASP REST Security Cheat Sheet
- AWS Serverless Patterns — serverlessland.com

---

## The golden rule: acknowledge immediately, process asynchronously

**A webhook handler MUST respond within the provider's timeout window (usually 3–30 s).**
If the handler performs database writes, downstream calls, or any non-trivial logic,
it WILL eventually time out under load.

```
Provider → Lambda (APIGw)
    1. Verify signature          ← synchronous, <1 ms
    2. Validate payload shape    ← Zod, <1 ms
    3. Enqueue to SQS            ← <5 ms p99
    4. Return HTTP 200 {}        ← provider marks delivery successful

SQS → Lambda (worker)
    5. Idempotency check         ← DynamoDB lookup
    6. Business logic            ← use case
    7. Mark event processed      ← DynamoDB write
```

**Never** perform business logic in the webhook receiver Lambda.
**Never** return a non-2xx just because business logic failed — the provider will
retry and you will receive duplicates. Handle failures in the SQS worker.

---

## 1. Signature verification (HMAC-SHA256)

Every reputable webhook provider signs payloads. **Verification is mandatory.**
An unverified webhook endpoint is an unauthenticated public write interface.

### Generic HMAC-SHA256 pattern

```typescript
// services/api/src/infrastructure/http/webhooks/verify-signature.ts
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify HMAC-SHA256 webhook signature.
 * Uses timingSafeEqual to prevent timing attacks.
 *
 * @param rawBody   The raw request body as a Buffer (MUST be raw bytes, not parsed JSON)
 * @param secret    The signing secret from Secrets Manager
 * @param received  The signature sent by the provider (hex or base64 depending on provider)
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  secret: string,
  received: string,
): void {
  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const receivedBuf = Buffer.from(received, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  // Constant-time comparison — prevents timing-based signature oracle
  if (
    receivedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    throw new AuthenticationError('Invalid webhook signature', 'WEBHOOK_SIGNATURE_INVALID');
  }
}
```

> **Critical**: use `timingSafeEqual` — NOT `===` or `.toString() === ...`.
> String comparison short-circuits on the first mismatched byte, leaking timing
> information that allows an attacker to forge signatures byte-by-byte.

### Stripe-specific pattern

Stripe signs as `t=<timestamp>,v1=<sig>` in header `Stripe-Signature`.
The signed payload is `timestamp.rawBody`.

```typescript
// services/api/src/infrastructure/http/webhooks/stripe.ts
import { createHmac, timingSafeEqual } from 'crypto';
import { AuthenticationError } from '@/domain/errors';

const TOLERANCE_SECONDS = 300; // 5-minute window for replay protection

export function verifyStripeSignature(
  rawBody: Buffer,
  stripeSignatureHeader: string,
  webhookSecret: string,
): void {
  const parts = Object.fromEntries(
    stripeSignatureHeader.split(',').map((p) => p.split('=')),
  );
  const timestamp = parseInt(parts['t'] ?? '0', 10);
  const v1Signature = parts['v1'] ?? '';

  // Replay attack prevention
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) {
    throw new AuthenticationError('Webhook timestamp too old', 'WEBHOOK_TIMESTAMP_STALE');
  }

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  const receivedBuf = Buffer.from(v1Signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  if (
    receivedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    throw new AuthenticationError('Invalid Stripe webhook signature', 'STRIPE_SIGNATURE_INVALID');
  }
}
```

### GitHub-specific pattern

GitHub sends signature in header `X-Hub-Signature-256: sha256=<hex>`.

```typescript
export function verifyGitHubSignature(
  rawBody: Buffer,
  hubSignatureHeader: string, // "sha256=abc123..."
  webhookSecret: string,
): void {
  const [algorithm, received] = hubSignatureHeader.split('=');
  if (algorithm !== 'sha256' || !received) {
    throw new AuthenticationError('Invalid X-Hub-Signature-256 format', 'GITHUB_SIG_FORMAT');
  }
  const expected = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const receivedBuf = Buffer.from(received, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (
    receivedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    throw new AuthenticationError('Invalid GitHub webhook signature', 'GITHUB_SIG_INVALID');
  }
}
```

---

## 2. Replay attack prevention (timestamp validation)

Webhook providers embed a timestamp in the signature to prevent replays.
Without this check, an attacker who captures a legitimate webhook can replay it
indefinitely.

**Rule**: reject events with a timestamp older than **5 minutes** (300 seconds).
This is the Stripe standard and is widely adopted.

```typescript
const REPLAY_TOLERANCE_S = 300;
const eventTimestamp = parseInt(timestampHeader, 10); // unix seconds
const ageSeconds = Math.floor(Date.now() / 1000) - eventTimestamp;
if (ageSeconds > REPLAY_TOLERANCE_S || ageSeconds < -30) {
  throw new AuthenticationError('Stale or future webhook timestamp', 'WEBHOOK_TIMESTAMP_INVALID');
}
```

---

## 3. Idempotent processing via event ID

Webhook providers retry on non-2xx responses or network failures. The worker
MUST be idempotent: processing the same event twice must produce the same result.

Use the provider's event ID (e.g., Stripe `evt_...`, GitHub `X-GitHub-Delivery`,
Slack `event_id`) as the idempotency key stored in the Powertools idempotency
table.

```typescript
// In the SQS worker handler — not the receiver
import { makeHandlerIdempotent, IdempotencyConfig } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';

const store = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME!,
});

const idempotencyConfig = new IdempotencyConfig({
  eventKeyJmesPath: 'body.id',      // Stripe uses evt_xxx; GitHub uses delivery header
  expiresAfterSeconds: 86400,        // 24 hours — keep longer than provider retry window
  useLocalCache: true,
});

export const handler = middy(
  makeHandlerIdempotent(processWebhookEvent, { persistenceStore: store, config: idempotencyConfig }),
);
```

---

## 4. Full serverless.ts configuration

```typescript
// services/api/serverless.ts (webhook receiver function)
functions: {
  webhookReceiver: {
    handler: 'src/infrastructure/http/webhooks/receiver.handler',
    timeout: 10,              // Keep low — we just enqueue to SQS
    memorySize: 256,
    events: [
      {
        http: {
          path: 'webhooks/{provider}',
          method: 'post',
          // No Cognito authorizer — webhook providers cannot obtain Cognito tokens
          // Security is provided by HMAC signature verification in the handler
          authorizer: undefined,
        },
      },
    ],
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: ['sqs:SendMessage'],
        Resource: { 'Fn::GetAtt': ['WebhookQueue', 'Arn'] },
      },
      {
        Effect: 'Allow',
        Action: ['ssm:GetParameter'],
        Resource: `arn:aws:ssm:\${aws:region}:\${aws:accountId}:parameter/webhooks/*`,
      },
    ],
    environment: {
      WEBHOOK_QUEUE_URL: { Ref: 'WebhookQueue' },
    },
  },

  webhookWorker: {
    handler: 'src/infrastructure/workers/webhook.handler',
    timeout: 60,              // Worker can take longer
    memorySize: 512,
    events: [
      {
        sqs: {
          arn: { 'Fn::GetAtt': ['WebhookQueue', 'Arn'] },
          batchSize: 10,
          functionResponseType: 'ReportBatchItemFailures',  // Mandatory
        },
      },
    ],
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        Resource: { 'Fn::GetAtt': ['IdempotencyTable', 'Arn'] },
      },
    ],
  },
},

resources: {
  Resources: {
    WebhookQueue: {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: '${self:service}-${sls:stage}-webhooks',
        VisibilityTimeout: 120,     // > Lambda timeout × 6 rule
        MessageRetentionPeriod: 86400,
        RedrivePolicy: {
          deadLetterTargetArn: { 'Fn::GetAtt': ['WebhookDLQ', 'Arn'] },
          maxReceiveCount: 3,       // Retry 3 times before DLQ
        },
      },
    },
    WebhookDLQ: {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: '${self:service}-${sls:stage}-webhooks-dlq',
        MessageRetentionPeriod: 1209600, // 14 days
      },
    },
  },
},
```

---

## 5. Raw body preservation (critical)

API Gateway parses the body by default. **Signature verification requires the raw bytes.**
Use `middy/http-json-body-parser` AFTER signature verification, or rely on
`event.body` as a raw string with `isBase64Encoded` awareness.

```typescript
// receiver.handler.ts
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  // event.body is a string (not parsed) for webhook endpoints
  // isBase64Encoded: true when Content-Encoding: gzip or binary payloads
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64')
    : Buffer.from(event.body ?? '', 'utf8');

  const secret = await getWebhookSecret(event.pathParameters?.provider ?? '');
  const signature = event.headers['stripe-signature'] // or x-hub-signature-256
    ?? event.headers['x-hub-signature-256']
    ?? '';

  verifySignature(rawBody, secret, signature);

  // Parse AFTER verification
  const payload = WebhookPayloadSchema.parse(JSON.parse(rawBody.toString('utf8')));

  await sqsClient.send(new SendMessageCommand({
    QueueUrl: process.env.WEBHOOK_QUEUE_URL!,
    MessageBody: JSON.stringify(payload),
    MessageDeduplicationId: payload.id,   // For FIFO queues
    MessageGroupId: payload.type,          // For FIFO queues
  }));

  return { statusCode: 200, body: JSON.stringify({}) };
};
```

---

## 6. Secrets management for webhook secrets

Store webhook signing secrets in AWS Secrets Manager (not SSM — they are
rotatable and sensitive). Fetch with caching at Lambda container level.

```typescript
// services/api/src/infrastructure/config/webhook-secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});
const cache = new Map<string, { value: string; exp: number }>();
const TTL = 300_000; // 5 min

export async function getWebhookSecret(provider: string): Promise<string> {
  const key = `/webhooks/${process.env.SLS_STAGE}/${provider}/signing-secret`;
  const cached = cache.get(key);
  if (cached && Date.now() < cached.exp) return cached.value;

  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: key }),
  );
  if (!SecretString) throw new Error(`Secret not found: ${key}`);
  cache.set(key, { value: SecretString, exp: Date.now() + TTL });
  return SecretString;
}
```

---

## 7. Testing webhooks

### Unit test: signature verification

```typescript
// src/infrastructure/http/webhooks/__tests__/verify-signature.test.ts
import { createHmac } from 'crypto';
import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from '../verify-signature';
import { AuthenticationError } from '@/domain/errors';

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret';
  const body = Buffer.from(JSON.stringify({ type: 'order.created', id: 'evt_123' }));

  it('passes with a valid signature', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(() => verifyWebhookSignature(body, secret, sig)).not.toThrow();
  });

  it('throws AuthenticationError with an invalid signature', () => {
    expect(() => verifyWebhookSignature(body, secret, 'deadbeef')).toThrow(
      AuthenticationError,
    );
  });

  it('throws AuthenticationError with a tampered body', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    const tampered = Buffer.from('tampered');
    expect(() => verifyWebhookSignature(tampered, secret, sig)).toThrow(
      AuthenticationError,
    );
  });
});
```

### Integration test: receiver handler

Use `aws-sdk-client-mock` for SQS and inject a valid pre-computed signature.
Test that:
- Valid signature + valid body → 200 + SQS message sent
- Invalid signature → 401, SQS NOT called
- Missing signature header → 401, SQS NOT called
- Stale timestamp → 401, SQS NOT called
- Valid signature but invalid body shape → 400, SQS NOT called

---

## Anti-patterns

| Anti-pattern | Why it's wrong |
|---|---|
| Using `===` to compare signatures | Timing attack — allows signature forgery |
| Performing business logic in the receiver | Will time out under load; provider retries; duplicates |
| Trusting the event type from the payload without re-fetching | Provider spoofing — always verify signature first |
| Storing shared secrets in environment variables | Not rotatable; visible in CloudFormation console; use Secrets Manager |
| Returning 5xx on business logic failure | Triggers provider retries; creates infinite retry loops |
| No timestamp validation | Replay attacks: valid captured webhooks can be replayed indefinitely |
| Logging raw webhook payload | May contain PII or sensitive data; log only safe fields |

---

## Implementation checklist

```
Receiver Lambda
- [ ] HMAC-SHA256 signature verified before any other logic.
- [ ] timingSafeEqual used (not ===).
- [ ] Timestamp validated (±5 min window).
- [ ] Raw body passed to HMAC (not parsed JSON).
- [ ] Response: always 200 {} on successful verification.
- [ ] Business logic delegated to SQS worker, not in receiver.
- [ ] Signing secret fetched from Secrets Manager (not env var).

SQS Worker Lambda
- [ ] Idempotency: event ID used as idempotency key (Powertools idempotency).
- [ ] ReportBatchItemFailures enabled.
- [ ] DLQ configured (maxReceiveCount: 3).
- [ ] DLQ has an alarm.
- [ ] Business errors do NOT throw — they are handled and the message is acked.

Logging
- [ ] No raw webhook body in logs.
- [ ] Event ID and type logged for traceability.
- [ ] Signature verification failures logged as WARN with provider name (not the received signature).
```
````
