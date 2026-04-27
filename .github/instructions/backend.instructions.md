---
applyTo: 'services/**/*.ts'
---

# Backend Instructions

## Architecture: DDD + Hexagonal

The backend follows **Domain-Driven Design** with a **Hexagonal (Ports & Adapters)** structure.
Every piece of code belongs to exactly one layer:

```
services/api/src/
  domain/               Pure business logic. Zero AWS/framework deps.
    entities/           Aggregate roots and domain entities
    value-objects/      Immutable value types (Email, Money, OrderId…)
    events/             Domain events emitted by aggregates
    errors/             DomainError base + typed subclasses (NotFoundError, etc.)
    repositories/       Repository INTERFACES (ports) — NOT implementations
  application/          Orchestrates domain. Framework-agnostic.
    use-cases/          One use case per file. Input/output DTOs only.
    dtos/               Request/response shapes (not domain types)
    ports/              Additional interfaces (EmailPort, EventBusPort…)
  infrastructure/       AWS + frameworks. The ONLY layer allowed to import AWS SDK.
    adapters/           Implementations of domain ports (DynamoRepository, etc.)
    http/               Lambda handlers — thin Middy wiring, no business logic
    config/             Env validation, SSM/Secrets Manager helpers
  shared/               Cross-cutting (observability singletons, error-mapper)
```

## Dependency rule

```
infrastructure → application → domain
```

Outer layers may import inner layers. **Inner layers never import outer layers.**

This rule is automatically enforced by `eslint-plugin-boundaries` in `eslint.config.mjs`.
Violations fail `npm run lint` and the dedicated CI step `arch:lint`.
Run `npm run arch:lint` locally to check before pushing.

## Handler rules

- Use Serverless Framework v4 with TypeScript.
- Each handler is a named export (not default).
- Pattern: parse → validate (Zod) → call use case → return response. Max ~30 lines.
- Always wrap in try/catch via Middy `httpErrorHandler` middleware + `mapDomainErrorToHttp`.
- Use `middy` for cross-cutting: auth, validation, logging, tracing, metrics.

## Standards

- Structured JSON logs: `correlationId`, `service`, `function`, `level` — via Powertools Logger.
- **Never use `console.log`, `console.error`, `console.warn`, or `console.debug` directly.** Always use the Powertools Logger singleton, even for minimal/catch-path logging.
- Never log PII, secrets, or full request bodies.
- Env vars via SSM/env. Never hardcode ARNs, table names, or URLs.
- DynamoDB: AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`).
- Handlers thin: business logic in `application/use-cases/`, never in `infrastructure/http/`.
- Tests co-located as `*.test.ts` using vitest.
- Coverage: 80% branches, functions, lines, statements.
