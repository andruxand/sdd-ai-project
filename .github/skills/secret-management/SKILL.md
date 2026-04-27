```skill
---
name: secret-management
description: Store, reference, and rotate secrets using AWS SSM Parameter Store and Secrets Manager in serverless functions.
---

## SSM Parameter Store vs Secrets Manager

| Criteria | SSM Parameter Store (SecureString) | Secrets Manager |
|---|---|---|
| **Use when** | Config, non-rotating secrets, feature flags, SSM references in serverless.ts | Rotating credentials: DB passwords, API keys, certificates |
| **Rotation** | Manual only | Automatic rotation via Lambda |
| **Cost** | Free (standard) / $0.05/10k API calls (advanced) | $0.40/secret/month + $0.05/10k API calls |
| **Max size** | 4KB (standard), 8KB (advanced) | 65KB |
| **Cross-account** | Requires IAM + Resource Policy | Native cross-account support |
| **serverless.ts `${ssm:}`** | ✅ Native variable resolution | ❌ Must use SDK at runtime |

**Decision rule**: use SSM Parameter Store by default. Use Secrets Manager only
for credentials that require automatic rotation or cross-account sharing.

## SSM Parameter Store patterns

### Naming convention

```

/{service}/{stage}/{category}/{name}

/my-service/prod/config/table-name
/my-service/prod/secrets/third-party-api-key
/my-service/prod/datadog/api-key-secret-arn
/feature-flags/prod/new-checkout-flow

````

Use `SecureString` type for all secrets. Use `String` for non-sensitive config.

### Reference in serverless.ts (resolved at deploy time)

SSM references in `serverless.ts` are resolved at deploy time by the Serverless
Framework — Lambda never calls SSM at runtime for these values.

```typescript
// serverless.ts
provider:
  environment:
    TABLE_NAME: '${ssm:/my-service/${sls:stage}/config/table-name}'
    # SecureString — value is decrypted at deploy and injected as env var
    # ⚠️ Only safe for non-rotating values. Rotating secrets must use SDK.

custom:
  datadog:
    # Secrets Manager ARN — Datadog extension fetches this at runtime
    apiKeySecretArn: '${ssm:/my-service/${sls:stage}/datadog/api-key-secret-arn}'
````

**Warning**: values injected via `${ssm:}` are baked into the Lambda function
configuration at deploy time. For rotating secrets, use SDK + runtime fetch
(see Secrets Manager section below).

### Create SSM parameters via CloudFormation

```yaml
# serverless.ts resources section
ThirdPartyApiKeyParam:
  Type: AWS::SSM::Parameter
  Properties:
    Name: /my-service/${sls:stage}/secrets/third-party-api-key
    Type: SecureString
    Value: 'REPLACE_ME' # placeholder — set real value via AWS CLI or console
    Description: 'Third-party API key for payment provider. Rotate every 90 days.'
    Tags:
      service: my-service
      stage: ${sls:stage}
      managed-by: cloudformation
```

**Never commit real secret values** in CloudFormation or serverless.ts.
Use a placeholder and set the real value via:

```bash
aws ssm put-parameter \
  --name /my-service/prod/secrets/third-party-api-key \
  --value "real-value" \
  --type SecureString \
  --overwrite
```

### IAM for SSM access (per-function, least privilege)

```yaml
# In function definition
iamRoleStatements:
  - Effect: Allow
    Action:
      - ssm:GetParameter
    Resource:
      # Only the specific parameter(s) this function needs
      - !Sub 'arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/my-service/${sls:stage}/secrets/third-party-api-key'
  - Effect: Allow
    Action:
      - kms:Decrypt
    Resource:
      - !Sub 'arn:aws:kms:${AWS::Region}:${AWS::AccountId}:key/${SSMKMSKeyId}'
```

### Runtime SSM read with cache (for values that may change without redeploy)

```typescript
// services/api/src/lib/ssm-cache.ts
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const client = new SSMClient({});
const cache = new Map<string, { value: string; expiresAt: number }>();
const TTL_MS = 5 * 60_000; // 5 minutes

export async function getSecureParam(name: string): Promise<string> {
  const cached = cache.get(name);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const { Parameter } = await client.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  );

  if (!Parameter?.Value)
    throw new Error(`SSM parameter '${name}' not found or empty`);
  cache.set(name, { value: Parameter.Value, expiresAt: Date.now() + TTL_MS });
  return Parameter.Value;
}
```

## Secrets Manager patterns

Use for credentials that rotate or are shared across accounts.

### Reference at runtime (not deploy time)

```typescript
// services/api/src/lib/secrets.ts
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secretsmanager';

const client = new SecretsManagerClient({});
// Cache at module level — warm invocations reuse the value
let cachedSecret: string | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes — shorter than rotation period

export async function getSecret(secretId: string): Promise<string> {
  if (cachedSecret && Date.now() < cacheExpiresAt) return cachedSecret;

  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!SecretString)
    throw new Error(`Secret '${secretId}' has no string value`);
  cachedSecret = SecretString;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedSecret;
}
```

### CloudFormation — Secrets Manager resource

```yaml
DBPassword:
  Type: AWS::SecretsManager::Secret
  DeletionPolicy: Retain
  Properties:
    Name: /my-service/${sls:stage}/db/password
    Description: 'RDS master password — rotated every 30 days.'
    GenerateSecretString:
      SecretStringTemplate: '{"username": "admin"}'
      GenerateStringKey: 'password'
      PasswordLength: 32
      ExcludeCharacters: '"@/\\'
    Tags:
      - Key: service
        Value: my-service
      - Key: stage
        Value: ${sls:stage}
```

### Automatic rotation

Configure rotation for Secrets Manager secrets that need it:

```yaml
DBPasswordRotationSchedule:
  Type: AWS::SecretsManager::RotationSchedule
  Properties:
    SecretId: !Ref DBPassword
    HostedRotationLambda:
      RotationType: MySQLSingleUser # or RDSSecretRotation, etc.
      RotationLambdaName: my-service-${sls:stage}-db-rotation
    RotationRules:
      AutomaticallyAfterDays: 30
```

IAM to read the secret at runtime:

```yaml
iamRoleStatements:
  - Effect: Allow
    Action:
      - secretsmanager:GetSecretValue
    Resource:
      - !Ref DBPassword
```

## Datadog API key — always Secrets Manager (never env var)

Per `docs/standards/serverless-v4.md`:

```typescript
// serverless.ts
custom:
  datadog:
    # ✅ Correct — Datadog extension fetches from Secrets Manager at runtime
    apiKeySecretArn: '${ssm:/my-service/${sls:stage}/datadog/api-key-secret-arn}'

// ❌ NEVER this:
provider:
  environment:
    DD_API_KEY: 'abc123'  # plaintext in Lambda config
```

## .env.example (document without exposing values)

Maintain `.env.example` to document all required env vars. Never commit `.env`:

```bash
# .env.example
TABLE_NAME=my-service-dev-table
IDEMPOTENCY_TABLE_NAME=my-service-dev-idempotency
SERVICE_NAME=my-service
SLS_STAGE=dev
# Populated via SSM at deploy — set via: aws ssm put-parameter ...
THIRD_PARTY_API_KEY=ssm:/my-service/dev/secrets/third-party-api-key
```

## Secret rotation checklist

For every secret, document in OpenSpec design:

- Who rotates it (automated Lambda, manual, CI).
- Rotation period (30/60/90 days).
- Where it is used (which functions).
- Rollback procedure if rotation breaks something.

## Anti-patterns

- ❌ `DD_API_KEY: 'abc123'` as Lambda environment variable — plaintext in AWS console and CloudFormation.
- ❌ Secrets in `serverless.ts` source code — committed to git.
- ❌ Using `${ssm:}` deploy-time resolution for rotating secrets — value is stale after rotation.
- ❌ Single shared IAM role for all functions with `ssm:GetParameter` on `*` — violates least privilege.
- ❌ No TTL on runtime SSM/Secrets Manager cache — too many API calls OR stale secrets after rotation.
- ❌ `DeletionPolicy: Delete` on Secrets Manager secrets — losing a secret may be unrecoverable.
- ❌ Hardcoded secret ARNs — use CloudFormation refs (`!Ref`, `!Sub`) or SSM parameters.

## Checklist

- [ ] No secret values in source code, environment variables (plaintext), test fixtures, or logs.
- [ ] `SecureString` type for all SSM parameters that hold secrets.
- [ ] `${ssm:}` deploy-time references only for non-rotating config values.
- [ ] Rotating credentials use Secrets Manager + runtime SDK fetch with cache.
- [ ] Datadog API key via `apiKeySecretArn` — never `DD_API_KEY` env var.
- [ ] IAM scoped to specific parameter/secret ARNs (not `*`).
- [ ] `DeletionPolicy: Retain` on all Secrets Manager resources.
- [ ] `.env.example` documents required vars without real values.
- [ ] Rotation period and owner documented in OpenSpec design for every secret.

```

```
