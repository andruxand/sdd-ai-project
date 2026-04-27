````skill
---
name: cognito-auth-patterns
description: Implement and validate Cognito-based authentication in serverless Lambda APIs.
---

## Decision: Cognito User Pools vs Identity Pools

| Scenario | Use |
|---|---|
| Web/mobile app login, email+password, social IdP, MFA | **User Pools** — manages user directory and JWT issuance |
| Direct AWS resource access from client (S3, DynamoDB, IoT) | **Identity Pools** — exchanges tokens for temporary IAM credentials |
| API authentication (the common case for REST/GraphQL) | **User Pools** + API Gateway authorizer |
| M2M / service-to-service | **Client credentials grant** (Cognito App Client secret) or IAM SigV4 |

Most backend APIs use User Pools. Identity Pools are rarely needed unless the
frontend client must call AWS services directly.

## API Gateway authorizer configuration (serverless.ts)

```typescript
// serverless.ts
provider:
  httpApi:
    authorizers:
      cognitoAuthorizer:
        type: jwt
        identitySource: $request.header.Authorization
        issuerUrl: !Sub 'https://cognito-idp.${AWS::Region}.amazonaws.com/${UserPoolId}'
        audience:
          - !Ref UserPoolClientId

functions:
  getOrder:
    handler: src/handlers/orders/get.handler
    events:
      - httpApi:
          path: /orders/{orderId}
          method: GET
          authorizer:
            name: cognitoAuthorizer
            scopes:
              - orders/read   # optional: Cognito resource server scopes
````

## JWT validation in handler (middy-based)

API Gateway HTTP API with JWT authorizer validates the JWT signature and
expiration automatically. The claims are available in `event.requestContext.authorizer.jwt.claims`.

**Do NOT trust user-supplied Authorization headers inside the handler** — API
Gateway has already validated and parsed them. Extract from `requestContext` only.

```typescript
// services/api/src/handlers/orders/get.handler.ts
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => {
  const claims = event.requestContext.authorizer.jwt.claims;

  const userId = claims['sub'] as string; // Cognito user sub (stable, use as PK)
  const email = claims['email'] as string; // never log this — PII
  const groups =
    (claims['cognito:groups'] as string | undefined)?.split(',') ?? [];

  // Authorization check — API Gateway only validates authn, not authz
  if (!groups.includes('orders-readers')) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  logger.appendKeys({ userId, action: 'getOrder' }); // log userId (not email)
  // ... business logic
};
```

## REST API (v1) vs HTTP API (v2) authorizer

Prefer **HTTP API (v2)** — lower latency, lower cost, native JWT authorizer.
Use **REST API (v1)** only if you need: Usage Plans, API keys, request/response
transforms, or AWS WAF integration.

For REST API (v1), use a Lambda authorizer instead of the native JWT authorizer:

```typescript
// services/api/src/authorizers/cognito.authorizer.ts
import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Initialize verifier at module level (connection reuse)
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken?.replace('Bearer ', '');

  try {
    const payload = await verifier.verify(token);
    return {
      principalId: payload.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn,
          },
        ],
      },
      context: {
        userId: payload.sub,
        groups: (payload['cognito:groups'] as string[])?.join(',') ?? '',
      },
    };
  } catch {
    throw new Error('Unauthorized'); // API Gateway converts this to 401
  }
};
```

Use `aws-jwt-verify` (AWS-maintained, no external dependencies) — never use
`jsonwebtoken` for Cognito tokens:

```bash
npm install aws-jwt-verify
```

## CloudFormation — User Pool + App Client

```yaml
CognitoUserPool:
  Type: AWS::Cognito::UserPool
  DeletionPolicy: Retain
  Properties:
    UserPoolName: ${self:service}-${sls:stage}
    UsernameAttributes:
      - email
    AutoVerifiedAttributes:
      - email
    Policies:
      PasswordPolicy:
        MinimumLength: 12
        RequireUppercase: true
        RequireLowercase: true
        RequireNumbers: true
        RequireSymbols: true
    MfaConfiguration: OPTIONAL
    EnabledMfas:
      - SOFTWARE_TOKEN_MFA
    AccountRecoverySetting:
      RecoveryMechanisms:
        - Name: verified_email
          Priority: 1

CognitoUserPoolClient:
  Type: AWS::Cognito::UserPoolClient
  Properties:
    UserPoolId: !Ref CognitoUserPool
    ClientName: ${self:service}-${sls:stage}-client
    GenerateSecret: false # false for SPA/mobile; true for M2M
    ExplicitAuthFlows:
      - ALLOW_USER_SRP_AUTH # secure remote password — use this over USER_PASSWORD_AUTH
      - ALLOW_REFRESH_TOKEN_AUTH
    PreventUserExistenceErrors: ENABLED # prevents user enumeration
    AccessTokenValidity: 1 # hours
    IdTokenValidity: 1 # hours
    RefreshTokenValidity: 30 # days
    TokenValidityUnits:
      AccessToken: hours
      IdToken: hours
      RefreshToken: days
```

## Scopes and groups — authorization patterns

| Pattern                                       | When                                                           |
| --------------------------------------------- | -------------------------------------------------------------- |
| Cognito Groups + `cognito:groups` claim       | Role-based access (admin, reader, writer) within the same pool |
| Cognito Resource Server + custom scopes       | M2M or service-to-service authorization                        |
| Custom claims in Pre-Token-Generation trigger | Tenant ID, plan, feature flags per user                        |

Example group check in handler:

```typescript
function requireGroup(claims: Record<string, unknown>, group: string): void {
  const groups = ((claims['cognito:groups'] as string) ?? '').split(',');
  if (!groups.includes(group)) {
    throw new ForbiddenError(`Group '${group}' required`);
  }
}
```

## Security rules

- ❌ Never validate JWTs manually with `jwt.decode()` without verification.
- ❌ Never trust claims from the request body or query string — only from `requestContext.authorizer`.
- ❌ Never log `email`, full `sub`, or any claim that is PII without hashing.
- ❌ Never use `USER_PASSWORD_AUTH` flow — it sends the password over the wire; use `USER_SRP_AUTH`.
- ❌ Never set `GenerateSecret: false` for M2M clients — always use client secret for machine flows.
- ✅ Always check authorization at handler level — API Gateway only validates authentication.
- ✅ Always use `PreventUserExistenceErrors: ENABLED` — prevents brute-force enumeration.

## Checklist

- [ ] HTTP API: JWT authorizer in `serverless.ts` with correct `issuerUrl` and `audience`.
- [ ] REST API: Lambda authorizer using `aws-jwt-verify` (not `jsonwebtoken`).
- [ ] Claims extracted from `requestContext.authorizer` — never from request body.
- [ ] Authorization (groups/scopes) checked at handler level after authn.
- [ ] User Pool: `PreventUserExistenceErrors: ENABLED`, SRP flow only.
- [ ] `DeletionPolicy: Retain` on User Pool (losing users is catastrophic).
- [ ] No PII in logs (hash or omit `email`, use `userId`=`sub`).
- [ ] Contract (OpenAPI) documents `securitySchemes` and `security` on each endpoint.
- [ ] Tests cover: valid token, expired token, missing token, wrong scope, wrong group.

```

```
