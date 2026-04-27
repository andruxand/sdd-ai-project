---
applyTo: 'packages/contracts/**'
---

# Contract Instructions

- REST contracts use OpenAPI 3.1 in `packages/contracts/rest/`.
- GraphQL contracts use SDL in `packages/contracts/graphql/`.
- Never modify `openapi.yaml` or `schema.graphql` root files directly for new endpoints/types.
- REST: create modular files in `paths/` and `components/`, reference via `$ref` from `openapi.yaml`.
- GraphQL: create modules in `graphql/modules/` using `extend type Query` / `extend type Mutation`.
- Every REST path must have an `operationId`.
- Every REST response must include `4xx` and `5xx` error schemas.
  **Exception:** if an endpoint explicitly handles all error cases internally and always returns a `2xx` status (e.g., a health-check that returns `degraded` status with HTTP 200 on failures), do NOT document `5xx` responses — documenting them would make the spec inconsistent with the actual behavior. Add a comment in the path YAML explaining why 5xx is omitted.
- GraphQL mutations must return a union type or result type that includes error cases.
- Validate before committing:
  - REST: `npx @redocly/cli lint packages/contracts/rest/openapi.yaml`
  - GraphQL: `npx graphql-inspector validate 'packages/contracts/graphql/**/*.graphql'`
  - Or run both + codegen together: `npm run validate --workspace=packages/contracts`
- After any REST OpenAPI change, regenerate TypeScript types: `npm run generate:types --workspace=packages/contracts`
  - Commit the updated generated types — they are the contract between backend and frontend.
- Breaking changes are detected automatically by CI. If a breaking change is intentional, document it in the proposal.
