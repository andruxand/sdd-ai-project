````skill
---
name: contract-diff-prep
description: Prepare REST or GraphQL contract work before checks run.
---

## Purpose
Ensure contract artifacts are ready and valid before CI contract workflows run.

## REST preparation
1. Verify `packages/contracts/rest/openapi.yaml` and referenced `paths/`/`components/` files are up to date.
2. Run local lint: `npx @redocly/cli lint packages/contracts/rest/openapi.yaml`.
3. Run local diff against `develop` (the PR target branch — not `main`):
   ```bash
   git show develop:packages/contracts/rest/openapi.yaml > /tmp/openapi-base.yaml
   oasdiff breaking /tmp/openapi-base.yaml packages/contracts/rest/openapi.yaml
````

4. Review diff output for unintended breaking changes.

## GraphQL preparation

1. Verify `packages/contracts/graphql/schema.graphql` and `graphql/modules/` are up to date.
2. Run local validation: concatenate all `.graphql` files and validate with `buildSchema()`.
3. Run local diff against `develop`:
   ```bash
   git show develop:packages/contracts/graphql/schema.graphql > /tmp/schema-base.graphql
   npx graphql-inspector diff /tmp/schema-base.graphql packages/contracts/graphql/schema.graphql
   ```
4. Review diff output.

## Pre-flight checklist

- [ ] Spec file updated with all endpoint/type changes.
- [ ] Local lint passes.
- [ ] Local diff reviewed.
- [ ] No unintended breaking changes.
- [ ] Descriptions present for new fields/endpoints.
- [ ] Examples present for complex types.

## Common mistakes

- Forgetting to update spec after handler changes.
- Adding breaking changes without versioning discussion.
- Spec and implementation drifting apart.

```

```
