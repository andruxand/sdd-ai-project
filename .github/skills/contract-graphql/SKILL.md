````skill
---
name: contract-graphql
description: Update or validate GraphQL schema artifacts and workflow integration points.
---

## Context
Entry point: `packages/contracts/graphql/schema.graphql`.
Modular structure: domain modules in `graphql/modules/<domain>.graphql` using `extend type Query`/`extend type Mutation`.
Diff tool: GraphQL Inspector (CI: `.github/workflows/contracts-graphql.yml`).
All `.graphql` files are concatenated at validation time.

## When this skill applies
- New query, mutation, or subscription added.
- Existing type fields changed.
- Input types modified.
- Enum values added or removed.
- Directives changed.

## Process
1. Create or update a module file in `graphql/modules/<domain>.graphql`.
2. Use `extend type Query`/`extend type Mutation` to add operations.
3. Add domain types and doc comments in the same file.
4. Validate: all `.graphql` files are concatenated and validated as a single schema.
5. Diff against `develop` (the PR target — not `main`):
   ```bash
   git show develop:packages/contracts/graphql/schema.graphql > /tmp/schema-base.graphql
   npx graphql-inspector diff /tmp/schema-base.graphql packages/contracts/graphql/schema.graphql
````

6. Classify: additive vs breaking.
7. If breaking: document migration and notify consumers.

## Breaking change examples

- Removing a field from a type.
- Changing a field's return type.
- Removing a query or mutation.
- Making a nullable field non-nullable.
- Removing an enum value.

## Additive change examples (safe)

- Adding a new query/mutation.
- Adding a new field to a type.
- Adding a new enum value.
- Adding a new type.

## Anti-patterns

- Do NOT merge schema changes without running diff.
- Do NOT add fields without descriptions.
- Do NOT use `String` for everything — use proper scalar types.

## Checklist

- [ ] Schema updated.
- [ ] Schema validates.
- [ ] Diff classified.
- [ ] Breaking changes have migration plan.
- [ ] PR template contract section filled.

## Security requirements (apply on every GraphQL change)

> Source: OWASP GraphQL Cheat Sheet — cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html

| Risk                         | Requirement                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Introspection exposure**   | Introspection MUST be disabled in production. Gate behind `NODE_ENV !== 'production'` or an admin-only header.                                                                                                    |
| **Query depth attacks**      | Enforce a maximum query depth of **7** via `graphql-depth-limit`. Add to Apollo Server `validationRules`.                                                                                                         |
| **Query complexity attacks** | Assign complexity scores; reject queries exceeding budget (recommended ≤ 1000). Use `graphql-query-complexity`.                                                                                                   |
| **Alias amplification**      | Limit the number of aliases per query at the server level.                                                                                                                                                        |
| **Field-level auth**         | Every resolver that returns sensitive data (PII, financial) must verify the requesting user has access to that specific record. Schema directives alone are not sufficient — check ownership inside the resolver. |
| **Error leakage**            | In production, mask resolver errors: `formatError: (err) => ({ message: 'Internal error', extensions: { code: err.extensions?.code } })`. Log full error with correlationId server-side.                          |
| **Persisted queries**        | Use Automatic Persisted Queries (APQ) in production to reject arbitrary ad-hoc queries.                                                                                                                           |
| **Batching**                 | If HTTP batching is enabled, set a maximum batch size to prevent amplification attacks.                                                                                                                           |

```typescript
// Example: Apollo Server with security rules
import { ApolloServer } from '@apollo/server';
import depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
  validationRules: [depthLimit(7), createComplexityLimitRule(1000)],
  formatError: (err) =>
    process.env.NODE_ENV === 'production'
      ? {
          message: 'Internal server error',
          extensions: { code: err.extensions?.code },
        }
      : err,
});
```

- [ ] Introspection disabled in production config.
- [ ] Depth limit rule applied.
- [ ] Complexity limit rule applied.
- [ ] `formatError` masks internals in production.
- [ ] Resolver-level ownership checks verified (do not rely solely on schema directives).

```

```
