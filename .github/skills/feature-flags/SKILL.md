````skill
---
name: feature-flags
description: Implement feature flags and kill switches in Lambda functions and React frontends.
---

## Why feature flags

Feature flags decouple **deployment** from **release**:
- Deploy code to production with the flag OFF.
- Enable the flag for internal users first (dark launch).
- Gradually roll out to % of users or specific groups.
- Kill switch: turn off instantly without a deploy or rollback.

**Rule**: any feature that touches auth, payments, PII, or contract-breaking
changes MUST be behind a feature flag. Non-trivial UI features should also use flags.

## Backend — Lambda with SSM Parameter Store

SSM Parameter Store is the default. It is available everywhere Lambda runs,
integrates with IAM, and supports SecureString for sensitive flags.

### Flag read pattern

Cache the SSM value at Lambda container level (module scope). Refresh after
TTL expires to avoid hitting SSM on every invocation.

```typescript
// services/api/src/lib/feature-flags.ts
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({});

const cache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function getFlag(name: string): Promise<boolean> {
  const paramName = `/feature-flags/${process.env.SLS_STAGE}/${name}`;
  const cached = cache.get(paramName);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value === 'true';
  }

  try {
    const { Parameter } = await ssmClient.send(
      new GetParameterCommand({ Name: paramName })
    );
    const value = Parameter?.Value ?? 'false';
    cache.set(paramName, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value === 'true';
  } catch {
    // Fail open (return false = feature off) — safer than crashing
    return false;
  }
}
````

### Usage in handler

```typescript
import { getFlag } from '../../lib/feature-flags';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => {
  const newCheckoutEnabled = await getFlag('new-checkout-flow');

  if (newCheckoutEnabled) {
    return newCheckoutUseCase(event);
  }
  return legacyCheckoutUseCase(event);
};
```

### SSM Parameter naming convention

```
/feature-flags/{stage}/{flag-name}
/feature-flags/prod/new-checkout-flow     = "false"
/feature-flags/staging/new-checkout-flow  = "true"
```

Create via CloudFormation (initial value off):

```yaml
NewCheckoutFlowFlag:
  Type: AWS::SSM::Parameter
  Properties:
    Name: /feature-flags/${sls:stage}/new-checkout-flow
    Type: String
    Value: 'false' # always start disabled
    Description: 'Enables the new checkout flow. Set to true to activate.'
```

Give each function read access only to its flags:

```yaml
iamRoleStatements:
  - Effect: Allow
    Action: ssm:GetParameter
    Resource: !Sub 'arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/feature-flags/${sls:stage}/*'
```

## Frontend — React

Fetch flags from a dedicated API endpoint or expose them as part of the
app bootstrap payload. Never bundle flag values into the client build.

### Flag context provider

```typescript
// apps/web/src/shared/feature-flags/feature-flags-context.tsx
import { createContext, useContext } from 'react';

export type FeatureFlags = {
  newCheckoutFlow: boolean;
  redesignedDashboard: boolean;
};

const defaultFlags: FeatureFlags = {
  newCheckoutFlow: false,
  redesignedDashboard: false,
};

const FeatureFlagsContext = createContext<FeatureFlags>(defaultFlags);

export function FeatureFlagsProvider({
  flags,
  children,
}: {
  flags: FeatureFlags;
  children: React.ReactNode;
}) {
  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext);
}
```

### Usage in component

```tsx
function CheckoutButton() {
  const { newCheckoutFlow } = useFeatureFlags();

  return newCheckoutFlow ? <NewCheckoutButton /> : <LegacyCheckoutButton />;
}
```

### Initialize at app bootstrap

```typescript
// apps/web/src/app/App.tsx
const flags = await fetch('/api/flags').then(r => r.json());

<FeatureFlagsProvider flags={flags}>
  <App />
</FeatureFlagsProvider>
```

## Kill switch pattern

A kill switch is a feature flag used to disable a feature that is causing
problems in production, without a code deploy.

Design rules for kill switches:

1. Set the flag to `false` = feature disabled, fallback to safe path.
2. Never put a kill switch behind another flag.
3. Kill switches for auth or payment flows must be tested in staging before production.
4. Document the kill switch in the OpenSpec design section with: how to trigger it, what happens when it fires, and how to re-enable.

## Percentage rollout (advanced)

For gradual rollout by user percentage, hash the `userId` to a deterministic
bucket:

```typescript
export function isInRollout(
  userId: string,
  flagName: string,
  percentage: number,
): boolean {
  // Simple deterministic hash — same userId always gets same bucket
  let hash = 0;
  const key = `${flagName}:${userId}`;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const bucket = Math.abs(hash) % 100;
  return bucket < percentage;
}

// Usage: if (isInRollout(userId, 'new-checkout-flow', 10)) { /* 10% of users */ }
```

## Anti-patterns

- ❌ Feature flag values hardcoded in source code or environment variables — defeats the purpose.
- ❌ Reading SSM on every Lambda invocation without a cache — costs + latency.
- ❌ Leaving flags alive after 100% rollout is complete — technical debt; clean up.
- ❌ Using feature flags to hide incomplete features from security review — flags are transparent in SSM.
- ❌ Nested flags (flag A checks flag B) — hard to reason about, leads to dead combinations.
- ❌ Frontend fetching flags directly from SSM — SSM is not a public API.

## Checklist

- [ ] New high-risk feature has a kill switch via SSM Parameter Store.
- [ ] Flag name follows `/feature-flags/{stage}/{flag-name}` convention.
- [ ] CloudFormation creates the parameter with initial value `'false'`.
- [ ] IAM grants read-only access per function (not wildcard SSM access).
- [ ] SSM reads are cached with a TTL in Lambda (not per-invocation reads).
- [ ] Frontend flags fetched from API at bootstrap, not hardcoded in build.
- [ ] OpenSpec design documents the kill switch: what it disables, how to toggle, rollback path.
- [ ] Flag removed from code after 100% rollout confirmed stable (within 2 sprints).

```

```
