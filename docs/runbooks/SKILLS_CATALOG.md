# Skills Catalog

Catálogo completo de los 66 skills disponibles en `.github/skills/`.

Cada skill es un archivo `SKILL.md` que el agente carga con `read_file` antes de ejecutar su tarea.
Todos los skills son **activos**: cada agente los carga automáticamente cuando el contexto lo requiere.

---

## Tipos de skills

| Tipo                        | Descripción                                               | Cómo funciona                                                      |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| **Activo siempre (48)**     | Cargado en todas las invocaciones del agente              | No requiere acción del desarrollador                               |
| **Activo condicional (18)** | Cargado por el agente solo cuando el contexto lo requiere | El agente decide basándose en el qualifier en `## Skills to apply` |

> De los 18 skills condicionales, 5 son UI library skills mutuamente excluyentes (solo uno activo por proyecto tras el bootstrap). Los otros 13 se activan según las características del feature.

---

## Skills activos por categoría

### Backend (26 activos)

| Skill                       | Agente(s) que lo carga                                                  | Tipo        | Propósito                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serverless-endpoint`       | `@backend-implementer`                                                  | siempre     | Estructura de handler Serverless v4                                                                                                                   |
| `backend-task-execution`    | `@backend-implementer`                                                  | siempre     | Checklist de ejecución de tareas backend                                                                                                              |
| `backend-test-hardening`    | `@tester-backend`                                                       | siempre     | Estrategia y patrones de tests unitarios/integración                                                                                                  |
| `log-sanitization`          | `@backend-implementer`, `@observability-implementer`                    | siempre     | Sanitización de logs, sin PII                                                                                                                         |
| `observability-hardening`   | `@observability-implementer`                                            | siempre     | Logs estructurados, X-Ray tracing, métricas                                                                                                           |
| `dynamodb-patterns`         | `@backend-implementer`                                                  | siempre     | Patrones DynamoDB (single-table, GSI, queries)                                                                                                        |
| `async-patterns`            | `@backend-implementer`                                                  | siempre     | Patrones asíncronos (SQS, EventBridge, SNS)                                                                                                           |
| `idempotency-patterns`      | `@backend-implementer`, `@tester-backend`                               | siempre     | Idempotencia en handlers (first call, duplicate, in-flight)                                                                                           |
| `cognito-auth-patterns`     | `@backend-implementer`                                                  | siempre     | Autenticación con Cognito, JWT verification                                                                                                           |
| `domain-error-hierarchy`    | `@backend-implementer`                                                  | siempre     | Jerarquía de errores de dominio tipados                                                                                                               |
| `lambda-performance`        | `@backend-implementer`                                                  | siempre     | Cold start, memory tuning, connection pooling                                                                                                         |
| `feature-flags`             | `@backend-implementer`, `@frontend-implementer`                         | siempre     | Feature flags / kill switches                                                                                                                         |
| `input-validation-patterns` | `@backend-implementer`                                                  | siempre     | Validación de input con Zod                                                                                                                           |
| `secret-management`         | `@backend-implementer`                                                  | siempre     | Gestión de secretos con SSM / Secrets Manager                                                                                                         |
| `api-versioning`            | `@backend-implementer`                                                  | siempre     | Versionado de API REST                                                                                                                                |
| `circuit-breaker`           | `@backend-implementer`                                                  | siempre     | Circuit breaker para llamadas externas                                                                                                                |
| `deployment-canary`         | `@backend-implementer`, `@reviewer`                                     | siempre     | Despliegue canary, rollback Lambda                                                                                                                    |
| `load-testing-k6`           | `@tester-backend`, `@reviewer`                                          | siempre     | Tests de carga con k6, thresholds como CI gate                                                                                                        |
| `webhook-patterns`          | `@backend-implementer`, `@security`                                     | condicional | HMAC-SHA256 verification, replay prevention — cuando hay webhook receiver                                                                             |
| `http-client-retry`         | `@backend-implementer`                                                  | siempre     | Exponential backoff + full jitter, cockatiel, AWS SDK adaptive retry                                                                                  |
| `encryption-patterns`       | `@backend-implementer`, `@security`                                     | condicional | AES-256-GCM envelope encryption, KMS CMK — cuando se maneja PII/datos sens                                                                            |
| `dynamodb-migrations`       | `@backend-implementer`                                                  | condicional | Lazy migration con `_v`, GSI sin downtime, backfill Lambda                                                                                            |
| `websocket-apigateway`      | `@backend-implementer`                                                  | condicional | WebSocket API GW, JWT authorizer, fan-out, conexiones stale                                                                                           |
| `serverless-baseline`       | `@backend-implementer`, `@openspec`                                     | condicional | Tags, deployment bucket, packaging, naming — al crear/revisar serverless.ts                                                                           |
| `middy-patterns`            | `@backend-implementer`, `@tester-backend`                               | siempre     | Middy v5 middleware chain, custom middlewares, SQS partial batch failure                                                                              |
| `s3-storage-patterns`       | `@backend-implementer`, `@tester-backend`                               | condicional | Pre-signed URLs, SSE-KMS, lifecycle, CORS, IAM — cuando el feature usa S3                                                                             |
| `powertools-patterns`       | `@backend-implementer`, `@tester-backend`, `@observability-implementer` | siempre     | Powertools Logger/Tracer/Metrics singleton, Middy integration, subsegments, métricas con dimensiones, cold start, idempotency, mocks en tests         |
| `ddd-hexagonal-patterns`    | `@backend-implementer`, `@tester-backend`                               | siempre     | Aggregate root (factory + reconstitute), Value Object inmutable, Domain Events, Repository port interface, Use Case input/output DTO, dependency rule |

### Frontend (17 activos)

| Skill                      | Agente(s) que lo carga                                                    | Tipo        | Propósito                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-patterns`           | `@frontend-implementer`, `@tester-frontend`                               | siempre     | React 19: hooks, memoización, efectos, composición, concurrent, TypeScript                                                                            |
| `frontend-task-execution`  | `@frontend-implementer`                                                   | siempre     | Checklist de ejecución de tareas frontend                                                                                                             |
| `frontend-test-hardening`  | `@tester-frontend`                                                        | siempre     | Estrategia y patrones de tests de componentes                                                                                                         |
| `e2e-flow-hardening`       | `@e2e-tester`                                                             | siempre     | Patrones Playwright, resilencia, CI gate                                                                                                              |
| `react-fsd-feature`        | `@frontend-implementer`                                                   | siempre     | Arquitectura Feature-Sliced Design                                                                                                                    |
| `storybook-component`      | `@frontend-implementer`                                                   | siempre     | Creación de stories en Storybook                                                                                                                      |
| `component-governance`     | `@frontend-implementer`, `@tester-frontend`                               | siempre     | Inventario antes de crear, árbol reuso→extensión→nuevo, API escalable de props, slots, `as` polimórfico, `forwardRef`, deprecación en dos pasos       |
| `react-query-patterns`     | `@frontend-implementer`, `@tester-frontend`                               | siempre     | Server state con TanStack Query                                                                                                                       |
| `form-validation-patterns` | `@frontend-implementer`, `@tester-frontend`                               | siempre     | Formularios con React Hook Form + Zod                                                                                                                 |
| `msw-mock-patterns`        | `@tester-backend`, `@tester-frontend`                                     | siempre     | Mocking HTTP/GraphQL con MSW                                                                                                                          |
| `graphql-client-patterns`  | `@frontend-implementer`                                                   | siempre     | Apollo Client: queries, mutations, cache                                                                                                              |
| `accessibility-a11y`       | `@frontend-implementer`, `@tester-frontend`                               | siempre     | WCAG 2.1 AA, ARIA, focus, axe-core                                                                                                                    |
| `core-web-vitals`          | `@frontend-implementer`, `@reviewer`                                      | siempre     | LCP/INP/CLS, Vite img, cache headers                                                                                                                  |
| `cloudfront-spa-deploy`    | `@frontend-implementer`                                                   | condicional | OAC + S3, cache behaviors, deploy CI                                                                                                                  |
| `zustand-patterns`         | `@frontend-implementer`, `@tester-frontend`                               | siempre     | Zustand: stores, selectors, devtools, persistence, React Query boundary                                                                               |
| `css-modules-patterns`     | `@frontend-implementer`                                                   | siempre     | CSS Modules, tokens, `composes`, `data-*`, responsive, animaciones                                                                                    |
| `datadog-rum-patterns`     | `@frontend-implementer`, `@tester-frontend`, `@observability-implementer` | siempre     | `datadogRum.init()`, `defaultPrivacyLevel`, `allowedTracingUrls`, session replay, `setUser`/`clearUser`, custom actions, trace correlation, test mock |
| `vitest-patterns`          | `@tester-backend`, `@tester-frontend`                                     | siempre     | `vi.mock()` hoisting, `vi.hoisted()`, `vi.fn()`/`vi.spyOn()`, `aws-sdk-client-mock`, MSW, `renderWithProviders`, coverage config, setup files         |

### Contracts (3 activos)

| Skill                | Agente(s) que lo carga   | Propósito                                        |
| -------------------- | ------------------------ | ------------------------------------------------ |
| `contract-rest`      | `@contracts-implementer` | Diseño y actualización de OpenAPI                |
| `contract-graphql`   | `@contracts-implementer` | Diseño y actualización de schema GraphQL         |
| `contract-diff-prep` | `@contracts-implementer` | Diff de contratos, detección de breaking changes |

### UI Libraries (5 — mutuamente excluyentes)

Solo uno de estos skills existe en disco después del bootstrap. El activo lo determina `ui_library` en `openspec/config.yaml`.
Ver [docs/standards/ui-libraries.md](../standards/ui-libraries.md) para criterio de selección.

| Skill                | `ui_library` value | Agente(s) que lo carga                      | Propósito                                                        |
| -------------------- | ------------------ | ------------------------------------------- | ---------------------------------------------------------------- |
| `tailwind-patterns`  | `tailwind`         | `@frontend-implementer`, `@tester-frontend` | `cn()`/`cva`, responsive, `dark:`, Storybook, anti-mezclas       |
| `mui-patterns`       | `mui`              | `@frontend-implementer`, `@tester-frontend` | `createTheme`, `sx` vs `styled()`, overrides, TypeScript augment |
| `antd-patterns`      | `antd`             | `@frontend-implementer`, `@tester-frontend` | `ConfigProvider`/token, Form, Table, `App.useApp()`, dark algo   |
| `chakra-patterns`    | `chakra`           | `@frontend-implementer`, `@tester-frontend` | `createSystem`, semantic tokens, recipes, v3 API                 |
| `bootstrap-patterns` | `bootstrap`        | `@frontend-implementer`, `@tester-frontend` | SCSS pipeline, `react-bootstrap` API, Grid, Form, dark mode      |

### Cross-cutting (12 activos)

| Skill                         | Agente(s) que lo carga                                                                 | Propósito                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dependency-vetting`          | `@backend-implementer`, `@frontend-implementer`, `@pr-comment-resolver`, `@reviewer`   | siempre (condicional: al instalar paquetes o al resolver comentarios de PR sobre librerías) | Protocolo pre-install: lookup de skills, auditoría de seguridad, licencias, tamaño de bundle; protocolo post-PR-comment: actualizar skill del paquete en la misma sesión |
| `openspec-proposal`           | `@openspec`                                                                            | Generación de proposal.md + design.md + tasks.md                                            |
| `feature-routing`             | `@openspec`                                                                            | Routing de features al agente correcto                                                      |
| `risk-assessment`             | `@reviewer`, `@openspec`                                                               | Clasificación de riesgo del cambio                                                          |
| `aws-well-architected-review` | `@reviewer`, `@security`                                                               | Revisión de los 5 pilares Well-Architected                                                  |
| `security`                    | `@security`                                                                            | OWASP Top 10, API Security Top 10, IAM hardening, CSP/JWT, supply-chain CI                  |
| `pr-prep`                     | `@reviewer`                                                                            | Preparación del PR body                                                                     |
| `pr-comment-resolution`       | `@pr-comment-resolver`                                                                 | Clasificación y resolución de comentarios de PR                                             |
| `comment-learning`            | `@pr-comment-resolver`                                                                 | Aprendizaje de patrones de comentarios repetidos                                            |
| `review-learning-update`      | `@reviewer`                                                                            | Actualización de conocimiento post-review                                                   |
| `jira-intake`                 | `@openspec`                                                                            | Ingesta de tickets Jira al flujo OpenSpec                                                   |
| `typescript-patterns`         | `@backend-implementer`, `@frontend-implementer`, `@tester-backend`, `@tester-frontend` | siempre                                                                                     | Branded types, discriminated unions, Zod como fuente de tipos, generics, no `any`                                                                                        |

---

## Agregar un nuevo skill

1. Crear el directorio `.github/skills/{nombre-del-skill}/`.
2. Crear `.github/skills/{nombre-del-skill}/SKILL.md` con:
   - Tipo: `always-active` o `conditional-active`
   - Cuándo aplicarlo (qualifier para condicional)
   - Reglas concretas (no principios genéricos)
   - Ejemplos de código cuando aplique
3. Agregar a `## Skills to apply` del agente correspondiente:
   - Siempre activo: `- \`skill-name\` — descripción breve.`
   - Condicional: `- \`skill-name\` — cuándo aplicar. Detalle de cobertura.`
4. Actualizar la cuenta en `README.md`, `QUICK_REFERENCE.md`, y `docs/onboarding/02_VALIDATE_INSTALLATION.md`.
5. Agregar al perfil YAML correspondiente en `agent-os/profiles/`.
