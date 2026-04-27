```skill
---
name: s3-storage-patterns
description: AWS S3 patterns for Lambda — pre-signed URLs, upload/download, bucket policies, SSE-KMS encryption, lifecycle rules, and testing. Apply when any feature involves file storage or retrieval.
type: conditional-active
agents: [backend-implementer, tester-backend]
condition: Load when the feature stores, retrieves, or manages files. Covers pre-signed URLs, direct upload patterns, and bucket configuration.
---

## When to use which access pattern

```

User uploads a file → Pre-signed PUT URL (browser uploads directly to S3, Lambda not in the data path)
User downloads a file → Pre-signed GET URL (time-limited, no public bucket needed)
Lambda generates file → PutObject from Lambda directly (reports, exports, thumbnails)
Lambda reads a file → GetObject from Lambda directly (parsing, processing)
Public static assets → CloudFront + OAC (no public S3 bucket) — see cloudfront-spa-deploy skill

````

Never expose an S3 bucket publicly. All client access goes through pre-signed URLs or CloudFront.

---

## Infrastructure — bucket definition (serverless.ts)

```typescript
// serverless.ts — resources section
resources: {
  Resources: {
    UploadsBucket: {
      Type: 'AWS::S3::Bucket',
      Properties: {
        BucketName: '${self:service}-uploads-${sls:stage}',
        // ✅ Block all public access
        PublicAccessBlockConfiguration: {
          BlockPublicAcls:       true,
          BlockPublicPolicy:     true,
          IgnorePublicAcls:      true,
          RestrictPublicBuckets: true,
        },
        // ✅ SSE-KMS encryption at rest
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [{
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms',
              KMSMasterKeyID: { 'Fn::GetAtt': ['DataKey', 'Arn'] },
            },
            BucketKeyEnabled: true, // reduces KMS API calls + cost
          }],
        },
        // ✅ Versioning — enables rollback and audit trail
        VersioningConfiguration: { Status: 'Enabled' },
        // ✅ Lifecycle — move old versions to Glacier or delete
        LifecycleConfiguration: {
          Rules: [{
            Id: 'ExpireNonCurrentVersions',
            Status: 'Enabled',
            NoncurrentVersionExpiration: { NoncurrentDays: 90 },
          }, {
            Id: 'AbortIncompleteMultipartUploads',
            Status: 'Enabled',
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          }],
        },
        // ✅ CORS — only allow your frontend domain
        CorsConfiguration: {
          CorsRules: [{
            AllowedHeaders: ['Content-Type', 'Content-Length', 'x-amz-checksum-*'],
            AllowedMethods: ['PUT'],
            AllowedOrigins: ['${env:FRONTEND_ORIGIN}'],
            MaxAge: 3000,
          }],
        },
      },
    },
  },
},
````

---

## Pre-signed PUT URL — browser direct upload

```typescript
// application/use-cases/getUploadUrl.ts
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// Singleton S3 client — reuse across invocations
const s3 = new S3Client({ region: process.env.AWS_REGION });

const BUCKET = process.env.UPLOADS_BUCKET_NAME!;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const GetUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z
    .string()
    .refine((v) => ALLOWED_CONTENT_TYPES.has(v), 'Unsupported content type'),
  userId: z.string().min(1),
});

type GetUploadUrlInput = z.infer<typeof GetUploadUrlSchema>;

export async function getUploadUrlUseCase(input: GetUploadUrlInput) {
  GetUploadUrlSchema.parse(input); // validate at use case boundary

  const key = `users/${input.userId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: input.contentType,
    // ✅ Enforce content-length limit via condition
    // (combine with Lambda validation on the metadata endpoint)
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes

  return {
    uploadUrl: url,
    key,
    expiresIn: 300,
  };
}

function sanitizeFileName(name: string): string {
  // Remove path separators and dangerous characters
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}
```

---

## Pre-signed GET URL — time-limited download

```typescript
// application/use-cases/getDownloadUrl.ts
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function getDownloadUrlUseCase(key: string, userId: string) {
  // ✅ Authorize: verify the user owns this key before generating URL
  if (!key.startsWith(`users/${userId}/`)) {
    throw new ForbiddenError('Access denied to this file');
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${key.split('/').pop()}"`,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 seconds for download
  return { downloadUrl: url };
}
```

**Pre-signed URL security rules:**

- Always authorize the requesting user owns the key **before** generating the URL.
- Expiry: PUT = 5 min, GET = 60 s (shorter = less exploit window if URL leaks).
- Never return a pre-signed URL for a key derived from user input without validation.
- File key must include `userId` prefix enforced by code — not trusted from input.

---

## Lambda direct write — generating files

```typescript
// application/use-cases/exportReport.ts
import { PutObjectCommand } from '@aws-sdk/client-s3';

export async function exportReportUseCase(reportId: string, data: ReportData) {
  const csv = generateCsv(data);
  const key = `reports/${reportId}/export-${Date.now()}.csv`;
  const bytes = Buffer.from(csv, 'utf-8');

  await s3.send(
    new PutObjectCommand({
      Bucket: BUDGET_REPORTS_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: 'text/csv; charset=utf-8',
      ContentDisposition: `attachment; filename="report-${reportId}.csv"`,
      ServerSideEncryption: 'aws:kms', // ✅ explicit even when bucket default is set
      Tagging: `reportId=${reportId}&stage=${process.env.STAGE}`,
    }),
  );

  return { key };
}
```

---

## Lambda direct read — processing files

```typescript
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export async function processFileUseCase(key: string) {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );

  if (!response.Body) throw new NotFoundError(`File not found: ${key}`);

  // ✅ Stream to string (small files < 6 MB in Lambda)
  const body = await response.Body.transformToString();

  // ✅ For large files — stream and process chunks
  // const stream = response.Body as Readable;
  // for await (const chunk of stream) { process(chunk); }

  return JSON.parse(body);
}
```

---

## IAM — least privilege per function

```typescript
// serverless.ts — per-function IAM (never use provider-level wildcards)
functions: {
  getUploadUrl: {
    handler: 'src/infrastructure/http/handlers/getUploadUrl.handler',
    iamRoleStatements: [{
      Effect:   'Allow',
      Action:   ['s3:PutObject'],
      Resource: [{ 'Fn::Join': ['', [{ 'Fn::GetAtt': ['UploadsBucket', 'Arn'] }, '/users/*']] }],
    }],
  },
  processFile: {
    handler: 'src/infrastructure/http/handlers/processFile.handler',
    iamRoleStatements: [{
      Effect:   'Allow',
      Action:   ['s3:GetObject'],
      Resource: [{ 'Fn::Join': ['', [{ 'Fn::GetAtt': ['UploadsBucket', 'Arn'] }, '/*']] }],
    }],
  },
}
```

---

## S3 event trigger (Lambda on upload)

```typescript
// serverless.ts
functions: {
  processUpload: {
    handler: 'src/infrastructure/http/handlers/processUpload.handler',
    events: [{
      s3: {
        bucket:  { Ref: 'UploadsBucket' },
        event:   's3:ObjectCreated:*',
        rules:   [{ prefix: 'users/' }, { suffix: '.pdf' }], // filter by prefix/suffix
        existing: false,
      },
    }],
  },
}
```

---

## Testing S3 interactions

```typescript
// Use @aws-sdk/client-s3 mock — no real S3 calls in tests
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream';
import { Readable } from 'node:stream';

const s3Mock = mockClient(S3Client);

beforeEach(() => s3Mock.reset());

it('generates a pre-signed PUT URL with correct key format', async () => {
  s3Mock.on(PutObjectCommand).resolves({});

  const result = await getUploadUrlUseCase({
    fileName: 'photo.jpg',
    contentType: 'image/jpeg',
    userId: 'usr_123',
  });

  expect(result.key).toMatch(/^users\/usr_123\//);
  expect(result.uploadUrl).toBeDefined();
  expect(result.expiresIn).toBe(300);
});

it('getObject returns file body', async () => {
  const stream = sdkStreamMixin(Readable.from(['{"ok":true}']));
  s3Mock.on(GetObjectCommand).resolves({ Body: stream });

  const result = await processFileUseCase('users/usr_1/file.json');
  expect(result).toEqual({ ok: true });
});
```

---

## Anti-patterns

| Anti-pattern                             | Problem                                   | Fix                                                        |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| Public S3 bucket                         | Data breach                               | Block public access + CloudFront OAC                       |
| Pre-signed URL without ownership check   | IDOR — user can access other users' files | Verify `key.startsWith('users/${userId}/')`                |
| File key derived from user-supplied path | Path traversal                            | Sanitize + UUID prefix                                     |
| No content-type allowlist                | Malicious file upload                     | Validate allowed MIME types                                |
| New S3Client per invocation              | Cold start + connection overhead          | Singleton client at module level                           |
| Storing files > 10 MB in Lambda /tmp     | Ephemeral, memory pressure                | Stream directly from S3                                    |
| No lifecycle rules                       | Storage cost grows unbounded              | Add noncurrent version expiry + incomplete multipart abort |
| PutObject without explicit SSE           | Depends on bucket default being set       | Always specify `ServerSideEncryption: 'aws:kms'`           |

---

## Checklist

- [ ] Bucket blocks all public access.
- [ ] SSE-KMS encryption with `BucketKeyEnabled: true`.
- [ ] Versioning enabled.
- [ ] Lifecycle rules: noncurrent version expiry + incomplete multipart abort.
- [ ] CORS restricted to known frontend origin.
- [ ] Pre-signed PUT: expiry ≤ 5 min, content-type validated, MIME allowlisted.
- [ ] Pre-signed GET: expiry ≤ 60 s, ownership verified before generating URL.
- [ ] File keys use `userId` prefix enforced by use case code.
- [ ] File names sanitized before use in key.
- [ ] IAM scoped to specific key prefix per Lambda function.
- [ ] `aws-sdk-client-mock` used in tests — no real S3 calls.

```

```
