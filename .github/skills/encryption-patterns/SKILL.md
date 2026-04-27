````skill
---
name: encryption-patterns
description: >
  Implement encryption correctly across the stack: encryption in transit (TLS),
  encryption at rest (DynamoDB, S3, SSM, Secrets Manager), field-level encryption
  for PII using envelope encryption with AWS KMS, KMS key management, and OWASP
  Cryptographic Storage requirements. Apply when the feature handles PII, financial
  data, health data, credentials, or any data classified as sensitive in the spec.
---

## Sources

- OWASP Cryptographic Storage Cheat Sheet — cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- AWS KMS Best Practices Whitepaper — docs.aws.amazon.com/kms/latest/developerguide
- AWS DynamoDB Encryption at Rest — docs.aws.amazon.com/amazondynamodb/latest/developerguide/EncryptionAtRest.html
- AWS S3 Server-Side Encryption — docs.aws.amazon.com/AmazonS3/latest/userguide/serv-side-encryption.html
- AWS Secrets Manager — docs.aws.amazon.com/secretsmanager/latest/userguide

---

## 1. The three encryption layers

| Layer | Scope | Who enforces it |
|---|---|---|
| **In transit** | Data moving over the network (HTTP, SDK calls, DB connections) | API Gateway, SDK TLS, Lambda → service endpoints |
| **At rest** | Data stored on disk (DynamoDB, S3, SSM, Secrets Manager, CloudWatch Logs) | AWS-managed SSE; KMS CMK for higher classification |
| **Field-level (application)** | Individual sensitive fields encrypted before writing to DB | Application code + AWS KMS |

All three layers apply simultaneously for sensitive data. They are not alternatives.

---

## 2. Encryption in transit

### API Gateway — enforce TLS 1.2 minimum

```typescript
// serverless.ts — provider section
provider: {
  apiGateway: {
    minimumCompressionSize: 1024,
    // TLS minimum is controlled at the domain/distribution level
    // For custom domains: enforce policy in serverless.ts
  },
},

// CloudFormation resource for custom domain
resources: {
  Resources: {
    ApiCustomDomain: {
      Type: 'AWS::ApiGateway::DomainName',
      Properties: {
        SecurityPolicy: 'TLS_1_2',   // Never TLS_1_0
        // ...
      },
    },
  },
},
```

### AWS SDK clients — TLS is on by default

AWS SDK v3 forces HTTPS on all service endpoints. **Never override with `http://`.**
Do not set `endpoint: 'http://...'` in production code; only in test environments
via environment variable guards.

```typescript
// ✅ Correct
export const dynamoClient = new DynamoDBClient({});

// ❌ Wrong — disables TLS
export const dynamoClient = new DynamoDBClient({
  endpoint: 'http://localhost:8000', // Only acceptable behind NODE_ENV !== 'production' guard
});
```

---

## 3. Encryption at rest — AWS services

### DynamoDB — SSE with KMS

AWS encrypts DynamoDB tables at rest by default (AES-256 with AWS owned keys).
For sensitive data classified as confidential, use a Customer Managed Key (CMK):

```typescript
// serverless.ts — resources
resources: {
  Resources: {
    UsersTable: {
      Type: 'AWS::DynamoDB::Table',
      DeletionPolicy: 'Retain',
      Properties: {
        TableName: '${self:service}-${sls:stage}-users',
        BillingMode: 'PAY_PER_REQUEST',
        SSESpecification: {
          SSEEnabled: true,
          SSEType: 'KMS',
          // For AWS managed key: omit KMSMasterKeyId (cheaper, still encrypted)
          // For Customer Managed Key (required for PII/financial data):
          KMSMasterKeyId: { Ref: 'DataEncryptionKey' },
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,  // mandatory for tables with sensitive data
        },
      },
    },

    DataEncryptionKey: {
      Type: 'AWS::KMS::Key',
      Properties: {
        Description: '${self:service}-${sls:stage} data encryption key',
        EnableKeyRotation: true,          // Mandatory: rotate annually
        KeyPolicy: {
          Statement: [
            {
              Sid: 'Allow account root',
              Effect: 'Allow',
              Principal: { AWS: { 'Fn::Sub': 'arn:aws:iam::${AWS::AccountId}:root' } },
              Action: 'kms:*',
              Resource: '*',
            },
            {
              Sid: 'Allow Lambda service role',
              Effect: 'Allow',
              Principal: { AWS: { 'Fn::GetAtt': ['IamRoleLambdaExecution', 'Arn'] } },
              Action: ['kms:GenerateDataKey', 'kms:Decrypt'],
              Resource: '*',
            },
          ],
        },
      },
    },

    DataEncryptionKeyAlias: {
      Type: 'AWS::KMS::Alias',
      Properties: {
        AliasName: 'alias/${self:service}-${sls:stage}-data',
        TargetKeyId: { Ref: 'DataEncryptionKey' },
      },
    },
  },
},
```

### S3 — SSE-KMS with OAC

```typescript
FrontendBucket: {
  Type: 'AWS::S3::Bucket',
  Properties: {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'aws:kms',
            KMSMasterKeyID: { Ref: 'DataEncryptionKey' },
          },
          BucketKeyEnabled: true,  // Reduces KMS API costs up to 99%
        },
      ],
    },
  },
},
```

### SSM Parameter Store vs Secrets Manager

| Criteria | SSM Parameter Store (SecureString) | Secrets Manager |
|---|---|---|
| Use case | Config values, feature flags, non-rotating secrets | Credentials, API keys, rotating secrets |
| Cost | Free tier for standard params | $0.40/secret/month |
| Automatic rotation | ❌ No | ✅ Yes (Lambda rotation) |
| Cross-region replication | ❌ No | ✅ Yes |
| Max value size | 8 KB | 64 KB |
| Use for webhook secrets | ❌ | ✅ Yes — rotatable |
| Use for DB passwords | ❌ | ✅ Yes — rotation built-in for RDS/Aurora |
| Use for non-sensitive config | ✅ Yes | Overkill |

---

## 4. Field-level encryption (envelope encryption pattern)

Use when a specific field in DynamoDB must be encrypted independently from the
table-level SSE. Required for: national ID numbers, credit card info, health records,
OAuth tokens stored in DynamoDB, any field classified as PII in the spec.

**Why not rely only on table-level SSE?**
Table-level SSE protects against physical disk theft. Any IAM role with
`dynamodb:GetItem` can read all plaintext fields. Field-level encryption means
only applications with `kms:Decrypt` permission can read sensitive fields.

### Envelope encryption pattern

AWS KMS is used to generate a **data key**. The data key encrypts the field.
The encrypted data key is stored alongside the ciphertext. This avoids a KMS
API call on every read — only the data key decryption requires KMS.

```typescript
// services/api/src/infrastructure/adapters/crypto/field-encryption.ts
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const kms = new KMSClient({});
const KMS_KEY_ID = process.env.KMS_KEY_ID!; // alias/service-stage-data

// Cache decrypted data keys in memory to reduce KMS API calls
// Key: base64(encryptedDataKey) → decrypted key Buffer
// TTL: Lambda execution environment lifetime (acceptable for read-heavy paths)
const dataKeyCache = new Map<string, Buffer>();

const ALGORITHM = 'aes-256-gcm';  // Authenticated encryption — detects tampering

export interface EncryptedField {
  ciphertext: string;         // base64 AES-256-GCM ciphertext
  iv: string;                 // base64 initialization vector (96-bit for GCM)
  authTag: string;            // base64 GCM authentication tag
  encryptedDataKey: string;   // base64 KMS-encrypted data key (stored alongside)
}

/**
 * Encrypt a string field using envelope encryption.
 * Generates a fresh data key per field to ensure key diversity.
 */
export async function encryptField(plaintext: string): Promise<EncryptedField> {
  // 1. Generate a 256-bit data key from KMS
  const { Plaintext, CiphertextBlob } = await kms.send(
    new GenerateDataKeyCommand({
      KeyId: KMS_KEY_ID,
      KeySpec: 'AES_256',
    }),
  );

  if (!Plaintext || !CiphertextBlob) throw new Error('KMS GenerateDataKey failed');

  const dataKey = Buffer.from(Plaintext);
  const encryptedDataKey = Buffer.from(CiphertextBlob);

  // 2. Encrypt the field locally with the data key
  const iv = randomBytes(12);  // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, dataKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // GCM authentication tag — integrity check

  // 3. Zero out the plaintext data key from memory
  dataKey.fill(0);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encryptedDataKey: encryptedDataKey.toString('base64'),
  };
}

/**
 * Decrypt a field encrypted with encryptField.
 */
export async function decryptField(field: EncryptedField): Promise<string> {
  const encryptedDataKeyBuf = Buffer.from(field.encryptedDataKey, 'base64');
  const cacheKey = field.encryptedDataKey;

  // Re-use cached data key if available
  let dataKey = dataKeyCache.get(cacheKey);
  if (!dataKey) {
    const { Plaintext } = await kms.send(
      new DecryptCommand({ CiphertextBlob: encryptedDataKeyBuf }),
    );
    if (!Plaintext) throw new Error('KMS Decrypt failed');
    dataKey = Buffer.from(Plaintext);
    dataKeyCache.set(cacheKey, dataKey);
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    dataKey,
    Buffer.from(field.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(field.authTag, 'base64'));

  return (
    decipher.update(Buffer.from(field.ciphertext, 'base64')).toString('utf8') +
    decipher.final('utf8')
  );
}
```

### DynamoDB storage pattern for encrypted fields

```typescript
// Store encrypted field as a DynamoDB Map attribute
const encryptedNationalId = await encryptField(user.nationalId);

await docClient.send(new PutCommand({
  TableName: process.env.TABLE_NAME!,
  Item: {
    PK: `USER#${user.id}`,
    SK: 'PROFILE',
    email: user.email,        // Non-sensitive — stored plaintext (table SSE protects at rest)
    nationalIdEncrypted: encryptedNationalId,  // Sensitive — field-level encrypted
    // Never store plaintext nationalId
  },
}));
```

---

## 5. KMS key management rules

```
Rules (non-negotiable):
1. EnableKeyRotation: true — rotate annually (automatic via AWS KMS).
2. One key per service per stage (not one global key for all services).
3. Key policy: grant only GenerateDataKey + Decrypt to Lambda roles.
   Never grant kms:* to Lambda — that allows key deletion.
4. Use KMS Aliases (alias/service-stage-purpose) — decouple code from key ARN.
5. DeletionPolicy: Retain on the key CloudFormation resource — accidental
   stack deletion must not destroy the key (data becomes unrecoverable).
6. Multi-Region Keys: only if cross-region DR is required (adds cost and complexity).
7. CloudTrail: KMS API calls are automatically logged — review weekly for anomalies.
```

---

## 6. OWASP Cryptographic Storage — mandatory rules

> Source: OWASP Cryptographic Storage Cheat Sheet

| Rule | Implementation |
|---|---|
| Never implement custom cryptography | Use AWS KMS + Node.js `crypto` module only. No custom ciphers. |
| Use authenticated encryption | AES-256-GCM (not AES-CBC without HMAC). GCM detects tampering. |
| Never use MD5 or SHA-1 for integrity | Use SHA-256 minimum. AWS KMS uses AES-256 internally. |
| Never store encryption keys near the data | Keys in KMS, ciphertext in DynamoDB. Never in the same row or env var. |
| Different keys for different data classifications | Per-service, per-stage CMK. Do not share keys between prod and non-prod. |
| Rotate keys | `EnableKeyRotation: true` on all CMKs. |
| Random IVs | `randomBytes(12)` per encryption operation. Never reuse IVs. |
| Password hashing | For user passwords: **use bcrypt or Argon2** (not AES). bcrypt is designed for passwords; AES is for data encryption. For this stack, Cognito handles password storage — never store raw passwords. |

---

## 7. What NOT to do

| Anti-pattern | Why it's wrong |
|---|---|
| `AES-CBC` without MAC/HMAC | Padding oracle attacks (POODLE-style); use GCM (authenticated) |
| Storing KMS key ARN in `process.env` with the ciphertext | Attacker with read access to env can use both to decrypt |
| Sharing a KMS CMK across prod and non-prod | Key compromise in a lower env compromises prod data |
| Generating IV as a counter or timestamp | Predictable IVs are a critical vulnerability in GCM |
| Using `crypto.createHash('md5')` for integrity | MD5 is broken for collision resistance |
| Encrypting every field by default "just in case" | High KMS cost; use only for PII/financial/health fields |
| No `DeletionPolicy: Retain` on KMS key | Stack delete = permanent data loss |
| Field-level encryption on search fields (DynamoDB) | Cannot query on encrypted ciphertext; use KMS + separate index or consider tokenization |

---

## 8. Compliance notes

- **GDPR "right to erasure"**: field-level encryption enables crypto-shredding. Delete the CMK → ciphertext becomes unreadable without touching every row.
- **PCI-DSS**: full PANs MUST be encrypted at field level (not just table SSE). Never store full CVV — it is prohibited entirely.
- **HIPAA**: PHI fields must be encrypted in transit and at rest. AWS KMS CMK with CloudTrail is the standard mechanism.

---

## Implementation checklist

```
In-transit
- [ ] API Gateway custom domain uses SecurityPolicy: TLS_1_2.
- [ ] No HTTP (plaintext) endpoints in production.
- [ ] AWS SDK clients never override endpoint to http://.

At-rest
- [ ] All DynamoDB tables have SSESpecification.SSEEnabled: true.
- [ ] Tables with PII/financial data use KMS CMK (not AWS owned key).
- [ ] S3 buckets have BucketEncryption configured (SSE-KMS + BucketKey).
- [ ] EnableKeyRotation: true on all CMKs.
- [ ] DeletionPolicy: Retain on KMS key CloudFormation resources.
- [ ] Secrets in Secrets Manager (not SSM SecureString) when rotation is needed.

Field-level (PII/financial/health)
- [ ] Identified which fields require field-level encryption (in proposal/design).
- [ ] encryptField/decryptField using AES-256-GCM + envelope encryption.
- [ ] Random 12-byte IV per encryption call.
- [ ] GCM authTag stored and verified on decryption.
- [ ] Data key cached in Lambda memory; zeroed after use.
- [ ] Plaintext field never written to DynamoDB, never logged.
- [ ] KMS key policy grants only GenerateDataKey + Decrypt to Lambda role.
```
````
