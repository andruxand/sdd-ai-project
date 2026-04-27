# infrastructure/

Adapters and wiring. This layer is the only one allowed to import AWS SDK, Middy, Powertools, and other frameworks.

## Layers of Hexagonal Architecture

```
infrastructure/
  adapters/     Implementations of domain ports (repository interfaces → DynamoDB, S3, SQS…)
  http/         Lambda handler entry points (thin Middy wiring — no business logic)
  config/       Env var validation, SSM/Secrets Manager helpers
```

## Rules

- `adapters/` implement interfaces declared in `domain/repositories/` or `application/ports/`.
- `http/` handlers: parse → validate (Zod) → call use case → return response. Max ~30 lines per handler.
- `config/` validates all required env vars at module load time (fail-fast pattern).
- Adapters translate AWS errors to `DomainError` subclasses before propagating up.
- No business logic here. If you are writing an `if` about the domain, move it to a use case.

## DynamoDB adapter pattern

```typescript
// infrastructure/adapters/dynamo-example-repository.ts
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import type { ExampleRepository } from '../../domain/repositories';
import type { ExampleEntity } from '../../domain/entities/example-entity';
import { NotFoundError } from '../../domain/errors';

export class DynamoExampleRepository implements ExampleRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findById(id: string): Promise<ExampleEntity | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: id } }),
    );
    if (!result.Item) return null;
    return ExampleEntity.fromPersistence(result.Item); // domain factory
  }

  async save(entity: ExampleEntity): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity.toPersistence(),
      }),
    );
  }
}
```

## Handler pattern

```typescript
// infrastructure/http/example.ts
import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { logger, tracer, metrics } from '../../shared/observability';
import { createClient } from '../../infrastructure/config/dynamo';
import { DynamoExampleRepository } from '../adapters/dynamo-example-repository';
import { GetExampleUseCase } from '../../application/use-cases/get-example';
import { inputSchema } from './schemas/example-input.schema';
import { mapDomainErrorToHttp } from '../../shared/error-mapper';
import type { APIGatewayProxyHandler } from 'aws-lambda';

const repo = new DynamoExampleRepository(
  createClient(),
  process.env.TABLE_NAME!,
);
const useCase = new GetExampleUseCase(repo);

const baseHandler: APIGatewayProxyHandler = async (event) => {
  const input = inputSchema.parse(event.pathParameters);
  const result = await useCase.execute(input);
  return { statusCode: 200, body: JSON.stringify(result) };
};

export const handler = middy(baseHandler)
  .use(httpJsonBodyParser())
  .use(httpErrorHandler())
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics));
```
