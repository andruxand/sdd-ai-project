# application/

Orchestrates domain logic. **Framework-agnostic** — no AWS SDK, no HTTP, no Lambda.

Each use case:

- Accepts a typed DTO (input)
- Calls domain entities and repository ports
- Emits domain events (optional)
- Returns a typed output DTO

## Folders

```
application/
  use-cases/    One file per use case. File name = verb + noun (create-order.ts)
  dtos/         Input/output shapes. NOT domain types. NOT API request/response types.
  ports/        Additional interfaces this layer depends on (e.g. EmailPort, EventBusPort)
```

## Rules

- Use cases depend on repository INTERFACES from `domain/repositories/`, never on implementations.
- Use cases may import from `domain/` but never from `infrastructure/` or `handlers/`.
- No `console.log`, no Powertools imports — logging is done at the handler level via Middy.
- Throw `DomainError` subclasses — never `Error('...')`.
- All public methods return `Promise<OutputDTO>`.
