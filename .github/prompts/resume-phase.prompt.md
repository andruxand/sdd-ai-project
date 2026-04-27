---
agent: agent
description: 'Arranca una nueva fase a partir de un handoff existente'
---

# Retomar fase desde handoff

Tu tarea es arrancar una nueva sesión de trabajo a partir de un handoff existente, sin re-descubrir el contexto completo del feature.

## Pasos

1. Identifica el change ID. Si no lo conoces, lista los directorios en `openspec/changes/` y pregunta al desarrollador cuál.
2. Lee `openspec/changes/{change-id}/handoff.md`.
3. Lee `openspec/changes/{change-id}/tasks.md` para conocer las tareas pendientes.
4. Resume al desarrollador:
   - Qué se completó en la fase anterior.
   - Qué está pendiente.
   - Qué riesgos siguen abiertos.
   - Qué agente debería ejecutar la siguiente fase.
5. Propón el plan de trabajo basado en pendientes y riesgos del handoff.

## Reglas

- No re-leas archivos que el handoff ya resume, salvo que necesites detalle específico.
- Confirma con el desarrollador antes de empezar a ejecutar.
- Si el handoff está incompleto o desactualizado, pide al desarrollador que lo aclare.
