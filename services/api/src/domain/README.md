# domain/

Pure business logic. **Zero framework dependencies.**

This layer owns the _what_ and _why_ of the business — never the _how_ of infrastructure.

## Rules

- No AWS SDK imports. No HTTP. No DynamoDB. No Lambda.
- No logging framework imports (log at application layer or above).
- Pure TypeScript: entities, value objects, domain events, errors, and repository interfaces (ports).
- Domain entities must be created through static factory methods, not raw constructors.
- All mutation returns a new instance (treat value objects as immutable).

## Folders

```
domain/
  entities/       Aggregate roots and domain entities
  value-objects/  Immutable value types (e.g. Email, Money, OrderId)
  events/         Domain events emitted by aggregates
  errors/         DomainError base class and typed subclasses
  repositories/   Repository interfaces (ports) — implementations live in infrastructure/adapters/
```
