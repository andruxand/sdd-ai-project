# First Feature Runbook

> **Relación con onboarding**: este runbook es la versión compacta de referencia rápida.
> Si es tu primera vez, sigue la guía canónica completa en `docs/onboarding/05_AI_SDLC_ONE_DOC_PLAYBOOK.md`.
> Este runbook es para devs que ya conocen el flujo y necesitan un checklist rápido.

1. En VS Code Chat, usa el agente `@openspec` con el contexto del ticket. El agente **crea la rama automáticamente** a partir de la Jira key:

```text
@openspec Tengo este ticket: PROJ-123. [pega contexto]
```

El agente te guiará por intake → proposal → design → tasks.

También puedes pedir pasos específicos:

```text
@openspec genera el proposal
@openspec genera el design
@openspec divide en tasks
@openspec valida todo
```

O usar prompts individuales si prefieres control manual:

- `/jira-to-change` — normalizar ticket
- `/proposal-to-tasks` — dividir en task groups
- `/route-feature` — sugerir orden de agentes

3. Si el cambio es mediano, fullstack o high-risk, enruta el feature:

```text
/route-feature
```

4. Ejecutar el trabajo por stream, no todo con un solo agente:

- backend -> `backend-implementer`
- frontend -> `frontend-implementer`
- contratos -> `contracts-implementer`
- observabilidad -> `observability-implementer`
- backend tests -> `tester-backend`
- frontend tests -> `tester-frontend`
- e2e -> `e2e-tester`

5. Usa `security` cuando el cambio toque auth, permisos, PII, logs sensibles, contratos públicos, WAF/IAM/API Gateway/JWT/API keys, pagos o compliance.

6. Ejecutar:

```bash
npm run validate
npm run openspec:validate
```

7. Preparar PR:

```text
/review-pr
```

8. Resolver comentarios Qodo/Copilot con `pr-comment-resolver` cuando el feedback sea abundante, cruzado o repetitivo.

9. Antes de merge confirmar:

- checks verdes
- reviewers correctos
- risk label correcto
- rollback definido

## Routing refinado

Para cambios medianos o grandes, usa el prompt `/route-feature` después de que `@openspec` genere el `tasks.md`.
El flujo base es secuencial y explícito; no asumas que Copilot ejecutó todos los agentes.

## Qué pasa si el requerimiento viene incompleto

Si al iniciar con `@openspec` o `/jira-to-change` no entregas toda la información, el flujo ideal no debería inventar.

### Comportamiento esperado

- si falta información mínima, debe pedirla
- si falta información útil pero no crítica, puede seguir con preguntas abiertas y supuestos explícitos

### Información mínima para arrancar razonablemente

- problema de negocio o de usuario
- cambio solicitado
- al menos un criterio de aceptación
- un identificador de trazabilidad

### Información adicional recomendable

- URL de Jira
- links relacionados
- entregable previo
- mockups o adjuntos
- dependencias o restricciones
