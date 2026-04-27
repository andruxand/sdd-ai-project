# AI SDLC System Map

Este documento describe cómo encajan las piezas del sistema SDD + AI en el ciclo de desarrollo.

## Las 5 capas

| Capa                  | Qué hace                                                      | Archivos clave                                                                                    |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **OpenSpec**          | Gestiona los artefactos de cambio (proposal, design, tasks)   | `openspec/`, `openspec/config.yaml`, `openspec/templates/`                                        |
| **Agent OS**          | Capa de estándares vivos (agents, skills, prompts, standards) | `.github/agents/`, `.github/skills/`, `.github/prompts/`, `docs/standards/`, `agent-os/profiles/` |
| **VS Code + Copilot** | Ejecución diaria — donde el dev trabaja con IA                | `.github/copilot-instructions.md`, `.vscode/mcp.json`, VS Code Chat                               |
| **GitHub**            | Gobernanza y CI/CD — PRs, checks, workflows, labels           | `.github/workflows/`, `CODEOWNERS`, PR template                                                   |
| **Runtime**           | Ejecución de la aplicación (AWS, Vercel, etc.)                | `services/api/`, `apps/web/`, infraestructura                                                     |

## Flujo de un feature (de ticket a merge)

```
Ticket Jira
    ↓
@openspec (intake → proposal → design → tasks)
    ↓
/route-feature (define order + agents por stream)
    ↓
Implementers especializados (backend, frontend, contracts, observability)
    ↓
Testers especializados (backend, frontend, e2e)
    ↓
security (si aplica)
    ↓
/review-pr + reviewer
    ↓
PR → CI checks → review → merge
    ↓
Release + monitoring
```

## Cómo interactúan las capas

1. **OpenSpec** genera los artefactos que definen QUÉ construir.
2. **Agent OS** (agents + skills) define CÓMO construirlo, con qué estándares y guardrails.
3. **VS Code + Copilot** es DONDE se ejecuta — el dev usa agentes y prompts en el chat.
4. **GitHub** valida automáticamente (CI) y gestiona la gobernanza (PRs, labels, reviews).
5. **Runtime** es donde corre la aplicación final.

## Loop de mejora continua

```
Problema detectado → Actualizar Agent OS (skill/standard/agent/prompt) → Próximo feature se beneficia
```

Ver `docs/runbooks/HOW_TO_USE_AGENT_OS.md` para el proceso detallado.

## Referencia rápida

| Quiero...                               | Uso...                                               |
| --------------------------------------- | ---------------------------------------------------- |
| Comenzar un feature desde Jira          | `@openspec` o `/jira-to-change`                      |
| Generar proposal/design/tasks           | `@openspec`                                          |
| Decidir qué agentes usar y en qué orden | `/route-feature`                                     |
| Implementar backend                     | `@backend-implementer`                               |
| Implementar frontend                    | `@frontend-implementer`                              |
| Actualizar contratos                    | `@contracts-implementer`                             |
| Agregar observabilidad                  | `@observability-implementer`                         |
| Testear                                 | `@tester-backend`, `@tester-frontend`, `@e2e-tester` |
| Revisar seguridad                       | `@security`                                          |
| Pre-revisar mi PR                       | `/review-pr`                                         |
| Resolver muchos comentarios de PR       | `@pr-comment-resolver`                               |
| Validar todo localmente                 | `npm run validate`                                   |
