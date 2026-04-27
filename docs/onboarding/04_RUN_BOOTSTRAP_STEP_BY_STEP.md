# 04. Run Bootstrap Step by Step

## Objetivo

Materializar el repo final según el tipo de proyecto.

## Paso 1

En terminal:

```bash
npm run bootstrap
```

## Paso 2

Navega con las flechas ↑↓ del teclado y confirma con Enter.

### Opciones de cada pregunta

### topology

| Opción        | Cuándo usarla                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `monorepo`    | Frontend y backend en el mismo repositorio (recomendado).                                           |
| `split-repos` | Frontend y backend en repositorios separados. Solo compatible con `backend-only` o `frontend-only`. |

### scope

| Opción          | Cuándo usarla                                                            |
| --------------- | ------------------------------------------------------------------------ |
| `fullstack`     | El repo incluye frontend (`apps/web`) y backend (`services/api`).        |
| `backend-only`  | Solo API/serverless. Se elimina `apps/web` y agentes/skills de frontend. |
| `frontend-only` | Solo React. Se elimina `services/api` y agentes/skills de backend.       |

### contracts

| Opción    | Cuándo usarla                                            |
| --------- | -------------------------------------------------------- |
| `rest`    | API REST con OpenAPI. Se activa Redocly + oasdiff.       |
| `graphql` | API GraphQL. Se activa graphql-inspector.                |
| `both`    | Ambas superficies.                                       |
| `none`    | Sin contratos formales. Se elimina `packages/contracts`. |

> **criticality** se deriva automáticamente: `frontend-only` sin contratos → `standard`; cualquier otro caso → `hardened`.
> Puedes cambiarlo después en `openspec/config.yaml` si el proyecto escala a `critical` (pagos, auth, compliance).

### designSystem

| Opción                  | Cuándo usarla                                                              |
| ----------------------- | -------------------------------------------------------------------------- |
| `with-design-system`    | El proyecto usa una UI library. Habilita `packages/shared/ui` y Storybook. |
| `without-design-system` | Sin UI library. Se elimina `packages/shared/ui` y Storybook.               |

### uiLibrary (solo si `with-design-system`)

| Opción      | Notas                                                   |
| ----------- | ------------------------------------------------------- |
| `tailwind`  | Tailwind CSS v3. Bootstrap genera `tailwind.config.js`. |
| `mui`       | Material UI v5 + Emotion.                               |
| `antd`      | Ant Design v5 (tipos TS incluidos).                     |
| `chakra`    | Chakra UI v3 + Emotion.                                 |
| `bootstrap` | Bootstrap + React-Bootstrap.                            |
| `none`      | CSS Modules u otra solución custom.                     |

### Módulos

Cada módulo se confirma con `Y`/`n`:

| Módulo               | Qué activa                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| `storybook`          | Storybook para desarrollo y testing visual de componentes (frontend).      |
| `playwright`         | Tests end-to-end con Playwright.                                           |
| `contract-rest`      | OpenAPI spec, Redocly linting y detección de breaking changes con oasdiff. |
| `contract-graphql`   | Schema GraphQL + validación con graphql-inspector.                         |
| `observability-pack` | Logging estructurado, tracing X-Ray/Datadog y métricas CloudWatch.         |
| `aws-pack`           | Workflows de cfn-lint, cfn-guard y Checkov para IaC AWS.                   |
| `release-pack`       | Workflow de releases automáticos (GitHub Releases + tagging).              |
| `qodo-pack`          | Integración de Qodo AI para code review en PRs.                            |
| `changesets-pack`    | Changesets para versionado y changelogs en monorepos.                      |

### Ejemplo típico

- topology: `monorepo`
- scope: `fullstack`
- contracts: `both`
- design system: `with-design-system`
- ui library: `tailwind`
- storybook: `Y`, playwright: `Y`, contract-rest: `Y`, contract-graphql: `Y`
- observability-pack: `Y`, aws-pack: `Y`, release-pack: `Y`, qodo-pack: `Y`
- changesets-pack: `Y` o `n` según el caso

## Paso 3

Qué debe pasar
El bootstrap:

- deja `.generated/bootstrap-selection.json` con tus respuestas
- deja `.generated/active-profile.yaml` con el perfil Agent OS activo
- deja `.generated/next-steps.md` con pasos manuales pendientes
- activa/desactiva workflows según módulos
- elimina carpetas no aplicables (ej: `apps/web` si backend-only)
- elimina agentes, skills y standards que no aplican al scope elegido
- adapta `copilot-instructions.md`, `AGENTS.md` y `extensions.json` al scope

## Paso 4

Revisa resultado
Abre:

- `.generated/bootstrap-selection.json`
- `.generated/active-profile.yaml`
- `.generated/next-steps.md`

## Paso 5

Si elegiste backend-only
No debería quedar `apps/web`.

## Paso 6

Si elegiste frontend-only
No debería quedar `services/api`.

## Paso 7

Si desactivaste Storybook
No debería quedar `.storybook` ni stories.

## Paso 8

Si desactivaste contratos GraphQL o REST
Los workflows no aplicables deben quedar desactivados.

## Paso 9

Verifica que los agentes y skills del repo correspondan a tu scope.

Si elegiste `backend-only`:

- NO deben existir: `frontend-implementer`, `tester-frontend`, `e2e-tester` en `.github/agents/`
- NO deben existir skills de frontend como `react-fsd-feature`, `storybook-component`

Si elegiste `frontend-only`:

- NO deben existir: `backend-implementer`, `contracts-implementer`, `observability-implementer`, `tester-backend` en `.github/agents/`
- NO deben existir skills de backend como `serverless-endpoint`, `aws-well-architected-review`

## Paso 10

Revisa `.generated/active-profile.yaml` para confirmar:

- scope, topology y contracts correctos
- módulos habilitados/deshabilitados
- skills y agentes listados corresponden a los que quedaron en el repo
