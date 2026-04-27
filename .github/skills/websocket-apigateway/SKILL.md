# Skill: websocket-apigateway

> Source: AWS API Gateway WebSocket APIs documentation, Serverless Framework v4 docs
> Type: **conditional-active** — loaded by `@backend-implementer` when the feature requires real-time bidirectional communication (chat, live notifications, presence, multiplayer).

## Purpose

Provide implementation knowledge for AWS API Gateway WebSocket APIs with Lambda backends. Covers route configuration in `serverless.ts`, `$connect`/`$disconnect`/`$default` handlers, `connectionId` storage in DynamoDB, fan-out messaging via `@connections` API, authorization, and stale connection handling.

## When to activate

Activate this skill when a feature requires real-time bidirectional communication:

- Live dashboards, chat, notifications, collaborative editing
- Any feature with server-initiated push to connected clients

---

## API Gateway WebSocket concepts

| Concept                | Description                                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route**              | WebSocket messages are routed by a route key. Built-in routes: `$connect`, `$disconnect`, `$default`. Custom routes: e.g., `sendmessage`.                                                      |
| **connectionId**       | Unique ID assigned by API Gateway per WebSocket connection. Required to send messages back to a specific client.                                                                               |
| **`@connections` API** | REST API to send messages to/disconnect from connected clients using their `connectionId`. Endpoint: `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/@connections/{connectionId}` |
| **Integration**        | Each route maps to a Lambda function.                                                                                                                                                          |

---

## serverless.ts configuration

```typescript
// services/api/serverless.ts (relevant section)
import type { AWS } from '@serverless/typescript';

const serverlessConfig: AWS = {
  service: 'my-api',
  provider: {
    name: 'aws',
    runtime: 'nodejs22.x',
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:DeleteItem',
          'dynamodb:Scan',
        ],
        Resource: { 'Fn::GetAtt': ['ConnectionsTable', 'Arn'] },
      },
      {
        Effect: 'Allow',
        Action: ['execute-api:ManageConnections'],
        Resource: 'arn:aws:execute-api:*:*:*/*/POST/@connections/*',
      },
    ],
  },
  functions: {
    wsConnect: {
      handler: 'src/handlers/ws-connect.handler',
      events: [{ websocket: { route: '$connect' } }],
    },
    wsDisconnect: {
      handler: 'src/handlers/ws-disconnect.handler',
      events: [{ websocket: { route: '$disconnect' } }],
    },
    wsDefault: {
      handler: 'src/handlers/ws-default.handler',
      events: [{ websocket: { route: '$default' } }],
    },
    // Custom route for typed messages
    wsSendMessage: {
      handler: 'src/handlers/ws-send-message.handler',
      events: [{ websocket: { route: 'sendmessage' } }],
    },
  },
  resources: {
    Resources: {
      ConnectionsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:service}-${self:provider.stage}-connections',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'connectionId', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'connectionId', KeyType: 'HASH' }],
          // TTL to auto-clean stale connections
          TimeToLiveSpecification: {
            AttributeName: 'ttl',
            Enabled: true,
          },
        },
      },
    },
  },
};
```

---

## $connect handler

```typescript
// src/handlers/ws-connect.ts
import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const userId = event.requestContext.authorizer?.userId; // from authorizer
  const ttl = Math.floor(Date.now() / 1000) + 2 * 60 * 60; // 2 hours TTL

  await ddb.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        connectionId: { S: connectionId },
        userId: { S: userId ?? 'anonymous' },
        connectedAt: { S: new Date().toISOString() },
        ttl: { N: String(ttl) },
      },
    }),
  );

  return { statusCode: 200 };
};
```

---

## $disconnect handler

```typescript
// src/handlers/ws-disconnect.ts
import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;

  await ddb.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: { connectionId: { S: connectionId } },
    }),
  );

  return { statusCode: 200 };
};
```

---

## Fan-out: send message to all connected clients

```typescript
// src/handlers/ws-send-message.ts
import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const { domainName, stage, connectionId } = event.requestContext;
  const body = JSON.parse(event.body ?? '{}');

  // Build the @connections client
  const apigw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  // Fetch all connections from DynamoDB
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLE }));

  const postCalls = Items.map(async (item) => {
    const targetConnectionId = item.connectionId.S!;
    try {
      await apigw.send(
        new PostToConnectionCommand({
          ConnectionId: targetConnectionId,
          Data: Buffer.from(JSON.stringify({ type: 'message', payload: body })),
        }),
      );
    } catch (err) {
      if (err instanceof GoneException) {
        // Connection is stale (client disconnected without $disconnect)
        // Clean up the DynamoDB record
        await ddb.send(
          new DeleteItemCommand({
            TableName: TABLE,
            Key: { connectionId: { S: targetConnectionId } },
          }),
        );
      } else {
        throw err;
      }
    }
  });

  await Promise.allSettled(postCalls);
  return { statusCode: 200 };
};
```

---

## Authorization

API Gateway WebSocket supports Lambda authorizers on the `$connect` route:

```typescript
// serverless.ts — attach authorizer to $connect
wsConnect: {
  handler: 'src/handlers/ws-connect.handler',
  events: [{
    websocket: {
      route: '$connect',
      authorizer: {
        name: 'wsAuthorizer',
        identitySource: 'route.request.querystring.token',
      },
    },
  }],
},
wsAuthorizer: {
  handler: 'src/handlers/ws-authorizer.handler',
},
```

Clients send the JWT via query string: `wss://api.example.com/ws?token=<jwt>`.

The authorizer Lambda validates the token and returns an IAM policy + context (`userId`, etc.) accessible via `event.requestContext.authorizer`.

---

## Stale connection handling

When a client disconnects abruptly (network drop), the `$disconnect` route is NOT triggered. Stale connections accumulate in DynamoDB. Two mitigation strategies:

1. **TTL on connection records** (recommended): Set `ttl` attribute in DynamoDB to auto-expire records after a reasonable time (e.g., 2 hours). Shown in `$connect` handler above.
2. **GoneException cleanup** (shown in fan-out handler): Catch `GoneException` (HTTP 410) when calling `@connections` and delete the stale record.

Use both strategies together.

---

## Client-side (browser)

```typescript
const socket = new WebSocket(
  `wss://${apiId}.execute-api.${region}.amazonaws.com/${stage}?token=${jwt}`,
);

socket.addEventListener('open', () => {
  socket.send(JSON.stringify({ action: 'sendmessage', data: 'hello' }));
});

socket.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  console.log('Received:', msg);
});

socket.addEventListener('close', (event) => {
  console.log('Disconnected:', event.code, event.reason);
  // Implement reconnect with exponential backoff
});
```

---

## DO / DON'T

| ✅ DO                                                                              | ❌ DON'T                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------ |
| Store `connectionId` in DynamoDB with TTL                                          | Store connectionIds in Lambda memory       |
| Validate JWT in `$connect` authorizer                                              | Accept all connections without auth        |
| Catch `GoneException` in fan-out Lambda                                            | Let stale connection errors propagate      |
| Grant `execute-api:ManageConnections` IAM                                          | Use `*` on IAM actions                     |
| Use `Promise.allSettled` for fan-out sends                                         | Use `Promise.all` (one failure aborts all) |
| Use `Scan` + filter only for small connection sets; use GSI for user-based queries | Scan entire table for large-scale fan-out  |
