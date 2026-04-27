```skill
---
name: ddd-hexagonal-patterns
description: DDD + Hexagonal Architecture implementation patterns for backend handlers — Aggregate roots, Value Objects, Domain Events, Repository port interfaces, Use Cases, and DDD layer dependency enforcement. Complements backend-task-execution layer map.
type: always-active
agents: [backend-implementer, tester-backend]
---

## Layer map and dependency rule

```

domain/
entities/ ← Aggregate roots, entities
value-objects/ ← Immutable value objects
events/ ← Domain events
errors/ ← Domain-specific errors (see domain-error-hierarchy skill)
repositories/ ← Repository PORT interfaces (no imports from infrastructure)
services/ ← Domain services (stateless, no side effects)

application/
use-cases/ ← Orchestrate domain → infrastructure via ports
dtos/ ← Input/Output DTO types (no domain types crossing boundary)
ports/ ← Output port interfaces (email, jobs, notifications)

infrastructure/
adapters/
dynamodb/ ← Implements repository ports
sqs/ ← Implements port interfaces
http/ ← External API clients
http/ ← Lambda handler + Middy stack + input/output mapping

````

**Dependency rule (strictly enforced):**
- `domain`: no imports from `application` or `infrastructure`.
- `application`: can import from `domain`. No imports from `infrastructure`.
- `infrastructure`: imports from `application` and `domain`.

**Violation check — add to ESLint or `backend-task-execution` post-checklist:**
```bash
# Verify domain has zero imports from application or infrastructure
grep -r "from.*application\|from.*infrastructure" src/domain/ && echo "VIOLATION" || echo "OK"
grep -r "from.*infrastructure" src/application/ && echo "VIOLATION" || echo "OK"
````

---

## Aggregate root

```typescript
// domain/entities/order.entity.ts
import { v4 as uuidv4 } from 'uuid';
import { OrderId } from '../value-objects/order-id.vo';
import { Money } from '../value-objects/money.vo';
import { OrderItem } from '../value-objects/order-item.vo';
import { OrderStatus } from '../value-objects/order-status.vo';
import { OrderCreatedEvent } from '../events/order-created.event';
import { DomainEvent } from '../events/domain-event';
import { DomainError } from '../errors/domain.error';

export class Order {
  private readonly _events: DomainEvent[] = [];

  private constructor(
    private readonly _id: OrderId,
    private readonly _userId: string, // only store userId, not User aggregate
    private _status: OrderStatus,
    private readonly _items: OrderItem[],
    private readonly _createdAt: Date,
  ) {}

  // ✅ Static factory method — validates invariants before construction
  static create(params: {
    userId: string;
    items: Array<{ productId: string; quantity: number; priceInCents: number }>;
  }): Order {
    if (params.items.length === 0) {
      throw new DomainError(
        'ORDER_NO_ITEMS',
        'Order must have at least one item',
      );
    }

    const items = params.items.map((i) =>
      OrderItem.create(i.productId, i.quantity, Money.ofCents(i.priceInCents)),
    );

    const order = new Order(
      OrderId.generate(),
      params.userId,
      OrderStatus.PENDING,
      items,
      new Date(),
    );

    order._events.push(
      new OrderCreatedEvent({
        orderId: order._id.value,
        userId: order._userId,
        totalCents: order.total.cents,
      }),
    );

    return order;
  }

  // ✅ Reconstitute from persistence (no events emitted — already happened)
  static reconstitute(raw: {
    id: string;
    userId: string;
    status: string;
    items: Array<{ productId: string; quantity: number; priceInCents: number }>;
    createdAt: string;
  }): Order {
    return new Order(
      OrderId.of(raw.id),
      raw.userId,
      OrderStatus.fromString(raw.status),
      raw.items.map((i) =>
        OrderItem.create(
          i.productId,
          i.quantity,
          Money.ofCents(i.priceInCents),
        ),
      ),
      new Date(raw.createdAt),
    );
  }

  // ✅ State-transition method — enforces business rules
  confirm(): void {
    if (!this._status.equals(OrderStatus.PENDING)) {
      throw new DomainError(
        'ORDER_INVALID_STATUS',
        `Cannot confirm order in status ${this._status.value}`,
      );
    }
    this._status = OrderStatus.CONFIRMED;
  }

  // ✅ Public read-only getters — never expose mutable internals
  get id(): OrderId {
    return this._id;
  }
  get status(): OrderStatus {
    return this._status;
  }
  get items(): readonly OrderItem[] {
    return [...this._items];
  } // defensive copy
  get total(): Money {
    return this._items.reduce((sum, i) => sum.add(i.subtotal), Money.ZERO);
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  // ✅ Domain event collection — infrastructure reads and publishes
  pullEvents(): DomainEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }
}
```

---

## Value Object

```typescript
// domain/value-objects/money.vo.ts
import { DomainError } from '../errors/domain.error';

// ✅ Immutable. Validates in constructor. Structural equality via equals().
export class Money {
  static readonly ZERO = new Money(0);

  private constructor(private readonly _cents: number) {}

  static ofCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new DomainError(
        'MONEY_NOT_INTEGER',
        'Monetary values must be integer cents',
      );
    }
    if (cents < 0) {
      throw new DomainError(
        'MONEY_NEGATIVE',
        'Monetary values cannot be negative',
      );
    }
    return new Money(cents);
  }

  get cents(): number {
    return this._cents;
  }

  add(other: Money): Money {
    return new Money(this._cents + other._cents);
  }

  equals(other: Money): boolean {
    return this._cents === other._cents;
  }

  toString(): string {
    return `${(this._cents / 100).toFixed(2)}`;
  }
}
```

```typescript
// domain/value-objects/order-id.vo.ts — Branded type pattern
import { v4 as uuidv4 } from 'uuid';

declare const _brand: unique symbol;
type OrderIdBrand = { readonly [_brand]: 'OrderId' };

// ✅ Branded ID prevents mixing OrderId and UserId in function signatures
export class OrderId {
  private constructor(private readonly _value: string & OrderIdBrand) {}

  static generate(): OrderId {
    return new OrderId(uuidv4() as string & OrderIdBrand);
  }

  static of(raw: string): OrderId {
    if (!raw?.trim()) {
      throw new Error('OrderId cannot be empty');
    }
    return new OrderId(raw as string & OrderIdBrand);
  }

  get value(): string {
    return this._value;
  }

  equals(other: OrderId): boolean {
    return this._value === other._value;
  }
}
```

---

## Domain Event

```typescript
// domain/events/domain-event.ts
export abstract class DomainEvent {
  readonly occurredAt = new Date().toISOString();

  protected constructor(readonly eventType: string) {}
}

// domain/events/order-created.event.ts
import { DomainEvent } from './domain-event';

export class OrderCreatedEvent extends DomainEvent {
  constructor(
    readonly payload: {
      orderId: string;
      userId: string;
      totalCents: number;
    },
  ) {
    super('ORDER_CREATED');
  }
}
```

**When to raise domain events:**

- After a state transition that other bounded contexts need to know about (order created, payment succeeded, user deactivated).
- After an aggregate is created for the first time.
- NOT inside reconstitution — events already happened.
- NOT inside infrastructure — events are raised in the domain.

---

## Repository PORT interface

```typescript
// domain/repositories/order.repository.ts
import { Order } from '../entities/order.entity';
import { OrderId } from '../value-objects/order-id.vo';

// ✅ Pure interface — zero imports from infrastructure, AWS SDK, or DynamoDB
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findAllByUserId(userId: string, limit?: number): Promise<Order[]>;
  save(order: Order): Promise<void>;
  delete(id: OrderId): Promise<void>;
}
```

---

## Repository ADAPTER (infrastructure implementation)

```typescript
// infrastructure/adapters/dynamodb/order.dynamo-repository.ts
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { Order } from '@/domain/entities/order.entity';
import { OrderId } from '@/domain/value-objects/order-id.vo';
import { OrderRepository } from '@/domain/repositories/order.repository';
import { tracer } from '@/shared/observability';

export class OrderDynamoRepository implements OrderRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(baseClient: DynamoDBDocumentClient) {
    // captureAWSv3Client wraps every DDB call in an X-Ray subsegment
    this.client = tracer.captureAWSv3Client(baseClient);
  }

  async findById(id: OrderId): Promise<Order | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: process.env.ORDERS_TABLE_NAME!,
        Key: { pk: `ORDER#${id.value}`, sk: `ORDER#${id.value}` },
      }),
    );

    if (!result.Item) return null;

    // ✅ Uses reconstitute (no events emitted)
    return Order.reconstitute({
      id: result.Item['id'],
      userId: result.Item['userId'],
      status: result.Item['status'],
      items: result.Item['items'],
      createdAt: result.Item['createdAt'],
    });
  }

  async save(order: Order): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: process.env.ORDERS_TABLE_NAME!,
        Item: {
          pk: `ORDER#${order.id.value}`,
          sk: `ORDER#${order.id.value}`,
          id: order.id.value,
          userId: order.id.value, // ← note: use order._userId but keep as string
          status: order.status.value,
          items: order.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            priceInCents: i.price.cents,
          })),
          createdAt: order.createdAt.toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }

  async delete(_id: OrderId): Promise<void> {
    throw new Error('Not implemented');
  }

  async findAllByUserId(_userId: string): Promise<Order[]> {
    throw new Error('Not implemented');
  }
}
```

---

## Use Case

```typescript
// application/use-cases/create-order.use-case.ts
import { OrderRepository } from '@/domain/repositories/order.repository';
import { Order } from '@/domain/entities/order.entity';
import { CreateOrderInput } from '../dtos/create-order.input';
import { CreateOrderOutput } from '../dtos/create-order.output';
import { EventPublisher } from '../ports/event-publisher.port';

// ✅ Accepts DTOs, returns DTOs. No domain objects cross the application boundary.
export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    // 1. Coordinate domain objects
    const order = Order.create({
      userId: input.userId,
      items: input.items,
    });

    // 2. Persist via repository port
    await this.orderRepository.save(order);

    // 3. Publish domain events
    const events = order.pullEvents();
    await this.eventPublisher.publishAll(events);

    // 4. Return output DTO — never return the aggregate itself
    return {
      orderId: order.id.value,
      status: order.status.value,
      totalCents: order.total.cents,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
```

### Input/Output DTOs

```typescript
// application/dtos/create-order.input.ts
import { z } from 'zod';

export const CreateOrderInputSchema = z.object({
  userId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        priceInCents: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
```

```typescript
// application/dtos/create-order.output.ts
export interface CreateOrderOutput {
  orderId: string;
  status: string;
  totalCents: number;
  createdAt: string;
}
```

---

## Handler — wires infrastructure to application

```typescript
// infrastructure/http/create-order.handler.ts
import middy from '@middy/core';
import { CreateOrderUseCase } from '@/application/use-cases/create-order.use-case';
import { OrderDynamoRepository } from '@/infrastructure/adapters/dynamodb/order.dynamo-repository';
import { SqsEventPublisher } from '@/infrastructure/adapters/sqs/sqs-event-publisher';
import { logger, tracer, metrics } from '@/shared/observability';
import { createDynamoClient } from '@/shared/clients';

// ✅ Compose dependencies at the infrastructure boundary
const repository = new OrderDynamoRepository(createDynamoClient());
const publisher = new SqsEventPublisher();
const useCase = new CreateOrderUseCase(repository, publisher);

const rawHandler = async (event: APIGatewayProxyEvent, _context: Context) => {
  const input = event.body as CreateOrderInput; // parsed + validated by Middy

  const output = await useCase.execute(input); // could throw DomainError or AppError

  return {
    statusCode: 201,
    body: JSON.stringify(output),
  };
};

export const handler =
  middy(
    rawHandler,
  ).use(/* standard Middy stack — see middy-patterns + powertools-patterns */);
```

---

## Anti-patterns

| Anti-pattern                                           | Problem                                   | Fix                                                   |
| ------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------- |
| Domain entity imported in infrastructure response      | Couples presentation to domain            | Return DTO from use case                              |
| `new Order()` without factory method                   | Skips invariant checks                    | Always use `Order.create()` or `Order.reconstitute()` |
| Business logic in handler                              | Untestable, no domain model               | Move to aggregate method or use case                  |
| `OrderRepository` class (concrete) in domain           | Domain imports infrastructure             | Domain defines interface only                         |
| Mutable public properties on entities                  | Bypasses invariant enforcement            | Private properties + state-transition methods         |
| `DomainEvent` raised in reconstitute                   | Double-fires past events                  | Events only in create/transition methods              |
| Use case returns `Order` entity                        | Domain object leaks to presentation layer | Return output DTO                                     |
| `this.repository = new DynamoRepository()` in use case | Tight coupling to infrastructure          | Inject via constructor (interface type)               |

---

## Checklist

- [ ] Aggregate root has private constructor + static `create()` factory.
- [ ] Aggregate root has `reconstitute()` that raises no events.
- [ ] All state transitions enforce business invariants before mutating.
- [ ] `pullEvents()` drains event queue atomically.
- [ ] All Value Objects are immutable (no setters).
- [ ] All Value Objects validate in constructor and throw `DomainError`.
- [ ] Value Object `equals()` implemented.
- [ ] Repository port defined as interface in `domain/` — zero infrastructure imports.
- [ ] DynamoDB adapter lives in `infrastructure/` and implements the port.
- [ ] Use case accepts input DTO, returns output DTO.
- [ ] Use case does NOT instantiate infrastructure — receives via constructor.
- [ ] Handler wires concrete implementations at the infrastructure boundary.
- [ ] Layer dependency rule validated: domain ← application ← infrastructure.

```

```
