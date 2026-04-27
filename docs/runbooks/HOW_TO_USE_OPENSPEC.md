# How to Use OpenSpec

## Opción A: Agente `@openspec` (recomendado)

El agente `@openspec` maneja todo el flujo SDD desde Copilot Chat:

```text
@openspec Tengo este ticket: PROJ-123. [contexto del ticket]
@openspec genera el proposal
@openspec genera el design
@openspec divide en tasks
@openspec ¿qué falta?
@openspec valida todo
```

No necesitas correr comandos CLI ni conocer la estructura de archivos.
El agente lee templates, crea los artefactos en `openspec/changes/<change-id>/`, y valida consistencia.

## Opción B: Prompts individuales

Si prefieres control manual, usa los prompts:

- `/jira-to-change` — normalizar un ticket de Jira
- `/proposal-to-tasks` — convertir proposal/design en task groups
- `/route-feature` — sugerir orden de agentes por task group
- `/implement-task` — implementar un task group aprobado
- `/review-pr` — revisar branch contra standards

## Opción C: CLI

```bash
openspec validate
openspec status
openspec templates
openspec schemas
```

## División correcta de tasks

Divide por streams verificables: backend, frontend, contratos, observabilidad, backend tests, frontend tests, e2e, docs/storybook y rollback.

Después de crear proposal/design/tasks, usa `/route-feature` si necesitas convertir esos artefactos en una secuencia práctica de agentes y task groups.

## Contexto antes de correr comandos OpenSpec

Los comandos OpenSpec no requieren que repitas todo el requerimiento en cada paso si sigues en la misma conversación.

Flujo correcto:

1. pasa el contexto fuerte al inicio con `planner` o `/jira-to-change`
2. crea el change OpenSpec
3. continúa proposal/design/tasks usando el contexto ya capturado y los artefactos creados

Solo refuerza contexto si:

- cambió el chat
- el agente perdió el hilo
- hay una parte del requerimiento que sigue ambigua

En ese caso, basta con una aclaración breve como:

- usa el Jira actual y el proposal ya creado
- continúa usando el design actual
