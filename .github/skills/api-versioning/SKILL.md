````skill
---
name: api-versioning
description: Design and implement URL-based API versioning, deprecation, and migration for REST APIs.
---

## Versioning strategy (per docs/standards/serverless-v4.md)

URL-based versioning (`/v1/`, `/v2/`) is **mandatory** for public or
consumer-facing APIs. Header-based versioning is only allowed for
internal service-to-service APIs.

| Change type | Version bump required? |
|---|---|
| Removing a field from response | ✅ Yes — breaking |
| Changing a field's type | ✅ Yes — breaking |
| Removing an endpoint | ✅ Yes — breaking |
| Making an optional field required | ✅ Yes — breaking |
| Changing auth requirements | ✅ Yes — breaking |
| Changing status code semantics | ✅ Yes — breaking |
| Adding optional fields to response | ❌ No — additive |
| Adding new optional query params | ❌ No — additive |
| Adding a new endpoint | ❌ No — additive |

**Rule**: start at `/v1/`. Increment only on breaking changes.
Additive changes are backward-compatible — no version bump needed.

## Implementation in serverless.ts

Route both versions to separate handlers. Handlers share the same
use case layer — only the input/output mapping differs:

```typescript
// serverless.ts
functions:
  getUserV1:
    handler: src/handlers/users/get-v1.handler
    events:
      - httpApi:
          path: /v1/users/{id}
          method: GET
          authorizer:
            name: cognitoAuthorizer

  getUserV2:
    handler: src/handlers/users/get-v2.handler
    events:
      - httpApi:
          path: /v2/users/{id}
          method: GET
          authorizer:
            name: cognitoAuthorizer
````

Handler structure — use case is shared, only mapping differs:

```typescript
// src/handlers/users/get-v1.handler.ts
import { getUserById } from '../../usecases/users/get-user.usecase';

export const handler = async (event) => {
  const { userId } = pathParamsSchema.parse(event.pathParameters);
  const user = await getUserById(userId);

  // v1 response shape — legacy, flat structure
  return {
    statusCode: 200,
    headers: {
      // Add deprecation headers on deprecated versions
      Deprecation: 'true',
      Sunset: 'Sat, 01 Oct 2026 00:00:00 GMT',
      Link: '</v2/users/{id}>; rel="successor-version"',
    },
    body: JSON.stringify({
      id: user.id,
      name: user.profile.fullName, // v1 flattened field
      email: user.email,
    }),
  };
};

// src/handlers/users/get-v2.handler.ts
export const handler = async (event) => {
  const { userId } = pathParamsSchema.parse(event.pathParameters);
  const user = await getUserById(userId);

  // v2 response shape — structured profile object
  return {
    statusCode: 200,
    body: JSON.stringify({
      id: user.id,
      profile: {
        // v2 nested structure (the breaking change)
        fullName: user.profile.fullName,
        avatarUrl: user.profile.avatarUrl,
      },
      email: user.email,
    }),
  };
};
```

## OpenAPI spec — versioned paths and deprecation

```yaml
# packages/contracts/rest/paths/users.yaml

/v1/users/{id}:
  get:
    summary: Get user by ID (deprecated)
    deprecated: true
    description: |
      **Deprecated.** Use `/v2/users/{id}` instead.
      This endpoint will be removed on **2026-10-01**.
      Migration guide: the `name` field is now nested under `profile.fullName`.
    parameters:
      - $ref: '../components/parameters.yaml#/UserIdParam'
    responses:
      '200':
        description: User found
        headers:
          Deprecation:
            schema: { type: string }
          Sunset:
            schema: { type: string }
        content:
          application/json:
            schema:
              $ref: '../components/schemas/v1/UserV1Response.yaml'
      '404':
        $ref: '../components/responses.yaml#/NotFound'

/v2/users/{id}:
  get:
    summary: Get user by ID
    parameters:
      - $ref: '../components/parameters.yaml#/UserIdParam'
    responses:
      '200':
        description: User found
        content:
          application/json:
            schema:
              $ref: '../components/schemas/v2/UserV2Response.yaml'
      '404':
        $ref: '../components/responses.yaml#/NotFound'
```

## Deprecation lifecycle (90-day minimum)

```
Day 0   — v2 released. v1 marked deprecated=true in OpenAPI.
Day 1   — v1 responses include Deprecation + Sunset + Link headers.
Day 0-90 — Monitor v1 traffic in CloudWatch/Datadog. Notify consumers.
Day 90  — v1 sunset. Remove handler. Return 410 Gone.
```

### 410 Gone handler (after sunset date)

```typescript
// src/handlers/users/get-v1-sunset.handler.ts
export const handler = async () => ({
  statusCode: 410,
  body: JSON.stringify({
    error: 'This endpoint has been removed. Use /v2/users/{id} instead.',
    code: 'GONE',
    migrationGuide: 'https://docs.example.com/api/migration/v1-to-v2',
  }),
});
```

Keep the `serverless.ts` route pointing to this sunset handler until all
consumers have migrated. Remove the route entirely 6+ months after sunset.

## Deprecation response headers (RFC 8594)

Add to all deprecated endpoint responses:

```typescript
headers: {
  'Deprecation': 'true',
  // RFC 7231 HTTP date format
  'Sunset': new Date('2026-10-01').toUTCString(),
  // Link header — RFC 8288
  'Link': `</v2/users/${userId}>; rel="successor-version"`,
}
```

Consumers monitoring `Deprecation: true` headers can automate migration alerts.

## Monitoring versioned traffic

Track v1 vs v2 usage to know when it is safe to sunset v1:

```typescript
// In the deprecated v1 handler
metrics.addMetric({
  name: 'ApiV1Usage',
  unit: MetricUnits.Count,
  value: 1,
  defaultDimensions: { endpoint: 'GET /v1/users/{id}' },
});
```

Create a CloudWatch alarm: when `ApiV1Usage` count drops to 0 for 7 days,
the endpoint is safe to sunset.

## Internal service-to-service APIs (header versioning allowed)

For private APIs consumed only by services you control:

```typescript
// Consumer sends:
// Accept: application/vnd.my-service.v2+json

// Handler reads:
const acceptHeader = event.headers['accept'] ?? '';
const isV2 = acceptHeader.includes('v2');
```

Still maintain backward compatibility for the deprecation period.

## Anti-patterns

- ❌ Breaking changes in the same version — consumers break silently.
- ❌ `v1` and `v2` sharing the same handler with `if (version === ...)` branching — hard to deprecate cleanly.
- ❌ Removing a versioned endpoint without returning 410 — consumers get connection errors instead of a clear message.
- ❌ Query parameter versioning (`?version=2`) — not REST-idiomatic, harder to route at Gateway level.
- ❌ No `Sunset` header on deprecated endpoints — consumers don't know the deadline.
- ❌ Version in the domain (`v1.api.example.com`) — harder infrastructure to manage, same cons as header versioning.

## Checklist

- [ ] New endpoints start at `/v1/`.
- [ ] Breaking changes introduce a new version path (`/v2/`).
- [ ] v1 and v2 handlers share the same use case — only mapping differs.
- [ ] Deprecated versions have `deprecated: true` in OpenAPI spec.
- [ ] Deprecated endpoints return `Deprecation`, `Sunset`, and `Link` headers.
- [ ] Sunset date is 90+ days from deprecation announcement.
- [ ] After sunset: handler returns `410 Gone` with migration guide URL.
- [ ] `ApiV1Usage` custom metric tracked to confirm migration completion.
- [ ] OpenSpec design section documents versioning strategy and migration plan.

```

```
