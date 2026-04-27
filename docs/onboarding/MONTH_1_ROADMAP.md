# Month 1 Roadmap

Objetivo: que un developer nuevo pase de “instalé el repo” a “entrego features con calidad usando IA” en 4 semanas.

## Semana 1 — Setup + primer feature guiado

### Meta

- Entorno validado.
- Primer feature completado con apoyo fuerte de runbooks.

### Qué hacer

1. Completa `docs/onboarding/05_AI_SDLC_ONE_DOC_PLAYBOOK.md`.
2. Ejecuta `npm run validate` en verde.
3. Implementa 1 feature pequeño usando:
   - `@openspec` → proposal/design/tasks
   - implementer especializado según stream
   - tester especializado
4. Cierra cada fase con `/handoff`.

### Señales de éxito

- Puedes crear PR con template completo.
- No haces push con typecheck roto.
- Sabes retomar trabajo con `/resume-phase`.

## Semana 2 — Autonomía operativa

### Meta

- Reducir fricción en decisiones de flujo/agente.

### Qué hacer

1. Usa `docs/DECISION_TREES.md` para 2 features reales.
2. Ejecuta al menos 1 flujo multi-stream (backend + contratos, o frontend + tests).
3. Practica resolución de errores con `docs/onboarding/TROUBLESHOOTING.md`.

### Señales de éxito

- Eliges agente correcto sin bloquearte.
- Puedes explicar por qué usaste ese routing.
- Documentas riesgos y rollback en PR.

## Semana 3 — Calidad y seguridad

### Meta

- Entregar cambios con verificación robusta.

### Qué hacer

1. Corre validaciones específicas por dominio cuando aplique:
   - REST: `npx @redocly/cli lint packages/contracts/rest/openapi.yaml`
   - GraphQL: `npx graphql-inspector validate 'packages/contracts/graphql/**/*.graphql'`
2. Revisa checklist: `docs/runbooks/SECURITY_AND_QUALITY_CHECKLIST.md`.
3. Añade evidencia de pruebas en PR.

### Señales de éxito

- PRs con secciones de seguridad y rollout completas.
- Cobertura igual o mejor en áreas tocadas.

## Semana 4 — Escalado y mejora continua

### Meta

- Trabajar con ritmo sostenible y transferible al equipo.

### Qué hacer

1. Completa 1 feature end-to-end con sesiones cortas por fase.
2. Identifica 2 mejoras de docs/agentes/skills basadas en fricción real.
3. Deja feedback accionable en runbooks o standards.

### Señales de éxito

- Tiempo por feature baja respecto a semana 1.
- Menos retrabajo por mala definición de scope.
- Puedes acompañar a otro dev en su primer feature.

## Métricas sugeridas (ligeras)

- Tiempo total por feature (spec + impl + test + review).
- Número de handoffs por feature.
- Cantidad de bloqueos por setup/herramientas.
- Cantidad de iteraciones de review antes de merge.

## Regla de oro

Si cambias de fase, cambia de sesión:

- cerrar fase: `/handoff`
- abrir fase nueva: `/resume-phase`

Eso reduce ruido de contexto y mejora consistencia de resultados.
