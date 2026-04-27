# How to Use Agent OS

## Qué es Agent OS

Agent OS es la **capa de estándares vivos** del proyecto. No es un software que ejecutas — es un sistema de archivos (agentes, skills, prompts, estándares, perfiles) que configura cómo trabaja la IA contigo.

Piénsalo así:

- Los **agentes** son roles especializados (backend-implementer, tester, security, etc.)
- Los **skills** son guías de dominio que los agentes consultan (cómo crear un endpoint, cómo testear)
- Los **prompts** son atajos reutilizables para tareas comunes (`/jira-to-change`, `/review-pr`)
- Los **estándares** son las reglas técnicas del equipo
- El **perfil** es la configuración activa que dice qué agentes/skills/estándares aplican a tu proyecto

## Archivos clave

| Archivo                           | Qué hace                                                         |
| --------------------------------- | ---------------------------------------------------------------- |
| `.github/agents/*.agent.md`       | Define cada agente especializado con su rol, skills y guardrails |
| `.github/skills/*/SKILL.md`       | Guía de dominio que un agente consulta para hacer su trabajo     |
| `.github/prompts/*.prompt.md`     | Prompt reutilizable que puedes invocar con `/nombre`             |
| `.github/copilot-instructions.md` | Instrucciones globales que Copilot siempre sigue                 |
| `docs/standards/*.md`             | Estándares técnicos del equipo                                   |
| `agent-os/profiles/*.yaml`        | Perfiles Agent OS predefinidos por tipo de proyecto              |
| `.generated/active-profile.yaml`  | Perfil activo generado por el bootstrap                          |

## Perfiles

Un perfil Agent OS define:

- **scope**: backend-only, frontend-only, fullstack
- **topology**: monorepo, split-repos
- **contracts**: rest, graphql, both, none
- **modules**: qué módulos están activos (storybook, playwright, aws-pack, etc.)
- **agents**: lista de agentes habilitados para ese perfil
- **skills**: lista de skills disponibles

El bootstrap genera `.generated/active-profile.yaml` con el perfil que corresponde a tus respuestas.

## El loop: Discover → Inject → Build → Refine

Agent OS funciona en un ciclo continuo:

### 1. Discover

Identifica qué necesita mejorar:

- un comentario de PR que se repite
- un error que el agente comete seguido
- un patrón que el equipo quiere estandarizar

### 2. Inject

Actualiza el artefacto correcto:

- si es una regla técnica → actualiza `docs/standards/`
- si es un patrón de implementación → actualiza un skill
- si es una instrucción para el agente → actualiza el agent
- si es un atajo recurrente → crea un prompt
- si es un template de OpenSpec → actualiza `openspec/templates/`

### 3. Build

El próximo feature que toque ese dominio ya se beneficia del cambio. No hay que "desplegar" nada — Copilot lee los archivos actualizados automáticamente.

### 4. Refine

Después de 2-3 features, revisa si el estándar/skill/prompt sigue siendo útil y correcto. Ajusta o elimina lo que no aporte.

## Cuándo actualizar Agent OS

| Señal                                         | Acción                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| Un reviewer deja el mismo comentario 2+ veces | Agrégalo al skill o standard correspondiente         |
| Un agente inventa algo que no debería         | Agrega guardrail al agent                            |
| Un patrón de implementación se repite         | Crea un skill nuevo o actualiza uno existente        |
| Un step se repite en cada feature             | Crea un prompt                                       |
| El equipo adopta una nueva herramienta        | Actualiza prerequisites, install, y skills/standards |

## Ejemplo práctico

**Problema**: El `backend-implementer` siempre olvida agregar tracing a los endpoints.

**Solución**:

1. Abre `.github/skills/serverless-endpoint/SKILL.md`
2. Agrega una sección "Tracing obligatorio" con el patrón esperado
3. Próxima vez que uses `backend-implementer`, ya incluirá tracing

Eso es Agent OS: **estándares vivos que mejoran con cada iteración.**

## Handoffs y gestión de sesiones

Agent OS incluye un sistema de **handoffs** para transferir contexto entre fases de trabajo sin arrastrar basura de sesiones largas.

### El problema que resuelve

Cuando trabajas con IA en una sesión muy larga:

- La IA arrastra intentos fallidos, logs viejos y alternativas descartadas
- El modelo empieza a olvidar instrucciones o repetir razonamiento
- El costo en tokens crece de 80k-200k por feature

Con sesiones cortas + handoff:

- Cada fase arranca con contexto limpio y enfocado
- El costo baja a 40k-80k por feature
- Cada stream puede correr como sesión independiente

### Archivos involucrados

| Archivo                                  | Qué hace                                   |
| ---------------------------------------- | ------------------------------------------ |
| `openspec/templates/handoff.md`          | Template para generar handoffs             |
| `openspec/changes/{id}/handoff.md`       | Handoff generado para un change específico |
| `.github/prompts/handoff.prompt.md`      | Prompt para generar handoff al cerrar fase |
| `.github/prompts/resume-phase.prompt.md` | Prompt para arrancar fase desde handoff    |

### Cómo funciona

1. Al cerrar una fase, ejecuta `/handoff` en Copilot Chat.
2. El agente genera un handoff corto (< 80 líneas) con: objetivo, estado, pendientes, riesgos, decisiones.
3. Para la siguiente fase, abre un chat nuevo y ejecuta `/resume-phase`.
4. El agente lee el handoff y propone el plan de trabajo.

Para más detalle, ver `docs/runbooks/HOW_TO_USE_VSCODE_COPILOT.md` sección "Gestión de sesiones y tokens".

## Soporte para Claude Code

Si tu equipo usa Claude Code además de Copilot, el archivo `CLAUDE.md` en la raíz del proyecto contiene:

- Referencia a `copilot-instructions.md` y `AGENTS.md`
- Comandos de build y test
- Reglas de gestión de sesiones para Claude Code

Claude Code lee `CLAUDE.md` automáticamente al iniciar cada sesión.
