# services/api/src

Backend source — **DDD + Hexagonal (Ports & Adapters)** architecture.

## Layer map

```
src/
  domain/          Pure business logic. Zero AWS/framework dependencies.
    entities/      Aggregate roots and entities.
    value-objects/ Immutable value types.
    events/        Domain events.
    errors/        DomainError hierarchy.
    repositories/  Repository INTERFACES (ports).
  application/     Orchestrates domain. Framework-agnostic.
    use-cases/     One file per use case.
    dtos/          Input/output shapes.
    ports/         Additional interfaces.
  infrastructure/  AWS SDK lives here only.
    adapters/      Port implementations.
    http/          Lambda handlers (Middy wiring).
    config/        Env validation.
  shared/          Observability singletons, error-mapper, utilities.
```

## Dependency rule

`infrastructure → application → domain`  
Inner layers **never** import outer layers.
