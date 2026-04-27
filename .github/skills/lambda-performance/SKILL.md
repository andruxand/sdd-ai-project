````skill
---
name: lambda-performance
description: Optimize AWS Lambda cold start time, memory, timeout, and runtime performance for serverless workloads.
---

## Cold start anatomy

A cold start has two phases:
1. **Init phase** — AWS provisions the execution environment, downloads the ZIP,
   mounts the file system, and initializes the Node.js runtime.
2. **Handler init** — your module-level code runs (imports, SDK client construction,
   env var validation, DB connection pools).

Only phase 2 is within your control. Phase 1 is reduced by keeping the
deployment package small.

**Rule**: optimize for frequent deployments by keeping bundles small (<5MB) and
module-level init fast.

## Bundle size — esbuild configuration (serverless.ts)

Serverless Framework v4 uses esbuild by default. Tune it:

```typescript
// serverless.ts
build: {
  esbuild: {
    bundle: true,
    minify: true,
    sourcemap: process.env.SLS_STAGE !== 'prod', // source maps in non-prod only
    target: 'node22',
    platform: 'node',
    exclude: [
      '@aws-sdk/*',    // AWS SDK v3 is available in the Lambda runtime — do NOT bundle it
    ],
    external: [
      '@aws-sdk/*',
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.SLS_STAGE === 'prod' ? 'production' : 'development'),
    },
  },
},
````

**Never bundle `@aws-sdk`** — it is available in the Lambda runtime and adds
~15MB uncompressed to your package size.

Check bundle size before deploying:

```bash
npx esbuild src/handlers/orders/get.handler.ts --bundle --platform=node \
  --target=node22 --external:@aws-sdk --metafile=meta.json --outfile=out.js
npx esbuild --analyze < meta.json
```

## Memory and timeout defaults

| Workload type                            | Memory       | Timeout                                    |
| ---------------------------------------- | ------------ | ------------------------------------------ |
| Lightweight (CRUD, read)                 | 512 MB       | 10s                                        |
| Medium (transforms, business logic)      | 1024 MB      | 29s                                        |
| Heavy (image processing, large payloads) | 2048–3008 MB | 60–300s                                    |
| SQS consumer                             | 512–1024 MB  | 60s (≥ 6× visibility timeout ÷ batch size) |

**Rule**: always set timeout < API Gateway timeout (30s for HTTP API). A Lambda
that times out after API Gateway returns a 504 wastes compute.

Set memory per function — not provider-wide:

```typescript
functions:
  getOrder:
    handler: src/handlers/orders/get.handler
    memorySize: 512
    timeout: 10    # seconds
```

**Lambda charges on duration × memory** — over-provisioning memory is sometimes
faster AND cheaper due to proportionally more CPU.

Use Lambda Power Tuning to find the optimal memory setting:
`https://github.com/alexcasalboni/aws-lambda-power-tuning`

## AWS SDK client singleton pattern

SDK clients must be constructed outside the handler. Re-creating them on every
invocation re-establishes TLS connections.

```typescript
// services/api/src/lib/dynamodb.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Constructed once at module load. Reused across warm invocations.
const ddbClient = new DynamoDBClient({
  maxAttempts: 3,
  requestHandler: {
    connectionTimeout: 2000,
    socketTimeout: 3000,
  },
});

export const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});
```

Never do this inside the handler:

```typescript
// ❌ BAD — new TLS handshake on every invocation
export const handler = async (event) => {
  const client = new DynamoDBClient({}); // cold start on every call
  ...
};
```

## Environment variable validation at module load

Fail fast on missing config — at module load, not inside the handler. This is
caught during the init phase and reported clearly, instead of failing mid-request.

```typescript
// services/api/src/lib/env.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Required environment variable '${name}' is not set`);
  return value;
}

export const env = {
  TABLE_NAME: requireEnv('TABLE_NAME'),
  IDEMPOTENCY_TABLE_NAME: requireEnv('IDEMPOTENCY_TABLE_NAME'),
  SERVICE_NAME: requireEnv('SERVICE_NAME'),
  STAGE: requireEnv('SLS_STAGE'),
} as const;
```

## Provisioned Concurrency — when and how

Use provisioned concurrency only when:

- P50 cold start > 500ms after bundle optimization.
- The endpoint is user-facing with strict latency SLO (<100ms P99).
- Traffic pattern is predictable (scheduled warm-up via EventBridge).

**Do NOT use provisioned concurrency as a default** — it increases cost
significantly and masks bundle size problems.

Configuration:

```typescript
// serverless.ts
functions:
  getOrder:
    handler: src/handlers/orders/get.handler
    provisionedConcurrency: ${param:provisionedConcurrency, 0}  # 0 in dev, 5+ in prod
```

## Lambda Insights — monitoring performance

Enable Lambda Insights to get P99 cold start duration, initialization time,
and memory utilization in CloudWatch:

```typescript
// serverless.ts
provider:
  layers:
    - arn:aws:lambda:${aws:region}:580247275435:layer:LambdaInsightsExtension:38
  iamRoleStatements:
    - Effect: Allow
      Action:
        - cloudwatch:PutMetricData
      Resource: '*'
```

Or via the Datadog plugin (if using Datadog observability):

```typescript
custom: datadog: enableEnhancedMetrics: true;
enableColdStartTracing: true;
```

## Import optimization

Avoid importing entire libraries when you need one function:

```typescript
// ❌ BAD — imports entire lodash
import _ from 'lodash';
const result = _.get(obj, 'a.b.c');

// ✅ GOOD — imports only one function
import get from 'lodash/get';
```

For AWS SDK v3, import only the specific commands you need:

```typescript
// ✅ GOOD — tree-shakeable
import { GetItemCommand } from '@aws-sdk/client-dynamodb';

// ❌ BAD — if bundling SDK (which you shouldn't)
import * as dynamodb from '@aws-sdk/client-dynamodb';
```

## Checklist

- [ ] Bundle size checked — each handler ZIP < 5 MB uncompressed.
- [ ] `@aws-sdk/*` excluded from esbuild bundle (present in Lambda runtime).
- [ ] All SDK clients created at module level — not inside handler function.
- [ ] Env vars validated at module load using `requireEnv`.
- [ ] Memory and timeout set per function — not only at provider level.
- [ ] Timeout < API Gateway timeout (HTTP API: 30s, REST API: 29s).
- [ ] Provisioned Concurrency only for user-facing endpoints with proven cold start issue.
- [ ] Lambda Insights or Datadog enhanced metrics enabled.
- [ ] `minify: true` in esbuild config for production stages.

```

```
