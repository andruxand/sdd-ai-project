# Feature Flags Standards

Feature flags decouple deployment from release. A feature can be deployed to
production disabled, enabled for a subset of users, and rolled back instantly
without a redeploy.

**Rule: any user-visible behavior change that cannot be instantly reverted via
config must be behind a feature flag.**

## Tiers

### Tier 1 — Environment variables (simple, no SDK)

Use when: the flag value does not change at runtime and a redeploy is acceptable.

```typescript
// services/api/src/config/index.ts
export const config = {
  features: {
    newCheckoutFlow: process.env.FEATURE_NEW_CHECKOUT === 'true',
    experimentalSearch: process.env.FEATURE_EXPERIMENTAL_SEARCH === 'true',
  },
} as const;
```

```yaml
# serverless.ts environment section
environment:
  FEATURE_NEW_CHECKOUT: ${ssm:/myapp/${opt:stage}/features/new-checkout, 'false'}
```

- Values stored in SSM Parameter Store per stage (not hardcoded).
- Change requires SSM update + Lambda cold start or function update.
- Use only for low-frequency toggles (deploy-time gates, not user-level targeting).

### Tier 2 — AWS AppConfig (runtime, no user targeting)

Use when: the flag must change without a redeploy (kill switch, percentage rollout
at service level).

```typescript
import {
  AppConfigDataClient,
  StartConfigurationSessionCommand,
  GetLatestConfigurationCommand,
} from '@aws-sdk/client-appconfigdata';
import { Logger } from '@aws-lambda-powertools/logger';

const client = new AppConfigDataClient({});
const logger = new Logger({ serviceName: process.env.SERVICE_NAME! });

let sessionToken: string | undefined;
let cachedConfig: Record<string, boolean> = {};

async function getFeatureFlags(): Promise<Record<string, boolean>> {
  if (!sessionToken) {
    const session = await client.send(
      new StartConfigurationSessionCommand({
        ApplicationIdentifier: process.env.APPCONFIG_APP!,
        EnvironmentIdentifier: process.env.APPCONFIG_ENV!,
        ConfigurationProfileIdentifier: process.env.APPCONFIG_PROFILE!,
      }),
    );
    sessionToken = session.InitialConfigurationToken;
  }

  const response = await client.send(
    new GetLatestConfigurationCommand({ ConfigurationToken: sessionToken }),
  );

  sessionToken = response.NextPollConfigurationToken;

  if (response.Configuration && response.Configuration.length > 0) {
    const text = new TextDecoder().decode(response.Configuration);
    cachedConfig = JSON.parse(text);
    logger.debug('Feature flags refreshed', { flags: cachedConfig });
  }

  return cachedConfig;
}

export { getFeatureFlags };
```

- Cache the session token across warm invocations (module-level variable).
- AppConfig polls on interval — do not call on every request.
- TTL: use `MinimumPollIntervalInSeconds: 15` (AppConfig minimum).
- IAM: add `appconfig:StartConfigurationSession` + `appconfig:GetLatestConfiguration`
  at function level.

### Tier 3 — LaunchDarkly / Flagsmith (user-level targeting)

Use when: gradual rollout per user, A/B testing, percentage-based rollouts, or
feature entitlement by plan.

```typescript
import { init } from 'launchdarkly-node-server-sdk';

// Initialize at module level — not inside handler
const ldClient = init(process.env.LAUNCHDARKLY_SDK_KEY!);
await ldClient.waitForInitialization({ timeout: 5 });

// In handler:
const showNewDashboard = await ldClient.variation(
  'new-dashboard',
  { key: userId, email: userEmail },
  false, // default value if flag evaluation fails
);
```

- SDK key stored in Secrets Manager, not SSM (it is a secret, not config).
- Always provide a sensible default as the third argument.
- Track flag evaluations as Datadog custom metrics or LaunchDarkly experiments.

## Frontend feature flags

```tsx
// apps/web/src/lib/flags.ts
export const flags = {
  newCheckoutFlow: import.meta.env.VITE_FEATURE_NEW_CHECKOUT === 'true',
  experimentalSearch:
    import.meta.env.VITE_FEATURE_EXPERIMENTAL_SEARCH === 'true',
} as const;

// Usage in component:
import { flags } from '@/lib/flags';

function CheckoutButton() {
  return flags.newCheckoutFlow ? <NewCheckout /> : <LegacyCheckout />;
}
```

For runtime (user-level) targeting in frontend, use the LaunchDarkly React SDK:

```tsx
import { useFlags } from 'launchdarkly-react-client-sdk';

function CheckoutButton() {
  const { newCheckoutFlow } = useFlags();
  return newCheckoutFlow ? <NewCheckout /> : <LegacyCheckout />;
}
```

## Kill switch pattern (emergency)

Every async worker (SQS consumer, scheduled job) MUST have a kill switch that can
disable processing without a redeploy:

```typescript
async function handler(event: SQSEvent) {
  const flags = await getFeatureFlags();

  if (!flags['order-processor-enabled']) {
    logger.warn('Order processor kill switch active — skipping batch');
    return { batchItemFailures: [] }; // ack messages, do not process
  }

  // ... process
}
```

## Naming conventions

| Pattern          | Example                   | Use                             |
| ---------------- | ------------------------- | ------------------------------- |
| `FEATURE_<NAME>` | `FEATURE_NEW_CHECKOUT`    | Env var (Tier 1)                |
| `<name>-enabled` | `order-processor-enabled` | AppConfig / LD key              |
| `flags.<name>`   | `flags.newCheckoutFlow`   | Frontend object key (camelCase) |

## Lifecycle

1. **Create**: flag OFF by default in all stages. Enable in `dev` first.
2. **Rollout**: enable in `staging` → canary in `production` (if LD) → 100%.
3. **Cleanup**: once a flag is 100% production and stable for 2+ sprints, remove it.
   Dead flags are technical debt. Create a cleanup ticket when the flag goes 100%.

## Anti-patterns

- Do NOT use flags to hide incomplete code indefinitely — flags are not branches.
- Do NOT put flag evaluation inside deeply nested business logic — evaluate at
  handler or component boundary and pass the result down.
- Do NOT skip the default value — always define safe fallback behavior.
- Do NOT use the same flag key in frontend and backend for different behaviors.

## Checklist

- [ ] Flag OFF by default in all environments at creation.
- [ ] Flag value sourced from SSM/AppConfig/LD — never hardcoded.
- [ ] Default (fallback) value defined and safe.
- [ ] Kill switch in place for every async worker.
- [ ] Cleanup ticket created when flag reaches 100% production rollout.
- [ ] IAM permissions scoped for AppConfig access (Tier 2 only).
