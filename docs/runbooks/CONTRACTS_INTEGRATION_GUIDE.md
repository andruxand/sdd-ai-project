# Contracts Integration Guide

Este runbook explica cómo integrar y trabajar con contratos API en el template.

## Referencia principal

La guía completa de estructura, comandos y workflow está en:

> **[packages/contracts/README.md](../../packages/contracts/README.md)**

Ese README cubre:

- estructura modular (entry points + domain splits)
- cómo agregar nuevos dominios (REST y GraphQL)
- comandos de lint, bundle, diff
- checklist para cualquier cambio de contrato
- cuándo usar múltiples entry points

## Resumen rápido

### REST (OpenAPI)

- Entry point: `packages/contracts/rest/openapi.yaml`
- Paths por dominio: `rest/paths/<dominio>.yaml`
- Componentes compartidos: `rest/components/<dominio>.yaml`
- Config lint: `packages/contracts/redocly.yaml`

```bash
# lint
npx @redocly/cli lint rest/openapi.yaml

# bundle
npx @redocly/cli bundle rest/openapi.yaml -o dist/openapi.yaml

# diff (breaking changes)
oasdiff breaking <main-spec> rest/openapi.yaml
```

### GraphQL

- Entry point: `packages/contracts/graphql/schema.graphql`
- Módulos por dominio: `graphql/modules/<dominio>.graphql`
- Patrón: `extend type Query` / `extend type Mutation`

```bash
# validate
npx graphql-inspector validate 'graphql/**/*.graphql'

# diff
npx graphql-inspector diff <main-schema> 'graphql/**/*.graphql'
```

## Herramientas necesarias

| Tool                     | Para qué                           | Instalación                       |
| ------------------------ | ---------------------------------- | --------------------------------- |
| `@redocly/cli`           | Lint + bundle OpenAPI              | `npm i -g @redocly/cli`           |
| `oasdiff`                | Detección de breaking changes REST | `brew install oasdiff`            |
| `@graphql-inspector/cli` | Validación + diff GraphQL          | `npm i -g @graphql-inspector/cli` |

Ver `docs/onboarding/01_INSTALL_TOOLS_STEP_BY_STEP.md` para instrucciones completas.

## CI

- REST: `.github/workflows/contracts-rest.yml` — lint y diff automático en PR.
- GraphQL: `.github/workflows/contracts-graphql.yml` — validación y diff automático en PR.
- Ambos tienen guards: si el spec no existe, el workflow se salta silenciosamente.

## Flujo SDD

1. El `@openspec` agent o el `contracts-implementer` propone cambios al contrato.
2. Los skills `contract-rest`, `contract-graphql` y `contract-diff-prep` guían la implementación.
3. CI valida lint y breaking changes automáticamente.
4. El estándar `docs/standards/contracts.md` define las reglas de gobierno.

## AWS IaC note

If you enable the AWS pack, also review the `cfn-lint` and `CloudFormation Guard` placeholder workflows.
