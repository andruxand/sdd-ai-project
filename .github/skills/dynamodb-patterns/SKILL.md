````skill
---
name: dynamodb-patterns
description: Design and implement DynamoDB tables and access patterns for serverless backends.
---

## Core principle: access pattern-first

**Never start with entities. Start with access patterns.**

1. List every read and write operation the feature needs.
2. Define the PK and SK that satisfies the dominant access pattern.
3. Add GSIs only for access patterns that cannot be served by the base table.
4. Only then define the data model.

If you skip this order you will end up with a relational model forced into DynamoDB — leading to expensive scans, hot partitions, and multiple round trips.

## Single-table vs multi-table

| Scenario | Recommendation |
|---|---|
| Multiple entity types with shared access patterns | Single-table design |
| Teams with independent deploy cycles per entity | Multi-table (one per team/service) |
| MVP or simple CRUD | Multi-table is fine; migrate to single-table when patterns multiply |
| Read/write units differ dramatically per entity | Multi-table to isolate capacity |

## Key design patterns

### Base table structure

```typescript
// Single-table design — every item uses PK + SK
// PK: partition key — determines which node stores the item
// SK: sort key — enables range queries within the same partition

// Pattern: {EntityType}#{id}
PK: 'USER#123'      SK: 'PROFILE'          // user profile
PK: 'USER#123'      SK: 'ORDER#2024-001'   // order belonging to user
PK: 'ORDER#2024-001' SK: 'ITEM#prod-456'   // item within order
````

### PK/SK naming rules

- Use a type prefix: `USER#`, `ORDER#`, `PRODUCT#` — prevents key collisions across entity types.
- SK as hierarchy: `ORDER#2024-001`, `ITEM#456`, `METADATA` — enables sort and filtering.
- Composite SK for range queries: `STATUS#active#2024-12-01` — query by status + date range.
- Do NOT use auto-increment IDs — use ULIDs or UUIDs for partition safety.

### GSI (Global Secondary Index)

Use a GSI when you need to query by a different attribute than the base table PK.

```typescript
// Base table: orders by user
PK: 'USER#123'    SK: 'ORDER#2024-001'

// GSI — orders by status (to find all pending orders regardless of user)
GSI1PK: 'STATUS#pending'    GSI1SK: '2024-12-01T10:00Z'   // created_at for range sort
```

Rules for GSIs:

- Maximum 5 GSIs per table — design access patterns first to avoid hitting this limit.
- Sparse GSIs: only set GSI attributes on items that need that access pattern.
- Project only required attributes (`KEYS_ONLY` or `INCLUDE` — avoid `ALL`).
- Add GSI capacity to the CloudFormation resource in `serverless.ts`.

## Avoiding hot partitions

A hot partition occurs when too many requests route to the same PK value.

**Anti-patterns that cause hot partitions:**

- Using a low-cardinality value as PK (e.g., status: `PENDING`, `ACTIVE` — all pending orders hit the same partition).
- Sequential PKs (date-only: `2024-12-01` — all writes for today go to one partition).
- Storing a "counter" in one item and incrementing it on every write.

**Solutions:**

- High-cardinality PK: user ID, order ID, product ID.
- Write sharding for high-volume partitions: `PRODUCT#123#shard_0` to `PRODUCT#123#shard_9`, randomize the shard.
- For time-series: `METRICS#service#2024-12` per month, then SK as full timestamp.

## Never use Scan

`Scan` reads every item in the table and consumes full read capacity. It is effectively banned.

```typescript
// ❌ Prohibited
const result = await dynamo.send(new ScanCommand({ TableName }));

// ✅ Use Query with KeyConditionExpression
const result = await dynamo.send(
  new QueryCommand({
    TableName,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': 'USER#123', ':prefix': 'ORDER#' },
  }),
);
```

If you think you need `Scan`, you likely need a GSI or a different access pattern.

## TTL (Time To Live)

Use TTL for automatic cleanup of transient data — sessions, cache, idempotency records, temp tokens.

```typescript
// In serverless.ts — enable TTL on a table
TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true }

// In code — set ttl as Unix epoch (seconds)
const ttl = Math.floor(Date.now() / 1000) + 86400; // expires in 24h
await dynamo.send(
  new PutCommand({
    TableName,
    Item: { PK: 'SESSION#abc', SK: 'TOKEN', value: '...', ttl },
  }),
);
```

- TTL deletion is eventually consistent — items may remain visible for up to 48h after expiry.
- Never rely on TTL as a hard security expiration — validate expiry in the application layer.
- Use TTL for all idempotency tables, session tokens, and temporary records.

## DynamoDB Streams

Use DynamoDB Streams to trigger downstream processing when data changes without polling.

```typescript
// serverless.ts — stream trigger
events: [
  {
    stream: {
      type: 'dynamodb',
      arn: { 'Fn::GetAtt': ['OrdersTable', 'StreamArn'] },
      batchSize: 100,
      startingPosition: 'LATEST',
      functionResponseType: 'ReportBatchItemFailures', // partial failures
    },
  },
],
```

When to use streams:

- Fan-out: write once to the primary table, trigger secondary projections (search index, read model).
- Audit log: capture every change to sensitive data.
- Cache invalidation: invalidate ElastiCache entry when the source item changes.
- Event sourcing: publish domain events from table changes.

Do NOT use streams as a replacement for proper event sourcing architecture if the feature requires replay — use EventBridge instead.

## Pagination

DynamoDB returns at most 1 MB per `Query`/`Scan` call. Always handle `LastEvaluatedKey`.

```typescript
async function queryAll(
  params: QueryCommandInput,
): Promise<Record<string, AttributeValue>[]> {
  const items: Record<string, AttributeValue>[] = [];
  let lastKey: Record<string, AttributeValue> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({ ...params, ExclusiveStartKey: lastKey }),
    );
    items.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}
```

Never assume a single Query returns all results. Never paginate by Scan.

## CloudFormation resource template

```typescript
// serverless.ts resources
resources: {
  Resources: {
    OrdersTable: {
      Type: 'AWS::DynamoDB::Table',
      Properties: {
        TableName: '${self:service}-${opt:stage}-orders',
        BillingMode: 'PAY_PER_REQUEST',
        TableClass: 'STANDARD',
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
        TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
        StreamSpecification: { StreamViewType: 'NEW_AND_OLD_IMAGES' }, // only if streams needed
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      },
    },
  },
},
```

### Required settings for all tables

- `BillingMode: PAY_PER_REQUEST` unless you have very predictable traffic and provisioned is cheaper.
- `PointInTimeRecoveryEnabled: true` — mandatory for any table with business-critical data.
- `TimeToLiveSpecification` — enable for transient data tables.
- Encryption at rest enabled by default (AWS-managed key); customer-managed CMK for PCI/HIPAA.

## IAM (per function, least privilege)

```typescript
iamRoleStatements: [
  {
    Effect: 'Allow',
    Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
    Resource: [
      { 'Fn::GetAtt': ['OrdersTable', 'Arn'] },
      { 'Fn::Join': ['/', [{ 'Fn::GetAtt': ['OrdersTable', 'Arn'] }, 'index', 'GSI1']] },
    ],
  },
],
```

- Grant only the `Action` verbs the function needs.
- `DeleteItem` requires explicit justification.
- Never grant `dynamodb:*` — enumerate each operation.
- Include GSI ARN in `Resource` when the function queries a GSI.

## Anti-patterns

- Do NOT use `Scan` — ever.
- Do NOT use auto-increment numeric IDs as PK (hot partition risk).
- Do NOT start modeling entities before listing access patterns.
- Do NOT add arbitrary GSIs — each one doubles write cost for those items.
- Do NOT use `ProjectionType: ALL` on large-item tables unless needed.
- Do NOT skip `PointInTimeRecovery` on production tables.
- Do NOT put business logic in stream handlers — delegate to use cases.
- Do NOT assume Query returns all results — always handle `LastEvaluatedKey`.

## Checklist

- [ ] Access patterns listed before table design started.
- [ ] PK/SK chosen to satisfy dominant access pattern.
- [ ] No Scan operations anywhere in the codebase.
- [ ] GSIs added only for access patterns not served by base table.
- [ ] Hot partition risk evaluated for high-volume PKs.
- [ ] TTL enabled for transient data tables.
- [ ] PointInTimeRecovery enabled for all production tables.
- [ ] IAM scoped per function (no wildcards, no `dynamodb:*`).
- [ ] Pagination handled with `LastEvaluatedKey` loop.
- [ ] Write operations wrapped with Powertools idempotency middleware.

```

```
