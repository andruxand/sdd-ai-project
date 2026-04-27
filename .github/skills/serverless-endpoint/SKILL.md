````skill
---
name: serverless-endpoint
description: Implement a Serverless endpoint with validation, observability, and rollback awareness.
---

## Context
Stack: AWS Lambda + Serverless Framework v4 + Node.js/TypeScript.
Middleware: middy (mandatory) with `@middy/core`, `@middy/http-json-body-parser`,
  `@middy/http-error-handler`, `@middy/validator`.
Observability: AWS Powertools for Lambda (mandatory) — Logger, Tracer, Metrics.
  Powertools Tracer wraps X-Ray. If `serverless-plugin-datadog` is active, Datadog
  collects and forwards traces and logs automatically — no additional dd-trace setup required.
Validation: Zod (mandatory input schema) + middy validator middleware.
Clients: AWS SDK clients (DynamoDB, S3, SQS, etc.) MUST be initialized at module
  level outside the handler. Required env vars MUST be validated at module load.

## Handler structure
1. Entry point: thin handler that wires middleware and delegates to use-case/service layer.
2. Business logic: never in the handler itself — extract to `src/usecases/` or `src/services/`.
3. Validate input early using schema (zod, joi, or middy validator).
4. Return consistent response shapes: `{ statusCode, body: JSON.stringify({ ... }) }`.

## Checklist before implementation
- [ ] Confirm endpoint path, method, and auth type from OpenSpec proposal/design.
- [ ] If middy is used: add `httpJsonBodyParser`, `validator`, `httpErrorHandler` middlewares.
- [ ] If middy is not used: validate input manually before business logic.
- [ ] Define IAM permissions in `serverless.ts` at function level (not provider-wide).
- [ ] Add `logRetentionInDays` if not inherited from provider.

## Input validation
- Define a **Zod schema** for every input surface (body, path params, query params).
- Integrate the schema with middy `validator` middleware for automatic early rejection.
- Reject unknown fields when strict mode is appropriate (`z.object({}).strict()`).
- Never trust client input for auth decisions — verify JWT/API key server-side.
- Sanitize inputs that will appear in logs or error messages.

## Error handling
- Catch domain errors and map to appropriate HTTP status codes.
- Never leak stack traces, internal paths, or sensitive data in error responses.
- Log full error context server-side with correlation ID.
- Return generic message to client: `{ message: "..." }` without internals.

## Observability
- Use **Powertools Logger**: structured JSON logs with correlationId, action, userId (if available), duration.
  Inject via `injectLambdaContext` middy middleware (sets requestId, cold start, etc.).
- Use **Powertools Tracer**: wraps X-Ray automatically. Use `captureLambdaHandler` middleware.
  Annotate key operations with `tracer.putAnnotation()` and `tracer.putMetadata()`.
- Use **Powertools Metrics**: emit custom business metrics via `logMetrics` middleware.
  Always include `service` and `environment` dimensions.
- If `serverless-plugin-datadog` is active: Datadog Extension Layer forwards logs and traces.
  No separate `dd-trace` import is needed.
- **Never log**: PII, tokens, passwords, full request bodies with sensitive fields.

## Idempotency

Every write operation (insert, update, delete, send message) MUST use Powertools
idempotency middleware. See `docs/standards/aws-architecture.md` for the full
DynamoDB persistence layer setup.

```typescript
import { makeHandlerIdempotent, IdempotencyConfig } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';

const store = new DynamoDBPersistenceLayer({ tableName: process.env.IDEMPOTENCY_TABLE_NAME! });
const config = new IdempotencyConfig({ expiresAfterSeconds: 3600, useLocalCache: true });

export const handler = middy(makeHandlerIdempotent(myHandler, { persistenceStore: store, config }));
````

## Feature flags

Any user-visible behavior change that cannot be instantly reverted by config MUST be
gated behind a feature flag. See `docs/standards/feature-flags.md` for tier selection.

## Contract impact

- If this is a new endpoint: update OpenAPI spec or GraphQL schema.
- If modifying existing: run contract diff (oasdiff / GraphQL Inspector).
- Breaking changes require explicit approval and versioning strategy.

## Security

- Apply least-privilege IAM role.
- Validate authorization in handler or middleware (not only at API Gateway level).
- If using API key: rotate strategy must be documented.
- If using JWT: validate signature, expiration, issuer, and audience.
- Review WAF rules if endpoint is public-facing.

## Rollback considerations

- Can this endpoint be disabled via feature flag or API Gateway stage?
- If it writes data: what happens if we revert the code but data was already written?
- Document rollback path in OpenSpec tasks.

## Anti-patterns

- Do NOT put business logic directly in handler function.
- Do NOT use `*` in IAM permissions.
- Do NOT log `event` or `context` objects directly (may contain secrets).
- Do NOT hardcode stage, region, or account IDs.
- Do NOT skip input validation "because API Gateway handles it" — defense in depth.

## Testing

- Unit test the use-case/service layer independently.
- Integration test the handler with mocked AWS services.
- Test validation: valid input, missing fields, extra fields, boundary values.
- Test error paths: unauthorized, not found, validation error, internal error.

```

```
