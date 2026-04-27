# Skill: deployment-canary

Apply this skill when a feature carries deployment risk and requires gradual traffic shifting to a new Lambda version with automatic or manual rollback.

**Source**: AWS Lambda traffic shifting with aliases + Serverless Framework v4 `deploymentSettings` (official AWS docs + SLS v4 release notes).

---

## When to use

Apply canary deployment when **all** of the following are true:

1. The change modifies handler logic that processes payments, auth, or data mutations (risk ≥ medium).
2. A CloudWatch alarm exists (or can be added) to detect failures automatically.
3. The OpenSpec proposal has `rollback: canary` in the rollback section.

Skip canary for: config-only changes, new Lambda functions with no existing traffic, hotfixes requiring immediate full rollout.

---

## Core concept

AWS Lambda **aliases** point to a specific version. With traffic shifting, an alias can route a percentage of requests to a new version while keeping the rest on the stable version. If alarms fire, CodeDeploy rolls back automatically.

```
Alias: !stable
  → 90% traffic → version N   (stable)
  → 10% traffic → version N+1 (canary)
                ↓ alarms OK after window
  → 100% traffic → version N+1
```

---

## Serverless Framework v4 configuration

```typescript
// serverless.ts
import type { AWS } from '@serverless/typescript';

const serverlessConfig: AWS = {
  provider: {
    name: 'aws',
    // ... other config
  },
  functions: {
    processPayment: {
      handler: 'src/handlers/processPayment.handler',
      // Deployment strategy for this function
      deploymentSettings: {
        type: 'Canary10Percent5Minutes', // 10% → 90% after 5 minutes if alarms are green
        alias: 'stable',
        // Alarms that trigger automatic rollback
        alarms: ['processPayment-ErrorRate', 'processPayment-Throttles'],
        // Optional: pre/post traffic shift hooks (Lambda functions)
        preTrafficHook: 'preTrafficHook',
        postTrafficHook: 'postTrafficHook',
      },
    },
  },
};
```

---

## Deployment strategy types

| Strategy                       | Behaviour               | When to use                              |
| ------------------------------ | ----------------------- | ---------------------------------------- |
| `Canary10Percent5Minutes`      | 10% → 100% after 5 min  | Standard feature rollout                 |
| `Canary10Percent10Minutes`     | 10% → 100% after 10 min | Higher-risk changes, need more soak time |
| `Canary10Percent15Minutes`     | 10% → 100% after 15 min | Critical services (payments, auth)       |
| `Canary10Percent30Minutes`     | 10% → 100% after 30 min | Highest-risk changes                     |
| `Linear10PercentEvery1Minute`  | +10% per minute         | Predictable, observable ramp             |
| `Linear10PercentEvery2Minutes` | +10% per 2 min          | Slower ramp for higher risk              |
| `AllAtOnce`                    | 100% immediately        | Non-production / hotfix                  |

---

## CloudWatch alarms for auto-rollback

```typescript
// serverless.ts — resources section
resources: {
  Resources: {
    ProcessPaymentErrorRate: {
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        AlarmName: 'processPayment-ErrorRate',
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Statistic: 'Sum',
        Period: 60,
        EvaluationPeriods: 1,
        Threshold: 1,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        Dimensions: [{ Name: 'FunctionName', Value: { Ref: 'ProcessPaymentLambdaFunction' } }],
        TreatMissingData: 'notBreaching',
      },
    },
    ProcessPaymentThrottles: {
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        AlarmName: 'processPayment-Throttles',
        MetricName: 'Throttles',
        Namespace: 'AWS/Lambda',
        Statistic: 'Sum',
        Period: 60,
        EvaluationPeriods: 2,
        Threshold: 5,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        Dimensions: [{ Name: 'FunctionName', Value: { Ref: 'ProcessPaymentLambdaFunction' } }],
        TreatMissingData: 'notBreaching',
      },
    },
  },
},
```

> Alarm names in `deploymentSettings.alarms` must match the `AlarmName` values exactly.

---

## Plugin requirement

Canary/linear deployments require a CodeDeploy-backed plugin:

```bash
npm install --save-dev serverless-plugin-canary-deployments
```

```typescript
// serverless.ts
plugins: ['serverless-plugin-canary-deployments'],
```

---

## Monitoring during shift

```bash
# Watch the deployment and alarm status in real time
aws deploy get-deployment --deployment-id d-XXXXXXX --query 'deploymentInfo.status'

# Check rollback was triggered
aws deploy list-deployment-targets --deployment-id d-XXXXXXX

# Get canary traffic percentage
aws lambda get-alias --function-name processPayment --name stable \
  --query 'RoutingConfig.AdditionalVersionWeights'
```

---

## Manual rollback procedure

If auto-rollback does not trigger or you need to roll back immediately:

```bash
# 1. Find the stable version number
aws lambda get-alias --function-name MyService-prod-processPayment --name stable

# 2. Update alias to point 100% to the old stable version
aws lambda update-alias \
  --function-name MyService-prod-processPayment \
  --name stable \
  --function-version <OLD_VERSION> \
  --routing-config AdditionalVersionWeights={}

# 3. Stop the CodeDeploy deployment
aws deploy stop-deployment --deployment-id d-XXXXXXX --auto-rollback-enabled
```

Document the rollback steps in the OpenSpec `openspec/changes/{id}/proposal.md` under `rollback:`.

---

## Pre/post traffic hooks

Use Lambda hooks for smoke tests and validation checks before/after traffic shifts:

```typescript
// src/handlers/preTrafficHook.ts
import { CodeDeploy } from '@aws-sdk/client-codedeploy';

export const handler = async (event: {
  DeploymentId: string;
  LifecycleEventHookExecutionId: string;
}) => {
  const codedeploy = new CodeDeploy({});
  try {
    // Run smoke test against new version
    await runSmokeTest();
    await codedeploy.putLifecycleEventHookExecutionStatus({
      deploymentId: event.DeploymentId,
      lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
      status: 'Succeeded',
    });
  } catch (err) {
    await codedeploy.putLifecycleEventHookExecutionStatus({
      deploymentId: event.DeploymentId,
      lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
      status: 'Failed',
    });
    throw err;
  }
};
```

---

## OpenSpec integration

When a task group includes canary deployment, the proposal must contain:

```markdown
## Rollback

- strategy: canary
- type: Canary10Percent5Minutes
- alarms: [<function>-ErrorRate, <function>-Throttles]
- manual-rollback: aws lambda update-alias ... (exact command)
- on-failure: CodeDeploy auto-rollback enabled via alarms
```

---

## Anti-patterns

| Anti-pattern                                  | Why it breaks                                    |
| --------------------------------------------- | ------------------------------------------------ |
| `AllAtOnce` for high-risk production changes  | No rollback window; one bad deploy = full outage |
| Canary without CloudWatch alarms              | Traffic shifts to 100% regardless of error rate  |
| Canary on every function                      | Slows CI; reserve for high-risk functions only   |
| No pre/post hooks on payment/auth functions   | Miss smoke test opportunity before full traffic  |
| Alarm threshold too high (e.g., Errors > 100) | Allows significant user impact before rollback   |

---

## Checklist

- [ ] `deploymentSettings` added to high-risk function in `serverless.ts`.
- [ ] `serverless-plugin-canary-deployments` installed.
- [ ] CloudWatch alarms defined in resources with correct `AlarmName`.
- [ ] Alarm names referenced in `deploymentSettings.alarms`.
- [ ] Manual rollback command documented in `proposal.md`.
- [ ] Pre/post hooks added for payment or auth functions.
- [ ] Rollback tested in a staging deploy before production.
- [ ] `AllAtOnce` not used on functions with > 0 production traffic.
