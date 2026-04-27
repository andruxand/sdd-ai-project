````skill
---
name: http-client-retry
description: >
  Implement resilient backend-to-backend HTTP calls and AWS SDK calls with
  exponential backoff, full jitter, retry budgets, idempotency keys, and
  Retry-After header respect. Covers cockatiel (the project's chosen library),
  AWS SDK v3 built-in retry configuration, and frontend (React Query, already
  handled separately). Apply when any Lambda calls an external HTTP API or
  third-party SDK.
---

## Sources

- "Exponential Backoff And Jitter" — AWS Architecture Blog (Marc Brooker, 2015)
  aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter
- cockatiel v3 docs — github.com/connor4312/cockatiel
- AWS SDK v3 middleware-retry — github.com/aws/aws-sdk-js-v3/tree/main/packages/middleware-retry
- RFC 7231 §7.1.3 Retry-After — datatracker.ietf.org/doc/html/rfc7231#section-7.1.3
- AWS Well-Architected — Reliability Pillar (REL08)

> **Note**: `circuit-breaker` skill covers opening/closing the circuit.
> This skill covers **retry policy configuration** — backoff, jitter, budgets,
> idempotency. Both skills should be applied together when calling external services.

---

## 1. When to retry — the decision matrix

**STOP before implementing retry. Retrying non-idempotent operations causes data corruption.**

| Condition | Retry? | Reason |
|---|---|---|
| Network timeout (ECONNRESET, ETIMEDOUT) | ✅ Yes | Transient; safe if operation is idempotent |
| HTTP 429 Too Many Requests | ✅ Yes (after Retry-After delay) | Rate limited; provider expects retry |
| HTTP 502, 503, 504 | ✅ Yes | Upstream transient error |
| HTTP 500 | ⚠ Yes only if idempotent | May have partially processed — verify semantics |
| HTTP 400, 404, 422 | ❌ Never | Client error — retrying won't help |
| HTTP 401, 403 | ❌ Never | Auth failure — retrying wastes quota |
| POST/PUT/PATCH without idempotency key | ⚠ Only if you add an idempotency key | Otherwise causes duplicate writes |
| DELETE | ✅ Yes (idempotent by nature) | Deleting what's already deleted = 404 = success |

---

## 2. Exponential backoff with full jitter (AWS best practice)

From "Exponential Backoff And Jitter" (AWS Architecture Blog):
**Full jitter is optimal** for avoiding thundering herds when multiple clients retry simultaneously.

```
Full jitter:
  delay = random_between(0, min(capacity, base * 2^attempt))
```

All other forms (no jitter, equal jitter, decorrelated jitter) perform worse under
high concurrency because clients synchronize their retries.

**The `cockatiel` library (already in the project stack) implements this correctly:**

```typescript
// services/api/src/infrastructure/adapters/payments/payment-client.ts
import {
  retry,
  handleAll,
  handleResultType,
  ExponentialBackoff,
  circuitBreaker,
  ConsecutiveBreaker,
  timeout,
  TimeoutStrategy,
  wrap,
} from 'cockatiel';

// ─── Module-level singletons — NEVER create inside handler ─────────────────
// Lambda reuses execution environments. Policies must persist across invocations.

const retryPolicy = retry(
  // Retry on any error OR on HTTP responses indicating transient failure
  handleAll.orResultType(
    (result): result is Response => result instanceof Response &&
      (result.status === 429 || result.status >= 500),
  ),
  {
    maxAttempts: 3,
    backoff: new ExponentialBackoff({
      initialDelay: 100,   // 100 ms base
      maxDelay: 5_000,     // cap at 5 s
      exponent: 2,
      // ExponentialBackoff in cockatiel uses full jitter internally
    }),
  },
);

const breakerPolicy = circuitBreaker(handleAll, {
  halfOpenAfter: 10_000,
  breaker: new ConsecutiveBreaker(5),
});

const timeoutPolicy = timeout(8_000, TimeoutStrategy.Aggressive);

// Compose: retry wraps breaker wraps timeout
export const paymentPolicy = wrap(retryPolicy, breakerPolicy, timeoutPolicy);
```

---

## 3. Retry-After header respect (mandatory for 429)

Ignoring `Retry-After` will get your IP/key banned by the upstream API.

```typescript
import { retry, handleAll, ExponentialBackoff } from 'cockatiel';

const retryWith429Respect = retry(handleAll, {
  maxAttempts: 4,
  backoff: {
    duration(attempt, lastError, lastResult) {
      // If the server told us to wait, use that value
      if (lastResult instanceof Response) {
        const retryAfter = lastResult.headers.get('retry-after');
        if (retryAfter) {
          const asSeconds = parseFloat(retryAfter);
          if (!isNaN(asSeconds)) return asSeconds * 1000;
          // Retry-After can also be an HTTP-date
          const asDate = Date.parse(retryAfter);
          if (!isNaN(asDate)) return Math.max(0, asDate - Date.now());
        }
      }
      // Fallback: exponential backoff with full jitter
      const base = 100;
      const cap = 30_000;
      return Math.random() * Math.min(cap, base * Math.pow(2, attempt));
    },
  },
});
```

---

## 4. Idempotency key on retried outbound requests

For non-idempotent upstream calls (POST payments, POST order submission etc.),
**always send an idempotency key**. Store the key with the originating request;
on retry, reuse the same key — the upstream deduplicates.

```typescript
// Generate once per business operation, not per retry attempt
const idempotencyKey = `${operationName}-${businessEntityId}-${Date.now()}`;

// Re-use across retries — wrap the fetch inside the retry policy, not the key generation
const result = await paymentPolicy.execute(async () => {
  const response = await fetch('https://payments.example.com/v1/charges', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,  // ← same key on every retry attempt
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(chargePayload),
  });
  if (!response.ok) throw new ExternalDependencyError(`Charge failed: ${response.status}`);
  return response.json();
});
```

---

## 5. AWS SDK v3 built-in retry configuration

The AWS SDK v3 has retry logic built in. Configure it explicitly — the defaults
are often too aggressive (3 retries with no jitter for DynamoDB in high-throughput
contexts, or too lenient for slow operations).

```typescript
// services/api/src/infrastructure/config/aws-clients.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';

// Standard retry mode: exponential with full jitter
// Adaptive retry mode: additionally measures token bucket to avoid throttling
export const dynamoClient = new DynamoDBClient({
  retryMode: 'adaptive',    // 'standard' | 'adaptive' (recommended for write-heavy DynamoDB)
  maxAttempts: 3,
});

export const sqsClient = new SQSClient({
  retryMode: 'standard',
  maxAttempts: 3,
});

// Initialize clients at module level — reused across warm invocations
// This also applies connection reuse (keep-alive is enabled by default in SDK v3)
```

**`adaptive` vs `standard`:**
- `standard`: exponential backoff with jitter; retries on throttling and transient errors
- `adaptive`: adds a token bucket that slows retry rate when throttling is observed (best for high concurrency write paths)

---

## 6. Total timeout (retry budget)

Without a max-duration budget, a Lambda with retry can wait indefinitely.
**Always set a Lambda timeout shorter than the retry budget + buffer.**

```
Lambda timeout budget example:
  maxAttempts: 3
  base delay: 100 ms, cap: 5000 ms, exponent: 2
  Worst case delays: 100 ms + 1000 ms + 4000 ms = 5100 ms
  Per-attempt timeout: 8000 ms × 3 = 24000 ms
  Total worst case: 5100 ms + 24000 ms = ~29 s

  → Set Lambda timeout to at least 35 s for this function
  → Set API Gateway timeout to 29 s (max is 29 s for REST API)
```

```typescript
// serverless.ts — function config
functions: {
  processPayment: {
    timeout: 35,          // seconds — must exceed total retry budget
    memorySize: 512,
    // ...
  },
},
```

---

## 7. Observability for retry events

Log every retry attempt to understand which upstreams are flaky.

```typescript
import { retry, handleAll, ExponentialBackoff } from 'cockatiel';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: process.env.SERVICE_NAME! });

const retryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({ initialDelay: 100, maxDelay: 5000, exponent: 2 }),
});

retryPolicy.onRetry((data) => {
  logger.warn('Outbound call retry', {
    attempt: data.attempt,
    delayMs: data.delay,
    // Do NOT log request body — may contain PII
    upstream: 'payments-api',        // known at code time, safe to log
    errorMessage: sanitizeError(data.error),  // sanitized
  });
});

retryPolicy.onSuccess(({ duration }) => {
  logger.debug('Outbound call succeeded', { upstream: 'payments-api', durationMs: duration });
});

retryPolicy.onFailure(({ error }) => {
  logger.error('Outbound call failed after all retries', {
    upstream: 'payments-api',
    error: sanitizeError(error),
  });
});
```

---

## 8. Frontend: React Query (reference)

Frontend retry is **already handled** by React Query. The `react-query-patterns`
skill documents the configuration. Key points:

- Queries: `retry: (count, error) => error.status >= 500 && count < 2` (no 4xx retries)
- Mutations: `retry: 0` (never auto-retry mutations — they are often not idempotent)
- These defaults are set in `QueryClient` in `apps/web/src/app/providers.tsx`

Do NOT add custom retry logic on top of React Query — it already handles it.

---

## Anti-patterns

| Anti-pattern | Consequence |
|---|---|
| Infinite retry (no maxAttempts) | Lambda timeout, cost explosion |
| No jitter (pure exponential: `100, 200, 400, 800`) | Thundering herd — all clients retry at the same time |
| Retrying 4xx errors | Wastes quota; 400/422 will never succeed |
| Creating policy objects inside the handler | Circuit state resets every invocation; no memory of past failures |
| Not respecting `Retry-After` on 429 | IP/API key ban from upstream |
| Generating new idempotency key per retry | Upstream receives as separate operations — duplicate writes |
| Retry without timeout per attempt | One slow upstream call blocks all retries for minutes |
| Logging full request on retry | PII/token exposure in CloudWatch |

---

## Checklist

```
For every outbound HTTP or SDK call:
- [ ] Retry policy defined for the specific upstream (not a global catch-all).
- [ ] Full jitter used (ExponentialBackoff in cockatiel, or adaptive mode in AWS SDK).
- [ ] Retry-After header respected for 429 responses.
- [ ] 4xx errors excluded from retry (except 429).
- [ ] Idempotency key generated before retry loop; reused on all attempts.
- [ ] Circuit breaker applied alongside retry policy (see circuit-breaker skill).
- [ ] Per-attempt timeout set; Lambda timeout ≥ total retry budget + buffer.
- [ ] Retry events logged at WARN level (no PII in log).
- [ ] AWS SDK clients created at module level with retryMode and maxAttempts set.
```
````
