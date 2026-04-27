````skill
---
name: backend-task-execution
description: Execute one approved backend task group and report risks and rollback implications.
---

## Context
Stack: AWS Lambda + Serverless Framework v4 + Node.js/TypeScript.
Architecture: **DDD + Hexagonal (Ports & Adapters)**.
Observability: `@aws-lambda-powertools/logger` + `tracer` + `metrics` (all mandatory).
Middleware: Middy for Lambda middleware composition.

## Layer map — where does each file go?

```
services/api/src/
  domain/               Zero AWS deps. Pure business logic.
    entities/           Aggregate roots. Created via static factory methods.
    value-objects/      Immutable types (Email, Money, OrderId…)
    events/             Domain events raised by aggregates.
    errors/             DomainError base + typed subclasses.
    repositories/       Repository INTERFACES only (ports).
  application/          Orchestrates domain. No AWS imports.
    use-cases/          One use case = one file. Accepts DTO, returns DTO.
    dtos/               Input/output shapes (not domain types, not API types).
    ports/              Additional interfaces (EmailPort, EventBusPort…)
  infrastructure/       ONLY layer with AWS SDK. Implements ports.
    adapters/           DynamoRepository, CognitoAdapter, SQSEventBus…
    http/               Lambda handlers — thin Middy wiring, max ~30 lines.
    config/             Env validation at module load (fail-fast).
  shared/               Observability singletons, error-mapper, utils.
```

## Dependency rule

`infrastructure` → `application` → `domain`
Outer layers import inner layers. **Inner layers NEVER import outer layers.**

## Pre-conditions
- Task group must be explicitly approved in OpenSpec tasks.
- Read the proposal, design, and related specs before starting.

## Observability (mandatory)
- Use Powertools Logger: `injectLambdaContext` Middy middleware + `logger.appendKeys({ correlationId, action })`.
- Use Powertools Tracer: `captureLambdaHandler` Middy middleware + capture all external calls.
- Use Powertools Metrics: `logMetrics` Middy middleware + business metrics with dimensions.
- Never use `console.log`, `console.error`, or raw `aws-xray-sdk`.

## Code craft
- Functions do one thing (Single Responsibility). Keep them short and descriptive.
- Name variables and functions for intent, not implementation (`getUserById` not `fetch`).
- Prefer pure functions for business logic — no side effects in use cases.
- Extract repetitive logic to utilities in `services/api/src/utils/`.
- Use TypeScript strictly: no `any`, explicit return types on all exported functions.
- Errors are first-class: use the `DomainError` class hierarchy from `services/api/src/errors/`.
  Never throw generic `Error('...')`. See `docs/standards/aws-security.md` for the pattern.
- Validate all external input at the handler boundary (never trust `event.body` directly).
- Keep handlers thin: parse → validate → delegate → respond.

## Domain errors

Import and throw typed errors:

```typescript
import { NotFoundError, ValidationError, ForbiddenError } from '../errors';

if (!user) throw new NotFoundError('User not found', { userId });
if (!canAccess) throw new ForbiddenError('Access denied', { userId, resource });
````

The handler error boundary maps `DomainError` subclasses to HTTP status codes
automatically. `isOperational: false` errors (unexpected) trigger alerts.

## Feature flags

For any behavior change that needs a kill switch or gradual rollout:

```typescript
import { getFeatureFlags } from '../utils/feature-flags';

const flags = await getFeatureFlags();
if (!flags['order-processor-enabled']) {
  logger.warn('Feature disabled via flag');
  return {
    statusCode: 503,
    body: JSON.stringify({ message: 'Service temporarily unavailable' }),
  };
}
```

See `docs/standards/feature-flags.md` for tier selection (env var vs AppConfig vs LaunchDarkly).

## Execution rules

1. Implement only the approved task group. If you discover adjacent work, report it — do not implement it.
2. Keep changes small and independently reviewable.
3. Follow existing patterns in the codebase. If no pattern exists, propose one.
4. Separate infrastructure changes (serverless.ts) from business logic changes.

## Structure conventions

- Handlers: `services/api/src/handlers/`
- Use cases: `services/api/src/usecases/` or `services/api/src/services/`
- Types / DTOs: `services/api/src/types/`
- Utilities: `services/api/src/utils/`
- Config: `services/api/src/config/`

## Post-implementation checklist

- [ ] Input validation at handler boundary (Zod schema).
- [ ] Architecture boundaries respected: `infrastructure` → `application` → `domain` only. Run `npm run arch:lint` to verify — violations are ESLint errors.
- [ ] No circular dependencies: `import-x/no-cycle` enforces this in `npm run lint`.
- [ ] Error handling: typed `DomainError` subclasses, no generic `Error`, no leaked internals.
- [ ] Powertools Logger with `injectLambdaContext` and `action` per log.
- [ ] Powertools Tracer with `captureLambdaHandler` and external calls captured.
- [ ] Powertools Metrics with `logMetrics` and business metrics defined.
- [ ] IAM scoped to function level (no wildcards).
- [ ] Write operations: idempotency via Powertools idempotency middleware.
- [ ] Async triggers: DLQ defined and CloudWatch alarm on DLQ depth.
- [ ] Feature flag: kill switch in place if behavior change is rollback-sensitive.
- [ ] Tests: unit for business logic, integration for handler.
- [ ] Contract updated if endpoint shape changed.
- [ ] API version bumped if change is breaking.
- [ ] OpenSpec tasks updated.
- [ ] Docs updated if behavior changed.
- [ ] Rollback impact documented.

## Risk reporting

After completing, report:

- Contract impact: none / additive / breaking.
- Security implications: auth, permissions, PII, IAM changes.
- Rollback risk: safe revert / data implications / needs coordination.
- Dependencies on other task groups.

## Adding dependencies

Before running `npm install` for any package:

1. Load `dependency-vetting` skill.
2. Follow its 8-step protocol: skill lookup → existing dep check → security audit → license → peer deps → skill stub if warranted.
3. After any PR comment about a package's usage, update the package's skill immediately (do not wait for a second occurrence).

## Anti-patterns

- Do NOT implement multiple task groups in one pass.
- Do NOT modify shared packages without explicit approval.
- Do NOT add dependencies without running `dependency-vetting` protocol.
- Do NOT skip tests "because it is a small change."
- Do NOT install a package without running `npm audit --audit-level=high` after.

```

```
