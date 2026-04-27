---
agent: agent
description: 'Genera un handoff document al cerrar una fase del feature'
---

# Generar handoff

Tu tarea es generar un documento de handoff conciso que permita a otro agente (o a ti mismo en una sesión nueva) continuar el trabajo sin re-descubrir el contexto.

## Pasos

1. Identifica el change ID activo buscando en `openspec/changes/`.
2. Lee el estado actual de los artefactos en `openspec/changes/{change-id}/` (proposal, design, tasks).
3. Revisa los archivos modificados con `git diff --name-only $(git merge-base HEAD develop)`. Este comando muestra SOLO los archivos cambiados en esta branch respecto a `develop`, sin contaminar el handoff con cambios de otras branches ya mergeadas a `develop`. Si la branch es `hotfix/*`, usa `git diff --name-only $(git merge-base HEAD main)` en su lugar.
4. Genera el handoff en `openspec/changes/{change-id}/handoff.md` usando el template `openspec/templates/handoff.md`.
5. El handoff debe ser suficiente para que otro agente en una sesión nueva pueda continuar sin re-descubrir el contexto.

## Reglas

- Máximo 80 líneas de contenido.
- No incluir logs, stack traces ni alternativas descartadas.
- Sí incluir decisiones tomadas, riesgos abiertos y pendientes.
- Si hay más de un stream, indicar qué streams están completos y cuáles pendientes.
