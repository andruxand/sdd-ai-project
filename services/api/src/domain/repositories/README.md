/\*\*

- Repository interfaces (ports) — domain layer.
-
- Define ONE interface per aggregate here.
- Implementations live in:
- services/api/src/infrastructure/adapters/<name>-repository.ts
-
- Pattern:
- interface UserRepository {
-     findById(id: UserId): Promise<User | null>;
-     save(user: User): Promise<void>;
-     delete(id: UserId): Promise<void>;
- }
-
- Rules:
- - Methods accept and return DOMAIN types, never raw DynamoDB items or AWS DTOs.
- - No DynamoDB, no AWS SDK, no framework imports in this file.
- - Throw DomainError subclasses, never AWS SDK errors.
    \*/

// Add your repository interfaces here.
// Example (remove when adding the first real aggregate):
//
// import type { ExampleEntity } from '../entities/example-entity';
// import type { ExampleId } from '../value-objects/example-id';
//
// export interface ExampleRepository {
// findById(id: ExampleId): Promise<ExampleEntity | null>;
// save(entity: ExampleEntity): Promise<void>;
// delete(id: ExampleId): Promise<void>;
// }
