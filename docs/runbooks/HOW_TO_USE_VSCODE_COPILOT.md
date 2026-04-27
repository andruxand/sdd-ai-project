# How to Use VS Code + Copilot

Esta guía explica paso a paso cómo interactuar con la IA dentro de VS Code usando GitHub Copilot. No asume conocimiento previo.

## Qué es GitHub Copilot

GitHub Copilot es un asistente de IA integrado en VS Code. En este proyecto, Copilot no es un chatbot genérico — está **configurado** con agentes especializados, skills de dominio y prompts reutilizables que siguen los estándares del equipo.

Cuando abres Copilot Chat en este proyecto, la IA ya sabe:

- Las reglas de arquitectura del equipo (desde `.github/copilot-instructions.md`)
- Qué agentes están disponibles y qué hace cada uno (desde `.github/agents/`)
- Qué habilidades tiene cada agente (desde `.github/skills/`)
- Qué atajos existen para tareas comunes (desde `.github/prompts/`)

## Conceptos clave

| Concepto                   | Qué es                                                            | Dónde vive                         | Cómo se invoca                                                      |
| -------------------------- | ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| **Agent**                  | Un rol especializado con instrucciones, skills y guardrails       | `.github/agents/*.agent.md`        | `@nombre` en Copilot Chat (ej: `@openspec`, `@backend-implementer`) |
| **Skill**                  | Guía de dominio que un agente consulta internamente               | `.github/skills/*/SKILL.md`        | No se invoca directamente — los agentes los referencian             |
| **Prompt**                 | Atajo reutilizable para una tarea común                           | `.github/prompts/*.prompt.md`      | `/nombre` en Copilot Chat (ej: `/jira-to-change`, `/review-pr`)     |
| **Instrucciones globales** | Reglas que Copilot siempre sigue, sin importar el agente          | `.github/copilot-instructions.md`  | Automático — Copilot las lee siempre                                |
| **MCP Server**             | Herramienta externa que Copilot puede usar (GitHub API, AWS docs) | `.vscode/mcp.json`                 | Automático — Copilot las usa cuando necesita                        |
| **Handoff**                | Documento corto que transfiere contexto entre sesiones            | `openspec/changes/{id}/handoff.md` | `/handoff` para generar, `/resume-phase` para consumir              |

## Archivos clave

- Instrucciones globales: `.github/copilot-instructions.md`
- Flujo de agentes: `AGENTS.md`
- Prompt files: `.github/prompts/*.prompt.md`
- Custom agents: `.github/agents/*.agent.md`
- Skills: `.github/skills/*/SKILL.md`
- MCP: `.vscode/mcp.json`
- Template de handoff: `openspec/templates/handoff.md`

## Cómo abrir Copilot Chat

1. Abre VS Code con el proyecto.
2. Presiona `Ctrl+Shift+I` (Windows/Linux) o `Cmd+Shift+I` (macOS) para abrir Copilot Chat.
3. También puedes hacer clic en el ícono de chat en la barra lateral izquierda.

## Cómo invocar un agente

En Copilot Chat, escribe `@` seguido del nombre del agente. Copilot te mostrará una lista de agentes disponibles.

```text
@openspec Tengo este ticket: PROJ-123. [contexto del ticket]
@backend-implementer implementa el endpoint de orders
@tester-backend agrega tests para el servicio de orders
```

El agente lee sus skills internamente y sigue sus guardrails. No necesitas saber qué skills usa — el agente se encarga.

### Agentes disponibles (10 en total)

El punto de entrada es **siempre `@openspec`**. Nunca invoques un agente de implementación sin tener un spec aprobado en `openspec/changes/`.

| Agente                       | Cuándo usarlo                                                | Posición en el flujo                     |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| `@openspec`                  | Para generar proposal, design y tasks. **Siempre primero.**  | Fase 1 (obligatorio)                     |
| `@contracts-implementer`     | Para actualizar OpenAPI/GraphQL. Va antes que el backend.    | Fase 2 (si el feature toca endpoints)    |
| `@backend-implementer`       | Para implementar handlers, use cases, validación, logs       | Fase 3 (perfil backend o fullstack)      |
| `@frontend-implementer`      | Para implementar componentes React y Storybook               | Fase 4 (perfil frontend o fullstack)     |
| `@observability-implementer` | Para agregar logs estructurados, tracing y métricas          | Fase 5 (si tasks.md lo indica)           |
| `@tester-backend`            | Para agregar tests unitarios e integración de backend        | Fase 6 (después de backend-implementer)  |
| `@tester-frontend`           | Para agregar tests de componentes (Vitest + Testing Library) | Fase 7 (después de frontend-implementer) |
| `@e2e-tester`                | Para tests de user journeys con Playwright                   | Fase 8 (si el perfil tiene playwright)   |
| `@security`                  | Para revisión adversarial: auth, PII, IAM, OWASP             | Fase 9 (solo si risk=high en el spec)    |
| `@reviewer`                  | Para revisar todo vs el spec y generar el PR body            | Fase 10 (siempre, antes de abrir PR)     |
| `@pr-comment-resolver`       | Para clasificar y resolver comentarios de revisores          | Post-PR (solo si hay feedback)           |

Ver el flujo completo por tipo de proyecto en [AGENTS.md](../../AGENTS.md).

## Cómo invocar un prompt

En Copilot Chat, escribe `/` seguido del nombre:

```text
/jira-to-change
/review-pr
/route-feature
/handoff
/resume-phase
```

VS Code te pedirá los inputs necesarios.

### Prompts disponibles

| Prompt                 | Qué hace                                             |
| ---------------------- | ---------------------------------------------------- |
| `/jira-to-change`      | Normaliza un ticket de Jira en un change de OpenSpec |
| `/route-feature`       | Sugiere task groups, agentes y orden para un feature |
| `/proposal-to-tasks`   | Convierte proposal/design en task groups             |
| `/implement-task`      | Ejecuta una tarea aprobada                           |
| `/review-pr`           | Prepara el PR con todas las secciones                |
| `/security-review`     | Ejecuta revisión de seguridad                        |
| `/observability-check` | Verifica logs, tracing y sanitización                |
| `/handoff`             | Genera un documento de handoff al cerrar una fase    |
| `/resume-phase`        | Arranca una nueva fase desde un handoff existente    |

## Cómo referenciar archivos

En lugar de copiar y pegar contenido de archivos en el chat, referéncialos con `@`:

```text
@openspec mira @openspec/changes/PROJ-123/proposal.md y genera el design
```

Esto es más eficiente porque:

- Copilot lee el archivo directamente (no necesitas pegarlo)
- Se consume menos contexto (tokens)
- El contenido siempre está actualizado

## Verificación inicial

Cuando abres el proyecto por primera vez, verifica que VS Code detecta todo:

1. Abre Command Palette: `Ctrl+Shift+P` (Windows/Linux) o `Cmd+Shift+P` (macOS)
2. Busca `Chat: Open Chat Customizations` — verifica que aparecen los agents y prompts
3. Busca `Chat: Diagnostics` — verifica que no hay errores de parsing

Debes ver:

- instrucciones detectadas
- prompts detectados
- agentes detectados
- skills detectados
- sin errores de parsing

Si algo no aparece, revisa `docs/onboarding/TROUBLESHOOTING.md`.

## Gestión de sesiones y tokens

### Por qué importa

Cada mensaje que envías a Copilot consume **tokens** (unidades de texto que la IA procesa). Cuanto más larga es la conversación, más tokens se acumulan y:

- La IA empieza a "olvidar" instrucciones anteriores
- Repite razonamiento que ya hizo
- Arrastra errores, logs viejos y alternativas descartadas
- El costo en tokens crece exponencialmente

### La regla de oro: una fase por sesión

No hagas esto:

> Una sesión enorme: spec + implementación + errores + pruebas + PR

Ni tampoco esto:

> Abrir sesión nueva vacía y obligar al modelo a re-descubrir todo

Lo ideal:

> Cerrar fase anterior, generar handoff, nueva sesión con ese handoff

### Cómo funciona en la práctica

#### Al cerrar una fase

1. En Copilot Chat, ejecuta `/handoff`.
2. El agente genera un documento corto en `openspec/changes/{change-id}/handoff.md` con:
   - Objetivo del cambio
   - Qué se completó
   - Qué queda pendiente
   - Riesgos abiertos
   - Cómo validar
   - Decisiones tomadas
3. Cierra el chat actual.

#### Al iniciar la siguiente fase

1. Abre un chat nuevo en Copilot.
2. Ejecuta `/resume-phase`.
3. El agente lee el handoff y te presenta:
   - Resumen de la fase anterior
   - Qué está pendiente
   - Qué agente debería ejecutar
   - Plan de trabajo propuesto

### Cuándo cortar la sesión

| Señal                                            | Acción                                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| Cambio de fase (spec, impl, test, review)        | `/handoff`, cerrar chat, abrir nuevo, `/resume-phase` |
| Más de 2 correcciones al modelo en el mismo tema | Cerrar y reformular con prompt mejorado               |
| El modelo olvida instrucciones que ya le diste   | Sesión degradada — cerrar con `/handoff`              |
| Cambio de stream (backend a frontend)            | `/handoff`, nuevo chat con nuevo agente               |
| El modelo repite sugerencias ya descartadas      | Contexto contaminado — cerrar                         |

### Cuándo NO cortar

| Situación                                | Por qué mantener la sesión              |
| ---------------------------------------- | --------------------------------------- |
| Iteración rápida dentro de la misma fase | El contexto acumulado es todo relevante |
| Debug activo con feedback loop corto     | Perder el contexto del debug es peor    |
| Spec conversacional (intake a proposal)  | La conversación ES el contexto          |

### Modelo recomendado por fase

| Fase              | Modelo          | Razón                                             |
| ----------------- | --------------- | ------------------------------------------------- |
| Intake / Proposal | Sonnet / GPT-4o | Conversacional, no requiere razonamiento profundo |
| Design            | Opus / o1       | Decisiones arquitectónicas complejas              |
| Implementation    | Sonnet / GPT-4o | Alto volumen, scope claro                         |
| Testing           | Sonnet / GPT-4o | Mecánico, basado en patrones                      |
| Security review   | Opus / o1       | Requiere razonamiento adversarial                 |
| PR review         | Sonnet / GPT-4o | Sesión limpia, sin bias de implementación         |

## Contexto de Jira

El enlace de Jira solo rara vez basta. Pasa además:

- Texto completo del ticket
- Criterios de aceptación
- Links relacionados
- Entregables previos
- Imágenes o adjuntos relevantes

## Routing asistido

Cuando el feature no sea trivial, usa `/route-feature` para que el sistema proponga task groups, agentes y orden sugerido.

## Intake mínimo y contexto adicional

Cuando arranques con `@openspec` o `/jira-to-change`, no necesitas repetir todo el contexto en cada comando OpenSpec posterior.

### Regla práctica

1. Entrega el contexto fuerte al inicio.
2. Luego continúa en la misma conversación con OpenSpec.
3. No repitas todo en cada comando, salvo que:
   - cambies de chat (en ese caso usa `/resume-phase`)
   - el contexto se pierda
   - el agente se desvíe
   - quieras reforzar una parte crítica

### Mínimo necesario para empezar

- problema de negocio o problema de usuario
- descripción del cambio solicitado
- al menos un criterio de aceptación o condición de éxito
- un identificador para trazabilidad (Jira key, issue ID o equivalente)

### Muy útil pero no siempre obligatorio

- URL de Jira
- links relacionados
- entregable previo
- imágenes, mockups o adjuntos
- dependencias y restricciones

### Comportamiento esperado del flujo

Si falta información mínima, el agente debe pedirla antes de avanzar demasiado.
Si faltan datos útiles pero no críticos, puede continuar dejando preguntas abiertas y supuestos explícitos.

## Ejemplo completo de un feature

Este ejemplo muestra el flujo completo desde Jira hasta PR, usando sesiones cortas con handoff.

### Sesión 1: Spec (5-10 min)

En Copilot Chat:

```text
@openspec Tengo este ticket: PROJ-123.
Necesito agregar un endpoint GET /orders/{id} que devuelva el estado de una orden.
AC: 200 con la orden, 404 si no existe, 401 si no está autenticado.
```

El agente genera proposal, design y tasks.

Al terminar la spec:

```text
/handoff
```

Cierra el chat.

### Sesión 2: Implementación backend (10-20 min)

En un chat nuevo:

```text
/resume-phase
```

El agente lee el handoff y propone el plan.

```text
@backend-implementer implementa el task group de backend
```

El agente implementa handlers, use cases, validación, logs.

```text
/handoff
```

Cierra el chat.

### Sesión 3: Tests (10-15 min)

```text
/resume-phase
@tester-backend agrega tests para el servicio de orders
```

El agente agrega unit tests, integration tests, edge cases.

```text
/handoff
```

### Sesión 4: Review + PR (5 min)

```text
/resume-phase
/review-pr
```

Sesión limpia, sin bias de implementación. El reviewer evalúa el diff fresco.

## Uso con Claude Code

Si usas Claude Code en lugar de (o además de) Copilot, el proyecto incluye un archivo `CLAUDE.md` en la raíz que Claude Code lee automáticamente. Contiene:

- Comandos de build y test
- Reglas de gestión de sesiones
- Referencia a las instrucciones globales y AGENTS.md

Las mismas reglas de sesiones cortas y handoffs aplican:

- Usa `/compact` en Claude Code cuando el contexto crezca
- Usa `/clear` entre tareas no relacionadas
- Nombra sesiones con `/rename` usando el patrón `{change-id}-{phase}`
- Retoma sesiones con `claude --resume`
