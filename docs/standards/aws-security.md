# AWS Security Standards

## Secrets management

- NEVER store secrets in code, environment variables (plaintext), logs, comments, or test fixtures.
- Use AWS SSM Parameter Store (SecureString) or Secrets Manager.
- Rotate secrets regularly; document rotation strategy.
- Use `.env.example` to document expected variables without real values.

## IAM

- Apply least-privilege: scope permissions to the specific resource ARN.
- No wildcard (`*`) permissions without written justification approved by tech lead.
- Define IAM at function level in `serverless.ts`, not at provider level.
- Review IAM changes in every PR that touches `serverless.ts` or `infra/`.

## API Gateway

- Enable throttling with sensible defaults.
- Use appropriate auth: Cognito authorizer, Lambda authorizer, or API key.
- Enable request validation at Gateway level as first defense layer.
- Apply WAF rules for public-facing endpoints.

## Authentication & Authorization

- JWT validation: check signature, expiration, issuer, audience.
- Validate auth at handler level too (defense in depth), not only API Gateway.
- API keys: document rotation strategy and scope.
- Never expose tokens in logs or error responses.

## Encryption

- Encryption in transit: HTTPS enforced (API Gateway default).
- Encryption at rest: enable for DynamoDB, S3, SQS, and any data store.
- Use AWS-managed keys unless customer-managed keys are required.

## Input validation

- Validate all external inputs (path params, query, headers, body).
- Reject unknown fields when appropriate.
- Protect against injection (SQL, NoSQL, command, path traversal).

## Domain error classes

Do not throw generic `Error('something failed')`. Use a typed error hierarchy so
that handlers can distinguish operational errors (expected, map to HTTP 4xx/5xx)
from programming errors (unexpected, should alert).

```typescript
// services/api/src/errors/index.ts

export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly isOperational = true; // expected error — do not alert

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class ValidationError extends DomainError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class UnauthorizedError extends DomainError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
}

export class ForbiddenError extends DomainError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
}

export class ConflictError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

export class InternalError extends DomainError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';
  override readonly isOperational = false; // unexpected — should alert
}
```

In the handler error boundary:

```typescript
import { DomainError } from '../errors';

function toHttpError(error: unknown) {
  if (error instanceof DomainError) {
    logger.warn('Domain error', {
      code: error.code,
      message: error.message,
      context: error.context,
    });
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({ code: error.code, message: error.message }),
    };
  }
  // Programming error — log full stack, return generic 500
  logger.error('Unexpected error', { error });
  return {
    statusCode: 500,
    body: JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }),
  };
}
```

- **Never** include stack traces, internal paths, or service names in responses.
- `isOperational: false` errors should trigger an alert (Datadog monitor or CloudWatch alarm).

## OWASP Top 10 — mandatory controls

Every PR touching auth, data handling, or public endpoints must be reviewed against
the [OWASP Top 10](https://owasp.org/www-project-top-ten/):

| #   | Risk                      | Control required                                                               |
| --- | ------------------------- | ------------------------------------------------------------------------------ |
| A01 | Broken Access Control     | Authorization at handler level (not only Gateway). Least-privilege IAM.        |
| A02 | Cryptographic Failures    | Encryption at rest + in transit. No plaintext secrets anywhere.                |
| A03 | Injection                 | Zod/schema validation on all inputs. Parameterized queries (no string concat). |
| A04 | Insecure Design           | Threat model documented in OpenSpec design for high-risk features.             |
| A05 | Security Misconfiguration | IaC scanned (cfn-lint, checkov). No wildcard IAM. WAF enabled.                 |
| A06 | Vulnerable Components     | `npm audit` in CI. Dependabot alerts active. `dependency-review` on PRs.       |
| A07 | Auth Failures             | JWT: validate signature + expiry + issuer + audience. MFA for admin paths.     |
| A08 | Software/Data Integrity   | `dependency-review` on PRs. Signed commits enforced. Changeset integrity.      |
| A09 | Logging Failures          | Powertools Logger mandatory. No PII in logs. DLQ alerts on data loss.          |
| A10 | SSRF                      | Validate and allowlist all outbound URLs. Never fetch user-provided URLs.      |

The `@security` agent references this table in every high-risk PR review.

## Anti-patterns

- Do NOT log `event` or `context` objects directly.
- Do NOT use hardcoded credentials.
- Do NOT expose internal error details to clients.
- Do NOT deploy with `*` IAM permissions.
- Do NOT skip WAF for public endpoints.
- Do NOT throw generic `Error('...')` — use domain error classes.
- Do NOT fetch user-provided URLs without allowlist validation (SSRF).

## Checklist

- [ ] No secrets in code or logs.
- [ ] IAM least-privilege applied.
- [ ] Auth validated at handler level.
- [ ] Encryption at rest and in transit.
- [ ] Input validation on all external inputs.
- [ ] WAF rules reviewed for public endpoints.
- [ ] Domain error classes used (no generic `Error`).
- [ ] OWASP Top 10 reviewed for high-risk features.
- [ ] Outbound URL fetches allowlisted (SSRF prevention).
