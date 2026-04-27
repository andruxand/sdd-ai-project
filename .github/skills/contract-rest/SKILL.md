````skill
---
name: contract-rest
description: Update or validate REST contract artifacts and workflow integration points.
---

## Context
Contract format: OpenAPI 3.x (YAML).
Entry point: `packages/contracts/rest/openapi.yaml`.
Modular structure: paths in `rest/paths/`, components in `rest/components/`, referenced via `$ref`.
Redocly config: `packages/contracts/redocly.yaml` (lint rules, multi-API support).
Diff tool: oasdiff (CI workflow: `.github/workflows/contracts-rest.yml`).

## When this skill applies
- New endpoint added.
- Existing endpoint request/response shape changed.
- Path, method, query params, headers, or status codes changed.
- Auth requirements for an endpoint changed.

## Process
1. Update or create the OpenAPI spec. Add paths in `rest/paths/<domain>.yaml`, schemas in `rest/components/<domain>.yaml`.
2. Reference new files from `rest/openapi.yaml` using `$ref`.
3. Validate spec: `npx @redocly/cli lint packages/contracts/rest/openapi.yaml`.
4. Run diff against `develop` (the PR target — not `main`):
   ```bash
   git show develop:packages/contracts/rest/openapi.yaml > /tmp/openapi-base.yaml
   oasdiff breaking /tmp/openapi-base.yaml packages/contracts/rest/openapi.yaml
````

5. Classify change: additive (safe) vs breaking (requires versioning/approval).
6. If breaking: document migration path and notify consumers.

## Breaking change examples

- Removing a field from response.
- Changing a field type.
- Removing an endpoint.
- Making an optional field required.
- Changing status code semantics.

## Additive change examples (safe)

- Adding a new endpoint.
- Adding an optional field to response.
- Adding a new query parameter (optional).

## Anti-patterns

- Do NOT modify an endpoint without updating the OpenAPI spec.
- Do NOT merge breaking changes without explicit consumer coordination.
- Do NOT generate specs from code as the only source of truth — spec-first.
- Do NOT leave `description` fields empty in the spec.

## Checklist

- [ ] OpenAPI spec updated.
- [ ] Spec validates without errors.
- [ ] Diff classified (additive / breaking).
- [ ] Breaking changes have migration plan.
- [ ] PR template contract section filled.

```

```
