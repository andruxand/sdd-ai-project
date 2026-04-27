# Skill: circuit-breaker

Apply this skill whenever implementing fault-tolerance for outbound HTTP calls, third-party SDK calls, or any external dependency call in a Lambda handler.

**Source**: cockatiel v3.2.1 official docs (https://github.com/connor4312/cockatiel) + AWS Lambda best practices.

---

## When to use

- Any Lambda handler that calls an external HTTP service, RDS, or third-party SDK.
- Any DynamoDB call that is not idempotency-safe to retry indefinitely.
- Whenever `aws-architecture.md` mentions "circuit breaker" or "fault isolation".

---

## Key rule: module-level singleton

**Critical for Lambda**: Create policy objects **outside the handler**, at module scope. Lambda reuses execution environments across invocations. A breaker created inside the handler resets on every request — defeating the purpose entirely.

```typescript
// ✅ CORRECT — module-level singleton
import { circuitBreaker, handleAll, retry, timeout, wrap, ConsecutiveBreaker, ExponentialBackoff, TimeoutStrategy, BrokenCircuitError } from 'cockatiel';

const retryPolicy = retry(handleAll, { maxAttempts: 3, backoff: new ExponentialBackoff() });

const breakerPolicy = circuitBreaker(handleAll, {
  halfOpenAfter: 10 * 1000, // 10 s before attempting recovery
  breaker: new ConsecutiveBreaker(5), // open after 5 consecutive failures
});

const timeoutPolicy = timeout(3000, TimeoutStrategy.Aggressive);

// Policies compose left-to-right: retry wraps breaker; breaker wraps timeout
const policy = wrap(retryPolicy, breakerPolicy, timeoutPolicy);

// ❌ WRONG — defined inside the handler
export const handler = async () => {
  const breakerInside = circuitBreaker(handleAll, { ... }); // resets every invocation
};
```

---

## Breaker types

| Type                                     | Best for                             | Config                                              |
| ---------------------------------------- | ------------------------------------ | --------------------------------------------------- |
| `ConsecutiveBreaker(n)`                  | Lambda (low throughput, predictable) | Opens after N consecutive failures                  |
| `SamplingBreaker({threshold, duration})` | High-traffic services                | Opens when failure % > threshold over duration ms   |
| `CountBreaker({threshold, size})`        | Sliding window                       | Opens when failure % > threshold in last N requests |

```typescript
// SamplingBreaker: open if >20% of requests fail in a 30-second window
const samplingBreaker = circuitBreaker(handleAll, {
  halfOpenAfter: 10 * 1000,
  breaker: new SamplingBreaker({ threshold: 0.2, duration: 30 * 1000 }),
});

// CountBreaker: open if >20% fail in last 100 requests
const countBreaker = circuitBreaker(handleAll, {
  halfOpenAfter: 10 * 1000,
  breaker: new CountBreaker({ threshold: 0.2, size: 100 }),
});
```

---

## Lambda state persistence across invocations

The breaker's internal state (counts, open/closed) lives in memory. Between invocations of the **same** warm container it persists automatically. To carry state across cold starts (or pass to another instance), serialize and restore:

```typescript
import { createCockatielState } from 'cockatiel';
import { SSM } from '@aws-sdk/client-ssm';

// Restore state on cold start (optional, for critical services)
export async function restoreCircuitState(
  policy: ReturnType<typeof circuitBreaker>,
) {
  const ssm = new SSM({});
  try {
    const { Parameter } = await ssm.getParameter({
      Name: '/circuit-state/payments',
    });
    if (Parameter?.Value) {
      policy.breaker.fromJSON(JSON.parse(Parameter.Value));
    }
  } catch {
    // No stored state — start fresh
  }
}

// Persist state before container is frozen (use Lambda extensions or periodic flush)
export async function persistCircuitState(
  policy: ReturnType<typeof circuitBreaker>,
) {
  const ssm = new SSM({});
  await ssm.putParameter({
    Name: '/circuit-state/payments',
    Value: JSON.stringify(policy.breaker.toJSON()),
    Type: 'String',
    Overwrite: true,
  });
}
```

> For most Lambda use cases, warm-container persistence (no SSM) is sufficient. Use SSM persistence only when the upstream is critically unreliable.

---

## Handler integration

```typescript
import { BrokenCircuitError, TaskCancelledError } from 'cockatiel';
import { Logger } from '@aws-lambda-powertools/logger';
import { policy, breakerPolicy } from '../policies/external-api.policy';

const logger = new Logger({ serviceName: 'payments' });

// Log circuit state changes
breakerPolicy.onBreak(() =>
  logger.warn('Circuit breaker opened', {
    circuit: 'external-api',
    state: breakerPolicy.breaker.toJSON(),
  }),
);
breakerPolicy.onReset(() =>
  logger.info('Circuit breaker closed/reset', { circuit: 'external-api' }),
);

export const callExternalApi = async (payload: unknown) => {
  try {
    return await policy.execute(() =>
      externalApiClient.post('/process', payload),
    );
  } catch (err) {
    if (err instanceof BrokenCircuitError) {
      logger.warn('Circuit open — rejecting request fast', {
        circuit: 'external-api',
      });
      throw new ServiceUnavailableError(
        'external-api is temporarily unavailable',
      );
    }
    if (err instanceof TaskCancelledError) {
      logger.warn('Request timed out', { circuit: 'external-api' });
      throw new GatewayTimeoutError('external-api timed out');
    }
    throw err;
  }
};
```

---

## HTTP response mapping

```typescript
// In handler error mapper
if (err instanceof ServiceUnavailableError)
  return {
    statusCode: 503,
    body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }),
  };
if (err instanceof GatewayTimeoutError)
  return { statusCode: 504, body: JSON.stringify({ code: 'GATEWAY_TIMEOUT' }) };
```

---

## Policy file organisation

```
services/api/src/policies/
  external-api.policy.ts   ← singleton policies for the external-api client
  stripe.policy.ts         ← singleton policies for Stripe SDK
```

Each file exports exactly one `policy` (the composed `wrap(...)`) and the individual sub-policies if callers need to attach event listeners.

---

## Anti-patterns

| Anti-pattern                                          | Why it breaks                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `new circuitBreaker(...)` inside the handler function | Resets on every request; breaker never accumulates failures         |
| Wrapping retries **outside** the circuit breaker      | Retries will keep hammering a broken downstream                     |
| Catching `BrokenCircuitError` silently                | Hides circuit state; callers must receive `503`                     |
| Using `ConsecutiveBreaker(1)`                         | Too sensitive; transient 1-failure network hiccups open the circuit |
| No `halfOpenAfter` value                              | Circuit stays open forever after an outage                          |

---

## Checklist

- [ ] Policies defined at module scope (not inside handler).
- [ ] `wrap(retry, breaker, timeout)` composition — never `wrap(breaker, retry, ...)`.
- [ ] `BrokenCircuitError` caught and mapped to `503`.
- [ ] `TaskCancelledError` caught and mapped to `504`.
- [ ] `onBreak` / `onReset` logged with structured logger (sanitized — no PII).
- [ ] Policy file placed in `services/api/src/policies/`.
- [ ] Unit test: assert `BrokenCircuitError` is thrown after N consecutive failures.
