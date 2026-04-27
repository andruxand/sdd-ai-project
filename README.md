# SDD + AI Template Repository v3

Template corporativo parametrizable para proyectos nuevos con SDLC guiado por IA:
OpenSpec, Agent OS, VS Code + GitHub Copilot, gates de seguridad, calidad,
contratos, observabilidad y rollback.

---

## Para un nuevo desarrollador

**[docs/onboarding/NEW_DEV_START_HERE.md](docs/onboarding/NEW_DEV_START_HERE.md)**

Ese documento es el único que necesitas leer para empezar desde cero.

---

## Setup inicial

```bash
nvm use                  # Node.js 22 (ver .nvmrc)
npm install              # instala dependencias y configura git hooks (husky)
npm run bootstrap        # configura el template según tu proyecto (interactivo)
npm run validate         # verifica que todo está en orden
```

> Para ver qué haría el bootstrap sin modificar nada: `npm run bootstrap:preview`

---

## Flujo de features (día a día)

OpenSpec es **agent-driven** — no hay CLI. El flujo arranca en Copilot Chat:

1. Abre Copilot Chat en VS Code (`Cmd+Shift+I`)
2. Escribe `@openspec nueva feature: [descripción breve]`
3. El agente guía el flujo completo: intake → proposal → design → tasks → implementación → PR

Para validar los artefactos OpenSpec generados: `npm run openspec:validate`

---

## Scripts disponibles

### Raíz del monorepo

| Script                      | Qué hace                                                    |
| --------------------------- | ----------------------------------------------------------- |
| `npm run dev`               | Arranca API + Web en paralelo (Turborepo, ambos servidores) |
| `npm run dev:api`           | Solo el backend — `serverless offline` en puerto 3000       |
| `npm run dev:web`           | Solo el frontend — Vite dev server en puerto 5173           |
| `npm run build`             | Build de todos los workspaces (Turborepo, con caché)        |
| `npm run validate`          | lint + format + typecheck + coverage (Turborepo)            |
| `npm run lint`              | ESLint en todos los workspaces                              |
| `npm run format`            | Prettier (write) en todos los workspaces                    |
| `npm run typecheck`         | TypeScript check (Turborepo)                                |
| `npm run test`              | Tests (Turborepo)                                           |
| `npm run coverage`          | Coverage report (Turborepo)                                 |
| `npm run openspec:validate` | Valida artefactos OpenSpec en `openspec/`                   |
| `npm run bootstrap`         | Configura el template según tu proyecto (interactivo)       |
| `npm run bootstrap:preview` | Pre-visualiza qué haría el bootstrap sin modificar          |

### `services/api` (backend serverless)

| Script                 | Qué hace                                              |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | `serverless offline start` — API local en puerto 3000 |
| `npm run dev:watch`    | Igual que `dev` con recarga automática de handlers    |
| `npm run deploy:dev`   | Deploy a AWS stage `dev`                              |
| `npm run deploy:prod`  | Deploy a AWS stage `prod`                             |
| `npm run invoke:local` | Invoca un handler Lambda localmente (sin HTTP)        |
| `npm run logs:dev`     | Tail de CloudWatch Logs del stage `dev`               |
| `npm run sls:print`    | Imprime la configuración Serverless resuelta          |
| `npm run sls:package`  | Genera el artefacto ZIP sin desplegarlo               |
| `npm run test`         | Vitest (una pasada)                                   |
| `npm run test:watch`   | Vitest en modo watch (TDD)                            |
| `npm run coverage`     | Cobertura de tests                                    |

### `apps/web` (frontend React + Vite)

| Script                    | Qué hace                                             |
| ------------------------- | ---------------------------------------------------- |
| `npm run dev`             | Vite dev server en puerto 5173; proxy `/api → :3000` |
| `npm run build`           | Typecheck + Vite build de producción en `dist/`      |
| `npm run preview`         | Sirve `dist/` localmente (puerto 4173)               |
| `npm run test`            | Vitest (una pasada)                                  |
| `npm run test:watch`      | Vitest en modo watch                                 |
| `npm run test:ui`         | Vitest con interfaz gráfica                          |
| `npm run test:e2e`        | Playwright E2E tests                                 |
| `npm run test:e2e:ui`     | Playwright con UI mode (debug visual)                |
| `npm run test:e2e:report` | Abre el reporte HTML de la última corrida E2E        |
| `npm run storybook`       | Storybook dev server en puerto 6006                  |
| `npm run storybook:build` | Build estático de Storybook                          |
| `npm run coverage`        | Cobertura de tests                                   |

### `packages/contracts`

| Script                   | Qué hace                                         |
| ------------------------ | ------------------------------------------------ |
| `npm run lint:openapi`   | Valida el OpenAPI spec con Redocly               |
| `npm run lint:graphql`   | Valida el schema GraphQL con graphql-inspector   |
| `npm run generate:types` | Genera `rest/types.gen.ts` desde el OpenAPI spec |
| `npm run validate`       | Corre `lint:openapi` + `lint:graphql`            |

---

## Perfiles de bootstrap

- **Topología**: monorepo, split-repos
- **Alcance**: backend-only, frontend-only, fullstack
- **Contratos**: rest, graphql, both, none
- **Criticidad**: standard, hardened, critical
- **Design system**: with-design-system, without-design-system

---

## Módulos incluidos

`storybook` · `playwright` · `contract-rest` · `contract-graphql` ·
`observability-pack` · `aws-pack` · `release-pack` · `qodo-pack` · `changesets-pack`

---

## Qué hace bootstrap

El bootstrap (`npm run bootstrap`) adapta TODO el repo según tus respuestas:

- Elimina carpetas no aplicables (`apps/web`, `services/api`, `packages/contracts`, `packages/shared/ui`).
- Deshabilita workflows de CI que no aplican.
- Elimina agentes, skills y standards docs que no corresponden al scope elegido.
- Adapta `copilot-instructions.md`, `AGENTS.md` y `extensions.json`.
- Genera `.generated/active-profile.yaml` (perfil Agent OS) y `.generated/next-steps.md`.

---

## IA: agentes, skills y prompts

| Tipo                   | Cantidad | Ubicación          |
| ---------------------- | -------- | ------------------ |
| Agentes especializados | 11       | `.github/agents/`  |
| Skills de dominio      | 59       | `.github/skills/`  |
| Prompts reutilizables  | 9        | `.github/prompts/` |

Routing y flujo documentado en [AGENTS.md](AGENTS.md). Catálogo completo de skills en [docs/runbooks/SKILLS_CATALOG.md](docs/runbooks/SKILLS_CATALOG.md).

### Skills: activos siempre vs condicionales

Los 59 skills son todos **activos** — cargados automáticamente por el agente cuando el contexto lo requiere.
Algunos tienen un qualifier ("cuando...") que determina si el agente los carga en cada invocación:

- **Siempre activos (38)** — el agente los carga en toda invocación.
- **Condicionales (10)** — el agente los carga solo si el feature coincide con la condición del qualifier.

Ver catálogo completo y qualifiers en [docs/runbooks/SKILLS_CATALOG.md](docs/runbooks/SKILLS_CATALOG.md).

Agentes: `@openspec` · `@contracts-implementer` · `@backend-implementer` · `@frontend-implementer`
· `@observability-implementer` · `@tester-backend` · `@tester-frontend` · `@e2e-tester`
· `@security` · `@reviewer` · `@pr-comment-resolver`.

---

## Archivos clave

| Archivo                | Propósito                                            |
| ---------------------- | ---------------------------------------------------- |
| `CONTRIBUTING.md`      | Branch naming, commits, PR workflow, flujo SDD       |
| `.env.example`         | Variables de entorno esperadas (copiar a `.env`)     |
| `agent-os/profiles/`   | Perfiles YAML de Agent OS por scope                  |
| `openspec/config.yaml` | Configuración del flujo OpenSpec                     |
| `docs/runbooks/`       | Runbooks operacionales (CI/CD, AWS, contracts, etc.) |
| `docs/governance/`     | Risk matrix, rollback policy                         |

---

## Onboarding

Todo el onboarding detallado está en
[docs/onboarding/NEW_DEV_START_HERE.md](docs/onboarding/NEW_DEV_START_HERE.md).
