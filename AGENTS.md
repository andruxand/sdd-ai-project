# AGENTS

Este proyecto usa **11 agentes especializados** invocables desde Copilot Chat con `@nombre`.
El flujo es **secuencial y explícito**: cada agente hace una sola cosa, entrega un handoff, y el siguiente lo recoge.

> **Regla fundamental:** nunca implementes sin un spec aprobado en `openspec/changes/`. El agente `@openspec` es siempre el punto de entrada.

---

## Agentes disponibles

| Agente                       | Rol                                                                 | Cuándo usarlo                                                                            |
| ---------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@openspec`                  | Genera proposal, design y tasks. Punto de entrada de todo feature.  | Siempre al iniciar un feature o cambio                                                   |
| `@backend-implementer`       | Implementa handlers, use cases, validación, logs (serverless/AWS)   | Cuando tasks.md tiene tareas de backend                                                  |
| `@frontend-implementer`      | Implementa componentes React, Storybook, FSD layers                 | Cuando tasks.md tiene tareas de frontend                                                 |
| `@contracts-implementer`     | Actualiza OpenAPI/GraphQL. Siempre antes o junto al backend.        | Cuando el feature agrega o modifica endpoints                                            |
| `@observability-implementer` | Agrega logs estructurados, tracing (X-Ray/Datadog), métricas        | Cuando tasks.md tiene tareas de observabilidad                                           |
| `@tester-backend`            | Tests unitarios e integración para backend (vitest)                 | Después de `@backend-implementer`                                                        |
| `@tester-frontend`           | Tests de componentes (Vitest + Testing Library)                     | Después de `@frontend-implementer`                                                       |
| `@e2e-tester`                | Tests de user journeys con Playwright                               | Después de frontend, si el perfil tiene playwright                                       |
| `@security`                  | Revisión adversarial: auth, PII, IAM, WAF, throttling, OWASP Top 10 | Obligatorio si risk≥medium, o el feature toca endpoints públicos, auth flows, IAM, o WAF |
| `@reviewer`                  | Revisa todo vs el spec, genera el PR body                           | Siempre antes de abrir el PR                                                             |
| `@pr-comment-resolver`       | Clasifica y resuelve comentarios de revisores                       | Solo cuando hay feedback en el PR                                                        |

---

## Flujo por tipo de proyecto

Cada proyecto tiene un perfil activo en `.generated/active-profile.yaml` generado por el bootstrap.
Ese perfil determina qué agentes aplican. Los corchetes `[ ]` indican pasos condicionales.

### backend-only

```
FASE 1 — SPEC (sesión propia)
  @openspec → intake → crea branch feat/JIRA-KEY desde `develop` automáticamente
           → genera proposal.md + design.md + tasks.md → /handoff

FASE 2 — CONTRATOS (sesión propia, solo si el feature toca API)
  @contracts-implementer → actualiza openapi.yaml → /handoff

FASE 3 — IMPLEMENTACIÓN BACKEND (sesión propia)
  @backend-implementer → implementa handlers + use cases → /handoff

FASE 4 — OBSERVABILIDAD (sesión propia, si tasks.md tiene tareas de observabilidad)
  @observability-implementer → logs + tracing + métricas → /handoff

FASE 5 — TESTS (sesión propia)
  @tester-backend → unit tests + integration tests → /handoff

FASE 6 — SEGURIDAD (sesión propia)
  @security → revisión adversarial → hallazgos documentados
  ┌─ Cuándo es obligatorio:
  │  • risk ≥ medium en el spec
  │  • el feature agrega o modifica endpoints públicos
  │  • cambios en auth / Cognito / JWT
  │  • cambios en IAM roles o policies
  │  • cambios en WAF, API GW throttling, o VPC
  └─ En caso de duda: ejecutar. El costo de omitir es mayor.

FASE 7 — REVIEW (sesión propia)
  @reviewer → verifica vs spec + genera PR body

[POST-PR, si hay feedback]
  @pr-comment-resolver → clasifica y resuelve comentarios
```

### frontend-only

```
FASE 1 — SPEC (sesión propia)
  @openspec → intake → crea branch feat/JIRA-KEY desde `develop` automáticamente
           → genera proposal.md + design.md + tasks.md → /handoff

FASE 2 — IMPLEMENTACIÓN FRONTEND (sesión propia)
  @frontend-implementer → componentes + Storybook → /handoff

FASE 3 — TESTS (sesión propia)
  @tester-frontend → Vitest + Testing Library → /handoff

FASE 4 — E2E (sesión propia, si el perfil tiene playwright)
  @e2e-tester → Playwright journeys → /handoff

FASE 5 — SEGURIDAD (sesión propia)
  @security → revisión adversarial → hallazgos documentados
  ┌─ Cuándo es obligatorio:
  │  • risk ≥ medium en el spec
  │  • formularios con datos sensibles o PII
  │  • flows de autenticación en UI
  │  • SDKs de terceros con acceso a datos del usuario
  └─ En caso de duda: ejecutar.

FASE 6 — REVIEW (sesión propia)
  @reviewer → verifica vs spec + genera PR body

[POST-PR, si hay feedback]
  @pr-comment-resolver → clasifica y resuelve comentarios
```

### fullstack-monorepo

```
FASE 1 — SPEC (sesión propia)
  @openspec → intake → crea branch feat/JIRA-KEY desde `develop` automáticamente
           → genera proposal.md + design.md + tasks.md → /handoff

FASE 2 — CONTRATOS (sesión propia)
  @contracts-implementer → actualiza openapi.yaml / graphql schema
                         → produce "contract note" en chat para el frontend
                         → /handoff

FASE 3 — IMPLEMENTACIÓN BACKEND (sesión propia)
  @backend-implementer → handlers + use cases + validación → /handoff

FASE 4 — IMPLEMENTACIÓN FRONTEND (sesión propia)
  @frontend-implementer → lee contract note de handoff.md § Contract notes
                       → componentes + Storybook → /handoff

FASE 5 — OBSERVABILIDAD (sesión propia)
  @observability-implementer → logs + tracing + métricas → /handoff
  > Incluye observabilidad frontend cuando el perfil incluye frontend:
  > web vitals, error boundaries con telemetría, y RUM básico.

FASE 6 — TESTS BACKEND (sesión propia)
  @tester-backend → unit + integration tests → /handoff

FASE 7 — TESTS FRONTEND (sesión propia)
  @tester-frontend → Vitest + Testing Library → /handoff

FASE 8 — E2E (sesión propia)
  @e2e-tester → Playwright journeys → /handoff

FASE 9 — SEGURIDAD (sesión propia)
  @security → revisión adversarial → hallazgos documentados
  ┌─ Cuándo es obligatorio:
  │  • risk ≥ medium en el spec
  │  • el feature agrega o modifica endpoints públicos
  │  • cambios en auth / Cognito / JWT
  │  • cambios en IAM roles o policies
  │  • cambios en WAF, API GW throttling, o VPC
  └─ En caso de duda: ejecutar. El costo de omitir es mayor.

FASE 10 — REVIEW (sesión propia)
  @reviewer → verifica vs spec + genera PR body

[POST-PR, si hay feedback]
  @pr-comment-resolver → clasifica y resuelve comentarios
```

### Cambio trivial (cualquier perfil)

Usa este flujo solo cuando el cambio sea de **un solo archivo, no toca contratos ni seguridad, y dura menos de 1 hora**.

```
FASE 1 — SPEC (puede ser breve, no requiere design completo)
  @openspec → intake mínimo + crea branch desde `develop` automáticamente + proposal → /handoff

FASE 2 — IMPLEMENTACIÓN (sesión propia)
  @backend-implementer o @frontend-implementer según el stream → /handoff

FASE 3 — REVIEW
  @reviewer → PR body
```

## Protocolo de sesiones y handoffs

Cada fase del flujo corre en su propia sesión de chat. Al cerrar una fase:

1. Escribe `/handoff` en Copilot Chat.
2. El agente genera `openspec/changes/{change-id}/handoff.md`.
3. Cierra el chat actual.
4. Abre un chat nuevo y escribe `/resume-phase` — el siguiente agente lee el handoff y sabe exactamente dónde continuar.

### Por qué sesiones cortas

| Sesión larga                                                      | Sesiones cortas con handoff                |
| ----------------------------------------------------------------- | ------------------------------------------ |
| Arrastra intentos fallidos, logs viejos, alternativas descartadas | Cada fase arranca limpia                   |
| La IA empieza a olvidar instrucciones o repetir razonamiento      | Contexto fresco y enfocado                 |
| 80k–200k tokens por feature                                       | 40k–80k tokens por feature                 |
| No se puede paralelizar                                           | Cada stream puede ser sesión independiente |

### Cuándo cortar la sesión

| Señal                                            | Acción                                      |
| ------------------------------------------------ | ------------------------------------------- |
| Terminaste una fase (spec, impl, tests, review)  | `/handoff` → nueva sesión → `/resume-phase` |
| Más de 2 correcciones al modelo en el mismo tema | Cerrar y reformular con prompt mejorado     |
| El modelo olvida instrucciones que ya le diste   | Sesión degradada — cerrar con `/handoff`    |
| Cambio de stream (backend → frontend)            | `/handoff` → nuevo chat con nuevo agente    |

### Cuándo NO cortar

| Situación                                | Por qué mantener la sesión              |
| ---------------------------------------- | --------------------------------------- |
| Iteración rápida dentro de la misma fase | El contexto acumulado es todo relevante |
| Debug activo con feedback loop corto     | Perder contexto del debug es peor       |
| Spec conversacional (intake → proposal)  | La conversación ES el contexto          |

### Modelo recomendado por fase

| Fase              | Modelo          | Razón                                             |
| ----------------- | --------------- | ------------------------------------------------- |
| Intake / Proposal | Sonnet / GPT-4o | Conversacional, no requiere razonamiento profundo |
| Design            | Opus / o1       | Decisiones arquitectónicas complejas              |
| Implementation    | Sonnet / GPT-4o | Alto volumen, scope claro                         |
| Testing           | Sonnet / GPT-4o | Mecánico, basado en patrones                      |
| Security review   | Opus / o1       | Requiere razonamiento adversarial                 |
| PR review         | Sonnet / GPT-4o | Sesión limpia, sin bias de implementación         |

---

## Reglas de intake

- `@openspec` pide información faltante si no tiene el mínimo necesario para arrancar.
- No inventa reglas de negocio para completar el requerimiento.
- Los artefactos generados (proposal, design, tasks) son el contexto que todos los demás agentes consumen. Sin ellos, la calidad de la implementación baja significativamente.
