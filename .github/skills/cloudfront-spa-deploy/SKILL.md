# Skill: cloudfront-spa-deploy

> Source: AWS CloudFront documentation, AWS S3 + OAC guide, AWS Well-Architected best practices
> Type: **conditional-active** — loaded by `@frontend-implementer` when the feature requires deploying or updating the SPA on CloudFront + S3.

## Purpose

Provide implementation knowledge for deploying a **Vite + React SPA** (and optionally Next.js static export) to S3 + CloudFront with Origin Access Control (OAC). Covers bucket policy, cache behavior strategy, SPA 404→200 error rewrite, cache invalidation, and `serverless.ts` CloudFormation resource patterns.

> **This project uses Vite, not Next.js.** Build output is `npm run build --workspace=apps/web` → `apps/web/dist/`. Do NOT use `next export`, `output: 'export'`, or `next.config.ts` patterns in this project.

## When to activate

Activate this skill when a feature or task involves:

- Deploying the `apps/web` Vite build output (`dist/`) to S3 + CloudFront
- Configuring CDN cache headers for a frontend SPA
- Setting up or updating a CloudFront distribution for a web application

---

## OAC vs OAI — important distinction

**Origin Access Control (OAC) is the current standard.** Origin Access Identity (OAI) is deprecated since 2022 and should NOT be used in new deployments.

| Feature               | OAC                  | OAI (deprecated) |
| --------------------- | -------------------- | ---------------- |
| AWS signature version | SigV4                | SigV4 (limited)  |
| SSE-KMS support       | ✅ Yes               | ❌ No            |
| HTTP methods          | All                  | GET/HEAD only    |
| Status                | Current, recommended | Deprecated       |

---

## S3 Bucket configuration

```typescript
// CloudFormation/CDK resource in serverless.ts
resources: {
  Resources: {
    FrontendBucket: {
      Type: 'AWS::S3::Bucket',
      Properties: {
        BucketName: '${self:service}-${self:provider.stage}-frontend',
        // Block ALL public access — OAC handles access from CloudFront
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      },
    },

    // OAC for CloudFront → S3 access
    FrontendOAC: {
      Type: 'AWS::CloudFront::OriginAccessControl',
      Properties: {
        OriginAccessControlConfig: {
          Name: '${self:service}-${self:provider.stage}-oac',
          OriginAccessControlOriginType: 's3',
          SigningBehavior: 'always',
          SigningProtocol: 'sigv4',
        },
      },
    },

    // Bucket policy: allow CloudFront OAC to read objects
    FrontendBucketPolicy: {
      Type: 'AWS::S3::BucketPolicy',
      Properties: {
        Bucket: { Ref: 'FrontendBucket' },
        PolicyDocument: {
          Statement: [{
            Sid: 'AllowCloudFrontServicePrincipal',
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
            Resource: { 'Fn::Sub': '${FrontendBucket.Arn}/*' },
            Condition: {
              StringEquals: {
                // Restrict to THIS CloudFront distribution only
                'AWS:SourceArn': {
                  'Fn::Sub': 'arn:aws:cloudfront::${AWS::AccountId}:distribution/${FrontendDistribution}',
                },
              },
            },
          }],
        },
      },
    },
  },
},
```

---

## CloudFront distribution configuration

```typescript
FrontendDistribution: {
  Type: 'AWS::CloudFront::Distribution',
  Properties: {
    DistributionConfig: {
      Enabled: true,
      DefaultRootObject: 'index.html',
      Origins: [{
        Id: 'S3Origin',
        DomainName: { 'Fn::GetAtt': ['FrontendBucket', 'RegionalDomainName'] },
        OriginAccessControlId: { 'Fn::GetAtt': ['FrontendOAC', 'Id'] },
        S3OriginConfig: { OriginAccessIdentity: '' }, // Empty string required with OAC
      }],
      DefaultCacheBehavior: {
        TargetOriginId: 'S3Origin',
        ViewerProtocolPolicy: 'redirect-to-https',
        Compress: true,
        CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // CachingDisabled (for index.html)
        AllowedMethods: ['GET', 'HEAD'],
        CachedMethods: ['GET', 'HEAD'],
      },
      CacheBehaviors: [
        {
          // Hashed static assets — cache forever
          PathPattern: '/_next/static/*',
          TargetOriginId: 'S3Origin',
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
        },
        {
          // Static media in /public
          PathPattern: '/static/*',
          TargetOriginId: 'S3Origin',
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
        },
      ],
      // SPA routing: return index.html for all 403/404 from S3
      // S3 returns 403 (not 404) for missing objects when bucket is private
      CustomErrorResponses: [
        {
          ErrorCode: 403,
          ResponseCode: 200,
          ResponsePagePath: '/index.html',
          ErrorCachingMinTTL: 0,
        },
        {
          ErrorCode: 404,
          ResponseCode: 200,
          ResponsePagePath: '/index.html',
          ErrorCachingMinTTL: 0,
        },
      ],
    },
  },
},
```

### Managed cache policy IDs (no need to create custom)

| Policy             | ID                                     | Use for                       |
| ------------------ | -------------------------------------- | ----------------------------- |
| `CachingDisabled`  | `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` | `index.html`, dynamic content |
| `CachingOptimized` | `658327ea-f89d-4fab-a63d-7e88639e58f6` | Hashed static assets          |

---

## Cache-Control headers strategy

Set these headers on the S3 objects at upload time (or via CloudFront response headers policy):

| Asset              | Cache-Control                         | Rationale                                           |
| ------------------ | ------------------------------------- | --------------------------------------------------- |
| `index.html`       | `no-cache, no-store, must-revalidate` | Must always fetch fresh to get current chunk hashes |
| `/_next/static/**` | `public, max-age=31536000, immutable` | Content-addressed hashes — safe to cache forever    |
| `/static/**`       | `public, max-age=86400`               | Public media assets — 1 day cache                   |
| `/favicon.ico`     | `public, max-age=86400`               |                                                     |

Apply at deploy time via AWS CLI:

```bash
# Upload hashed static assets with long-lived cache
aws s3 sync out/_next/static s3://$BUCKET/_next/static \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

# Upload everything else (including index.html) with no-cache
aws s3 sync out s3://$BUCKET \
  --cache-control "no-cache, no-store, must-revalidate" \
  --exclude "_next/static/*" \
  --delete
```

---

## Cache invalidation after deploy

Always invalidate the CloudFront cache after deploying new frontend assets:

```bash
# Invalidate all paths (/* covers everything)
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/*"
```

For smaller invalidations (avoid cost on large sites):

```bash
# Invalidate only HTML files
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/index.html" "/404.html"
```

**Cost note:** Each invalidation path counts against the 1,000 free invalidation paths per month. `/*` counts as 1 path.

---

## GitHub Actions deploy workflow

```yaml
# .github/workflows/deploy-frontend.yml
name: Deploy Frontend
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - run: npm ci
      - run: npm run build
        working-directory: apps/web

      # Upload static assets first with immutable cache
      - name: Upload static assets
        run: |
          aws s3 sync apps/web/out/_next/static \
            s3://${{ secrets.FRONTEND_BUCKET }}/_next/static \
            --cache-control "public, max-age=31536000, immutable" \
            --delete
        env:
          AWS_REGION: ${{ vars.AWS_REGION }}

      # Upload remaining files with no-cache
      - name: Upload app files
        run: |
          aws s3 sync apps/web/out s3://${{ secrets.FRONTEND_BUCKET }} \
            --cache-control "no-cache, no-store, must-revalidate" \
            --exclude "_next/static/*" \
            --delete
        env:
          AWS_REGION: ${{ vars.AWS_REGION }}

      # Invalidate CloudFront cache
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
        env:
          AWS_REGION: ${{ vars.AWS_REGION }}
```

---

## SPA routing explanation

When a user navigates directly to `https://example.com/dashboard/settings`, the browser requests the S3 object at key `dashboard/settings/index.html` or `dashboard/settings`. This object doesn't exist in the bucket → S3 returns **403** (private bucket) or **404**.

CloudFront's `CustomErrorResponses` intercepts these and returns `index.html` with HTTP 200, allowing the SPA router (React Router / Next.js Router) to handle the route client-side.

**Important:** Use `ErrorCachingMinTTL: 0` on the error response to prevent CloudFront from caching 200-as-error responses (which would cause stale deployments).

---

## DO / DON'T

| ✅ DO                                           | ❌ DON'T                                      |
| ----------------------------------------------- | --------------------------------------------- |
| Use OAC for CloudFront → S3 access              | Use OAI (deprecated)                          |
| Block all public access on the S3 bucket        | Make the S3 bucket publicly accessible        |
| Use `AWS:SourceArn` condition in bucket policy  | Use `Principal: "*"` in S3 policy             |
| Set `immutable` cache on hashed static assets   | Use the same cache policy for all asset types |
| Set `no-cache` on `index.html`                  | Cache `index.html` (breaks deploys)           |
| Run `/* invalidation` after every deploy        | Deploy without invalidating the cache         |
| Handle both 403 and 404 in CustomErrorResponses | Handle only 404 (private S3 returns 403)      |
