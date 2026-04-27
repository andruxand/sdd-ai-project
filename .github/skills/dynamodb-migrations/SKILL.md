# Skill: dynamodb-migrations

> Source: AWS DynamoDB documentation, AWS Well-Architected Framework (Reliability Pillar)
> Type: **conditional-active** — loaded by `@backend-implementer` when the feature modifies existing table structure, adds/removes attributes, evolves key schema conventions, adds GSIs, or requires data backfill.

## Purpose

Provide safe, zero-downtime DynamoDB data migration and schema evolution patterns. Covers item versioning, lazy migration, GSI addition without downtime, backfill Lambda with DynamoDB Streams, rollback strategy, and migration script patterns.

## When to activate

Activate this skill when a task requires:

- Adding or removing attributes from existing DynamoDB items
- Adding, modifying, or removing a Global Secondary Index (GSI)
- Changing item structure or key schema conventions
- Backfilling data in an existing table

---

## Core principles

1. **DynamoDB has no schema** — you can add new attributes at any time without table alterations.
2. **Never mutate in place during migration** — add new attributes alongside old ones; delete old only after 100% of traffic reads the new format.
3. **Never change key attributes** — partition key and sort key are immutable per item. To change keys, write a new item and delete the old.
4. **Item versioning** — track migration state with a `_v` attribute.
5. **Lazy migration** — read old format, write new format on next write. Avoids full-table backfill for low-traffic items.

---

## Item versioning pattern

```typescript
// Item version attribute _v tracks migration state
// v0 = original format (no _v attribute or _v: 0)
// v1 = after first migration
// v2 = after second migration

type ItemV0 = {
  id: string;
  name: string;
  createdAt: string;
  // no _v attribute
};

type ItemV1 = {
  id: string;
  firstName: string; // renamed from name
  lastName: string; // new attribute
  createdAt: string;
  updatedAt: string; // new attribute
  _v: 1;
};

// Reading items: handle multiple versions
function normalizeItem(raw: ItemV0 | ItemV1): NormalizedItem {
  if (!('_v' in raw) || raw._v === undefined) {
    // v0: map to current format
    return {
      id: raw.id,
      firstName: raw.name,
      lastName: '',
      createdAt: raw.createdAt,
      updatedAt: raw.createdAt,
    };
  }
  // v1: already normalized
  return {
    id: raw.id,
    firstName: (raw as ItemV1).firstName,
    lastName: (raw as ItemV1).lastName,
    createdAt: raw.createdAt,
    updatedAt: (raw as ItemV1).updatedAt,
  };
}
```

---

## Lazy migration pattern

Update items to the new format on the next write. No backfill required for low-frequency items.

```typescript
// src/repositories/user.repository.ts
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient({});

export async function updateUser(id: string, patch: Partial<UserV1>) {
  // 1. Read current item
  const { Item } = await ddb.send(
    new GetItemCommand({
      TableName: USERS_TABLE,
      Key: marshall({ id }),
    }),
  );

  if (!Item) throw new Error(`User ${id} not found`);
  const raw = unmarshall(Item);

  // 2. Normalize to current version if needed
  const normalized = normalizeItem(raw);

  // 3. Merge patch + upgrade to current version
  const updated: UserV1 = {
    ...normalized,
    ...patch,
    _v: 1, // Write current version
    updatedAt: new Date().toISOString(),
  };

  // 4. Write back (lazy migration complete for this item)
  await ddb.send(
    new PutItemCommand({
      TableName: USERS_TABLE,
      Item: marshall(updated),
    }),
  );
}
```

---

## Backfill Lambda (full-table migration)

Use for migrations that must be complete before releasing new code, or when all items need the new format for a GSI.

```typescript
// src/migrations/backfill-users-v1.ts
import {
  DynamoDBClient,
  ScanCommand,
  BatchWriteItemCommand,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.USERS_TABLE!;
const BATCH_SIZE = 25; // Max for BatchWriteItem

export async function handler() {
  let lastEvaluatedKey: Record<string, AttributeValue> | undefined;
  let totalMigrated = 0;
  let totalSkipped = 0;

  do {
    const { Items = [], LastEvaluatedKey } = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        ExclusiveStartKey: lastEvaluatedKey,
        // Filter: only unmigrated items
        FilterExpression: 'attribute_not_exists(#v) OR #v < :currentVersion',
        ExpressionAttributeNames: { '#v': '_v' },
        ExpressionAttributeValues: marshall({ ':currentVersion': 1 }),
      }),
    );

    lastEvaluatedKey = LastEvaluatedKey;

    if (Items.length === 0) continue;

    // Migrate items in batches of 25
    for (let i = 0; i < Items.length; i += BATCH_SIZE) {
      const batch = Items.slice(i, i + BATCH_SIZE);
      const putRequests = batch.map((item) => {
        const raw = unmarshall(item);
        const migrated = migrateToV1(raw);
        return { PutRequest: { Item: marshall(migrated) } };
      });

      await ddb.send(
        new BatchWriteItemCommand({
          RequestItems: { [TABLE]: putRequests },
        }),
      );

      totalMigrated += putRequests.length;

      // Throttle to avoid consuming all write capacity
      await sleep(50);
    }

    console.log(
      JSON.stringify({
        stage: 'progress',
        totalMigrated,
        totalSkipped,
        hasMore: !!lastEvaluatedKey,
      }),
    );
  } while (lastEvaluatedKey);

  console.log(
    JSON.stringify({ stage: 'complete', totalMigrated, totalSkipped }),
  );
}

function migrateToV1(raw: Record<string, unknown>): Record<string, unknown> {
  if ((raw._v as number) >= 1) return raw; // already migrated

  return {
    ...raw,
    firstName: raw.name,
    lastName: '',
    updatedAt: raw.createdAt,
    _v: 1,
    // Keep old 'name' attribute until ALL reads use new format
    // Delete 'name' in v2 migration
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## GSI addition without downtime

DynamoDB supports adding a GSI to an existing table without downtime. The index is built asynchronously.

```typescript
// Step 1: Add GSI via CloudFormation/CDK (in serverless.ts)
// The table continues to serve reads/writes during GSI backfill.
// GSI status: CREATING → ACTIVE (monitor in console or via DescribeTable)

resources: {
  Resources: {
    UsersTable: {
      Type: 'AWS::DynamoDB::Table',
      Properties: {
        // ... existing config ...
        GlobalSecondaryIndexes: [
          // Existing GSIs
          { /* ... */ },
          // New GSI being added
          {
            IndexName: 'byEmail',
            KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
        // Must add email to AttributeDefinitions
        AttributeDefinitions: [
          { AttributeName: 'id',    AttributeType: 'S' },
          { AttributeName: 'email', AttributeType: 'S' },
        ],
      },
    },
  },
},
```

**GSI addition checklist:**

1. Add the GSI in CloudFormation + deploy (status → `ACTIVE` before proceeding).
2. Verify GSI is fully populated by querying it before switching traffic.
3. Update application code to use the new GSI.
4. Monitor for a period before removing the old query pattern.

**GSI deletion:** Only delete a GSI after all code paths using it are removed from production.

---

## Event-driven migration with DynamoDB Streams

For continuous migration (migrate items as they are touched), use DynamoDB Streams:

```typescript
// src/handlers/migration-stream.ts
import { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient({});

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY')
      continue;
    if (!record.dynamodb?.NewImage) continue;

    const item = unmarshall(
      record.dynamodb.NewImage as Record<
        string,
        import('@aws-sdk/client-dynamodb').AttributeValue
      >,
    );

    // Skip if already migrated
    if ((item._v as number) >= 1) continue;

    const migrated = migrateToV1(item);
    await ddb.send(
      new PutItemCommand({
        TableName: process.env.USERS_TABLE!,
        Item: marshall(migrated),
      }),
    );
  }
};
```

Enable Streams in `serverless.ts`:

```typescript
UsersTable: {
  Type: 'AWS::DynamoDB::Table',
  Properties: {
    // ...
    StreamSpecification: {
      StreamViewType: 'NEW_AND_OLD_IMAGES',
    },
  },
},
```

---

## Rollback strategy

DynamoDB migrations are NOT automatically reversible. Follow this protocol:

1. **Keep old attributes** alongside new ones until migration is confirmed complete (100% of items at new `_v`).
2. **Feature flag** the new code path: `if (featureFlag.usersV1) { readV1() } else { readV0() }`.
3. **Rollback = disable feature flag**: reverts to reading old attributes, which are still present.
4. **Delete old attributes only** after new code has been in production for at least 2 weeks without issues.
5. **Never reuse attribute names** with different types — create a new attribute name.

---

## Migration checklist

- [ ] Item versioning with `_v` attribute.
- [ ] Read path handles all versions via `normalizeItem()`.
- [ ] Write path always writes current version.
- [ ] Backfill Lambda is idempotent (safe to run multiple times).
- [ ] Old attributes preserved until migration is confirmed 100% complete.
- [ ] Rollback documented and tested via feature flag.
- [ ] GSI addition verified as ACTIVE before switching traffic.
- [ ] Migration Lambda throttled to avoid excessive WCU consumption.
- [ ] Logs include `totalMigrated`, `totalSkipped`, and completion status.

---

## DO / DON'T

| ✅ DO                                                | ❌ DON'T                                           |
| ---------------------------------------------------- | -------------------------------------------------- |
| Keep old attributes during migration                 | Delete attributes before all reads are updated     |
| Track migration state with `_v` attribute            | Assume all items have been migrated                |
| Handle multiple `_v` values in read path             | Write code that only handles the latest version    |
| Use `BatchWriteItem` for backfills                   | Write items one-by-one in a loop                   |
| Throttle backfill Lambda (`sleep(50)`)               | Run backfill at full throughput (risks throttling) |
| Use feature flags to gate migration rollout          | Deploy breaking changes without a rollback path    |
| Add GSIs; deploy; verify ACTIVE; then switch traffic | Switch traffic before GSI is ACTIVE                |
| Filter scan to only unmigrated items                 | Re-migrate already-migrated items (wastes WCU)     |
