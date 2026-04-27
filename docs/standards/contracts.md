# Contract Standards

## REST

- Source of truth: `packages/contracts/rest/openapi.yaml` (OpenAPI 3.x).
- Modular structure: paths split by domain in `rest/paths/`, shared schemas in `rest/components/`, referenced via `$ref`.
- Lint config: `packages/contracts/redocly.yaml` (Redocly CLI).
- Every new or modified endpoint MUST be reflected in the spec BEFORE or WITH the implementation PR.
- Run `npx @redocly/cli lint packages/contracts/rest/openapi.yaml` locally before pushing.
- CI runs `oasdiff breaking` against main to detect breaking changes.
- oasdiff resolves `$ref` across files natively.
- Breaking changes require: versioning strategy, migration plan, and consumer notification.

### What counts as breaking

- Removing a field from a response.
- Changing a field's type.
- Removing an endpoint.
- Making an optional field required.
- Changing status code semantics.

### What is safe (additive)

- Adding a new endpoint.
- Adding optional fields to responses.
- Adding optional query parameters.

## GraphQL

- Source of truth: `packages/contracts/graphql/schema.graphql` (entry point) + `graphql/modules/<domain>.graphql` (domain modules).
- Domain modules use `extend type Query`/`extend type Mutation` to add operations.
- All `.graphql` files are concatenated and validated as a single schema.
- Every new or modified type/operation MUST be reflected in the schema.
- CI runs `graphql-inspector diff` against main.
- Same breaking/additive rules as REST apply to schema fields.

## Rules

- If behavior or contract changes: update spec, docs, and tests.
- All spec fields must have `description` (REST) or doc comments (GraphQL).
- Examples should be provided for complex request/response shapes.
- Contract changes should be in their own task group to enable parallel work.

## Anti-patterns

- Do NOT implement an endpoint without updating the spec.
- Do NOT merge breaking changes without explicit approval.
- Do NOT use code-generated specs as the only source of truth — spec-first.
- Do NOT leave description fields empty.

## Checklist

- [ ] Spec updated.
- [ ] Spec lint passes.
- [ ] Diff reviewed (additive vs breaking).
- [ ] Breaking changes have migration plan.
- [ ] PR template contract section filled.
