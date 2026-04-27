````skill
---
name: serverless-baseline
description: Project-level Serverless Framework v4 configuration baseline — tags, deployment bucket, Lambda version management, packaging, naming conventions, and provider defaults. Apply when creating or reviewing a serverless.ts project config, not a single endpoint.
---

## Context

Stack: AWS Lambda + Serverless Framework v4 + TypeScript (`serverless.ts`).
Scope: project-level `serverless.ts` — affects all functions in the stack.
Apply this skill when: creating a service from scratch, reviewing an existing
`serverless.ts`, or when `@openspec` flags infra-level tasks in tasks.md.

---

## 1. Tagging strategy (mandatory)

All CloudFormation resources MUST carry a consistent tag set. Tags are the
primary axis for cost allocation, ownership, and incident triage in AWS.

```typescript
// serverless.ts — provider section
provider: {
  tags: {
    Project: '${self:service}',             // matches openspec/config.yaml service name
    Environment: '${opt:stage, "dev"}',
    Owner: 'team-name',                     // team or squad, not individual
    CostCenter: 'cc-1234',                  // billing code
    ManagedBy: 'serverless-framework',
    Version: '${env:GIT_SHA, "local"}',     // injected by CI
    Repository: 'org/repo-name',
  },
  stackTags: {                              // propagated to the CF stack itself
    Project: '${self:service}',
    Environment: '${opt:stage, "dev"}',
    Owner: 'team-name',
    CostCenter: 'cc-1234',
  },
},
````

### Rules

- `Project` must match `service` in `openspec/config.yaml` — single source of truth.
- `Owner` is a team name, never an individual (people leave, teams don't).
- `CostCenter` is mandatory even if the value is a placeholder — forces the
  conversation with finance before prod goes live.
- `Version` from `GIT_SHA` enables pinpointing which deployment caused an incident.
- `stackTags` must repeat at minimum `Project`, `Environment`, `Owner`, `CostCenter`
  because some AWS services only inherit stack-level tags.
- Never tag with PII (names, emails) or internal-only resource IDs.

---

## 2. Lambda version management

By default Serverless Framework publishes a new Lambda version on every deploy.
This quickly fills the 75 GB Lambda storage quota per region and makes the
versions list unmanageable.

```typescript
// serverless.ts — provider section
provider: {
  versionFunctions: false,   // ← default OFF; enable only when using aliases
},
```

### When to enable versions (`versionFunctions: true`)

Only when the project uses **traffic-shifting aliases** (canary or linear
deployments via `deployment-canary` skill). In that case:

```typescript
provider: {
  versionFunctions: true,
},

// per function
functions: {
  myFunction: {
    handler: '...',
    // CodeDeploy manages alias routing — see deployment-canary skill
    deploymentSettings: {
      type: 'Linear10PercentEvery1Minute',
      alias: 'Live',
      alarms: ['MyFunctionErrorAlarm'],
    },
  },
},
```

When versions are enabled, add a lifecycle policy to prune old versions automatically:

```typescript
// serverless.ts — plugins
plugins: ['serverless-prune-plugin'],

custom: {
  prune: {
    automatic: true,
    number: 5,    // keep last 5 published versions per function
  },
},
```

> Install: `npm install --save-dev serverless-prune-plugin`

---

## 3. Deployment bucket

By default Serverless creates one S3 bucket per service per stage (e.g.,
`my-service-dev-serverlessdeploymentbucket-abc123`). In a monorepo with multiple
services this generates dozens of buckets, each with its own ACL, policy, and
lifecycle to manage — a security and cost surface.

### Consolidated bucket pattern

Create a **single shared deployment bucket per stage** outside Terraform/SLS
(managed separately, not deleted on stack removal):

```typescript
// serverless.ts — provider section
provider: {
  deploymentBucket: {
    name: 'org-deployments-${opt:stage, "dev"}-${aws:region}',
    serverSideEncryption: 'AES256',
    blockPublicAccess: true,
    skipPolicySetup: false,
  },
  deploymentPrefix: '${self:service}',   // isolates service artifacts within bucket
},
```

### Bucket setup (one-time, via IaC or console)

The shared bucket must have:

- SSE-AES256 or SSE-KMS encryption.
- Block all public access.
- Lifecycle rule: expire objects older than 90 days in the deployment prefix.
- Versioning: enabled (protects against accidental deletion).

### Lifecycle rule example (CloudFormation, not in serverless.ts)

```yaml
LifecycleConfiguration:
  Rules:
    - Id: expire-old-deployments
      Status: Enabled
      Prefix: ''
      ExpirationInDays: 90
      NoncurrentVersionExpirationInDays: 30
```

---

## 4. Package configuration

Cold starts are directly affected by bundle size. Package configuration belongs
at the project level, not per-function (unless a function has extreme outlier deps).

```typescript
// serverless.ts
package: {
  individually: true,       // bundled per function — smaller packages, faster cold starts
  patterns: [
    '!node_modules/**',     // esbuild handles bundling; exclude raw node_modules
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!coverage/**',
    '!.github/**',
  ],
},

custom: {
  esbuild: {
    bundle: true,
    minify: true,
    sourcemap: true,
    target: 'node22',
    platform: 'node',
    exclude: ['@aws-sdk/*'],  // AWS SDK is provided by Lambda runtime
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
},
```

### Rules

- `individually: true` is mandatory. A monolithic zip with all functions wastes
  Lambda memory and inflates cold starts.
- Exclude `@aws-sdk/*` — Lambda runtime provides AWS SDK v3 natively; bundling
  it adds ~10 MB per function with zero benefit.
- Exclude test files, coverage, `.github`, and any local-only tooling.
- `sourcemap: true` ensures stack traces in CloudWatch map to TypeScript source
  lines, not minified output.
- Target must match the `runtime` (`node22` for `nodejs22.x`).

---

## 5. Naming conventions

Consistent naming prevents collisions across stages and simplifies cost explorer
queries.

| Resource               | Pattern                                            | Example                                       |
| ---------------------- | -------------------------------------------------- | --------------------------------------------- |
| Service name           | `{domain}-{subdomain}`                             | `payments-checkout`                           |
| Stack name             | `{service}-{stage}`                                | `payments-checkout-prod`                      |
| Function logical ID    | `{action}{Resource}` (camelCase)                   | `getOrder`, `processPayment`                  |
| Function physical name | `${self:service}-${opt:stage}-{action}-{resource}` | auto-generated by SLS                         |
| Log group              | auto-generated by SLS from physical name           | `/aws/lambda/payments-checkout-prod-getOrder` |
| SSM paths              | `/{service}/{stage}/{param}`                       | `/payments-checkout/prod/db-url`              |

```typescript
// serverless.ts
service: 'payments-checkout',   // domain-subdomain, no abbreviations

provider: {
  stackName: '${self:service}-${opt:stage, "dev"}',
},
```

---

## 6. Provider defaults (mandatory at provider level)

These must be set at `provider` level, not scattered per function, to avoid
configuration drift:

```typescript
provider: {
  name: 'aws',
  runtime: 'nodejs22.x',
  stage: '${opt:stage, "dev"}',
  region: '${opt:region, "us-east-1"}',
  memorySize: 512,            // baseline — override per function if justified
  timeout: 29,                // 29s max for API GW (hard limit 30s)
  logRetentionInDays: 30,     // mandatory — prevents unbounded log cost
  tracing: {
    lambda: true,             // X-Ray active tracing
    apiGateway: true,
  },
  environment: {
    NODE_OPTIONS: '--enable-source-maps',   // TypeScript source maps in stack traces
    SERVICE_NAME: '${self:service}',
    STAGE: '${opt:stage, "dev"}',
    METRICS_NAMESPACE: '${self:service}/${opt:stage, "dev"}',
  },
  httpApi: {
    cors: true,               // adjust origins per stage in custom: section
    metrics: true,            // HTTP API access logging
  },
},
```

### Memory and timeout guidance

| Use case                             | Memory       | Timeout   |
| ------------------------------------ | ------------ | --------- |
| Read-only API handler                | 256 MB       | 10 s      |
| Write / mutation handler             | 512 MB       | 15 s      |
| Async SQS/SNS consumer               | 512 MB       | 60–300 s  |
| Background job (Step Functions task) | 1024 MB      | 300–900 s |
| Report / data export                 | 1024–2048 MB | 900 s     |

Always measure with Lambda Power Tuning before setting production values.

---

## 7. CloudWatch alarms baseline

Every service MUST have at minimum these alarms — define them as CloudFormation
resources in `serverless.ts` under `resources.Resources`:

```typescript
resources: {
  Resources: {
    // 1. Lambda error rate > 1% in 5 minutes (any function in stack)
    HighErrorRateAlarm: {
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        AlarmName: '${self:service}-${opt:stage}-high-error-rate',
        Namespace: 'AWS/Lambda',
        MetricName: 'Errors',
        Statistic: 'Sum',
        Period: 300,
        EvaluationPeriods: 1,
        Threshold: 5,
        ComparisonOperator: 'GreaterThanThreshold',
        AlarmActions: ['${ssm:/${self:service}/${opt:stage}/alerts-sns-arn}'],
      },
    },
    // 2. Throttling alarm
    ThrottleAlarm: {
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        AlarmName: '${self:service}-${opt:stage}-throttles',
        Namespace: 'AWS/Lambda',
        MetricName: 'Throttles',
        Statistic: 'Sum',
        Period: 60,
        EvaluationPeriods: 3,
        Threshold: 10,
        ComparisonOperator: 'GreaterThanThreshold',
        AlarmActions: ['${ssm:/${self:service}/${opt:stage}/alerts-sns-arn}'],
      },
    },
  },
},
```

> Specific per-function metrics and alarms (latency, business error rate) are
> handled by `@observability-implementer`. These two are stack-level baselines
> that belong in the initial `serverless.ts` setup.

---

## Anti-patterns

- Do NOT let SLS auto-create one deployment bucket per service — consolidate.
- Do NOT enable `versionFunctions: true` without `serverless-prune-plugin`.
- Do NOT set `memorySize` only at provider level and never override — measure each function.
- Do NOT omit `logRetentionInDays` — CloudWatch logs are billed per GB stored.
- Do NOT use generic stack names (`my-service`) — always include stage to prevent
  cross-environment collisions.
- Do NOT tag with individual names or emails.
- Do NOT set `timeout: 30` for API-backed functions — API Gateway hard limit is 29s.
- Do NOT bundle `@aws-sdk` — provided by runtime, bundling it wastes package size.

---

## 6. Reserved concurrency — blast radius control

Every production Lambda function MUST have `reservedConcurrency` set.
Without it, a traffic spike or runaway loop can exhaust the regional concurrency
quota (default 1 000 per account) and starve other functions.

```typescript
// serverless.ts — per function
functions: {
  getOrder: {
    handler: 'src/handlers/orders/get.handler',
    reservedConcurrency: 50,   // max 50 simultaneous executions of this function
    // ... rest of config
  },
  processOrderQueue: {
    handler: 'src/handlers/orders/process.handler',
    reservedConcurrency: 20,   // SQS consumer: match to expected throughput
    // ... rest of config
  },
},
```

### Sizing guidance

| Function type           | Starting value                           | Rationale                               |
| ----------------------- | ---------------------------------------- | --------------------------------------- |
| User-facing API handler | 50–200                                   | Scale with expected peak RPS            |
| SQS consumer            | `batchSize` × expected concurrent queues | Prevent over-consuming                  |
| Cron / scheduled event  | 1–5                                      | Single execution, no parallelism needed |
| Webhook receiver        | 20–50                                    | Should offload to SQS immediately       |

### Rules

- Set `reservedConcurrency` on **every function in production** — no exceptions.
- `reservedConcurrency: 0` disables the function completely (effective kill switch).
- For SQS consumers the reserved concurrency effectively sets the maximum consumer throughput:
  if reservedConcurrency < batchSize, SQS will throttle delivery automatically.
- Do NOT set it once and forget — revisit after load tests with real thresholds from `load-testing-k6`.
- If a function needs burst above its reserved limit, configure an **unreserved concurrency buffer**
  at the provider level so other functions are not starved.

---

## Checklist

- [ ] `tags` and `stackTags` defined with Project, Environment, Owner, CostCenter, Version.
- [ ] `versionFunctions: false` (or enabled with `serverless-prune-plugin` and alias strategy).
- [ ] Shared deployment bucket configured with encryption and lifecycle rule.
- [ ] `package.individually: true` with esbuild and `@aws-sdk` exclusion.
- [ ] Service name follows `domain-subdomain` convention.
- [ ] `stackName` explicitly set to `${self:service}-${opt:stage}`.
- [ ] Provider defaults: runtime, memorySize, timeout, logRetentionInDays, tracing.
- [ ] `NODE_OPTIONS: '--enable-source-maps'` set at provider environment.
- [ ] METRICS_NAMESPACE set at provider environment.
- [ ] Baseline CloudWatch alarms (error rate + throttling) defined in resources.
- [ ] No `@aws-sdk` in bundle.
- [ ] Per-function memory/timeout documented with rationale if overriding provider default.
- [ ] `reservedConcurrency` set on every production function.

```

```
