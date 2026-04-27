# packages/contracts

Source of truth for all API contracts. **Spec-first**: the contract is written/updated before or with the implementation, never generated from code as the sole source.

## Principles

1. **Contracts are not implementation** — they define the public surface (what consumers see), not handlers/resolvers.
2. **Spec-first** — write the contract, then implement. CI detects drift and breaking changes.
3. **Modular by domain** — one entry point, split by bounded context via `$ref` (REST) or file imports (GraphQL).
4. **Independent lifecycle** — contract changes live in their own task group so they can be reviewed and merged independently.

## Structure

```text
packages/contracts/
├── package.json
├── README.md                        # ← you are here
├── redocly.yaml                     # Redocly config (lint rules, multi-API support)
├── rest/
│   ├── openapi.yaml                 # Entry point — references domain modules
│   ├── paths/                       # Path definitions split by domain
│   │   └── _example.yaml            # Example domain paths
│   └── components/                  # Shared schemas, parameters, responses
│       └── _example.yaml            # Example shared component
└── graphql/
    ├── schema.graphql               # Entry point — imports domain modules
    └── modules/                     # Type definitions split by domain
        └── _example.graphql         # Example domain module
```

## How it works

### REST (OpenAPI)

The entry point `rest/openapi.yaml` uses `$ref` to include paths and components from subdirectories:

```yaml
paths:
  /orders:
    $ref: './paths/orders.yaml#/~1orders'
```

Redocly CLI resolves `$ref`s across files. oasdiff also supports multi-file specs natively.

**Commands:**

```bash
# lint
npx @redocly/cli lint rest/openapi.yaml

# bundle into single file (for consumers, code generation, etc.)
npx @redocly/cli bundle rest/openapi.yaml -o dist/openapi.yaml

# diff against main
oasdiff breaking <main-spec> rest/openapi.yaml
```

### GraphQL composition

The entry point `graphql/schema.graphql` uses `extend type` pattern to compose domain modules:

```graphql
# schema.graphql — base types
type Query {
  _health: String
}

type Mutation {
  _noop: String
}
```

```graphql
# modules/orders.graphql
extend type Query {
  orders: [Order!]!
  order(id: ID!): Order
}

type Order {
  id: ID!
  status: OrderStatus!
  createdAt: String!
}
```

At build/test time, all `.graphql` files are concatenated and validated as a single schema.

**Commands:**

```bash
# validate (all files concatenated)
npx graphql-inspector validate 'graphql/**/*.graphql'

# diff against main
npx graphql-inspector diff <main-schema> 'graphql/**/*.graphql'
```

### When to use multiple entry points

| Scenario                      | REST                                                         | GraphQL                                                                    |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Single service (typical)      | 1 `openapi.yaml`, split by domain in `paths/`                | 1 `schema.graphql` + modules                                               |
| Multiple services in monorepo | `rest/service-a/openapi.yaml`, `rest/service-b/openapi.yaml` | `graphql/service-a/schema.graphql`, etc.                                   |
| Public + internal API         | Use Redocly `apis` config to manage separately               | Separate schemas or schema stitching                                       |
| Federation (Apollo)           | N/A                                                          | Each subgraph has its own `schema.graphql`; supergraph composed separately |

For multi-service, replicate the `rest/` or `graphql/` structure per service and update `redocly.yaml` to register each API.

## CI integration

- **REST**: `.github/workflows/contracts-rest.yml` — lints with Redocly, diffs with oasdiff.
- **GraphQL**: `.github/workflows/contracts-graphql.yml` — validates schema, diffs with graphql-inspector.
- Both workflows have file-existence guards — they skip gracefully if specs aren't present yet.

## Relationship to implementation

```text
packages/contracts/     → defines WHAT the API looks like (types, shapes, paths)
services/api/src/       → implements HOW the API works (handlers, resolvers, business logic)
```

Contracts and implementation should stay aligned. The `contracts-implementer` agent and `contract-*` skills enforce this discipline.

## Adding a new domain

### REST

1. Create `rest/paths/orders.yaml` with your path definitions.
2. Create `rest/components/orders.yaml` with schemas if needed.
3. Reference them from `rest/openapi.yaml` using `$ref`.
4. Run `npx @redocly/cli lint rest/openapi.yaml`.

### GraphQL

1. Create `graphql/modules/orders.graphql` with `extend type Query` / `extend type Mutation`.
2. Add your domain types in the same file.
3. Run the validation script.

## Checklist for any contract change

- [ ] Spec updated before or with implementation.
- [ ] All fields have descriptions (REST) or doc comments (GraphQL).
- [ ] Lint passes locally.
- [ ] Change classified: additive (safe) vs breaking.
- [ ] Breaking changes have migration plan and consumer notification.
- [ ] Examples provided for complex request/response shapes.
