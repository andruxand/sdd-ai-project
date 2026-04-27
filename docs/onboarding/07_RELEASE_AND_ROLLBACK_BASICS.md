# 07. Release and Rollback Basics

## Cómo se hace un release

Este template usa **dos tracks de release independientes** que coexisten:

| Track                 | Propósito                                        | Cómo funciona                                                                                                                           |
| --------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Changesets**        | Versionado de paquetes npm en el monorepo        | Cada PR incluye un changeset. Al merge a `main`, `release.yml` abre un PR de versión o publica en npm registry (si `NPM_TOKEN` existe). |
| **Tags semánticos**   | Marca de release + trigger del deploy AWS a prod | `git tag -a v1.2.3` en `main` después del cert → main merge. Dispara `deploy.yml` (lo crea el equipo — ver §4 de git-branching.md).     |
| **Serverless deploy** | Deploy manual o automatizado por stage           | `npm run deploy:dev` / `npm run deploy:prod` desde `services/api`. CI puede automatizarlo al merge a cada rama de entorno.              |

### Track 1 — Changesets (versionado npm)

```bash
# Agrega un changeset en tu rama de feature
npx changeset

# Sigue el wizard: tipo (patch/minor/major), paquetes afectados, descripción
# Esto crea un archivo en .changeset/ que se commitea con tu PR
```

Después del merge a `main`, el workflow `release.yml` detecta los changesets
acumulados y crea/actualiza el "Version Packages" PR automáticamente.

### Track 2 — Tags + deploy AWS a producción

```bash
# Después de que cert → main esté mergeado:
git checkout main && git pull origin main
git tag -a v1.2.3 -m "release: v1.2.3 — order notifications"
git push origin v1.2.3
# → dispara deploy.yml (proyecto-específico) hacia el environment production
```

Si el workflow de deploy AWS aún no existe en tu repo, el deploy se ejecuta
manualmente:

```bash
cd services/api && npm run deploy:prod
```

### Track 3 — Deploy por stage (backend Serverless)

```bash
cd services/api

npm run deploy:dev   # → stage dev
npm run deploy:prod  # → stage prod (solo tech lead / release manager)
npm run logs:dev     # tail de CloudWatch Logs en dev
```

## Antes del merge

Todo feature debe tener definido:

| Item                 | Qué documentar                                               |
| -------------------- | ------------------------------------------------------------ |
| Rollback plan        | Cómo revertir el cambio si algo sale mal                     |
| Owner                | Quién es responsable del release                             |
| Señales de rollback  | Qué métricas/errores/alertas indicarían que hay que revertir |
| Impacto en datos     | ¿El cambio es aditivo o modifica datos existentes?           |
| Impacto en contratos | ¿Hay breaking changes? ¿Los consumidores están notificados?  |

Esto se documenta en el PR template y en el design de OpenSpec.

## Si el release sale mal

### Rollback inmediato

1. **Código**: revert del merge commit → nuevo PR → merge rápido
   ```bash
   git revert <merge-commit-sha>
   git push origin main
   ```
2. **Serverless**: deploy de la versión anterior
   ```bash
   cd services/api && npm run deploy:prod   # con el código revertido
   ```
3. **Infraestructura**: si el cambio fue de IaC, revert y re-deploy

### Post-mortem

1. Documenta la causa raíz
2. Abre un follow-up issue si aplica
3. Convierte el aprendizaje en:
   - estándar (`docs/standards/`)
   - skill (`.github/skills/`)
   - guardrail en agent
   - template OpenSpec
     según corresponda (ver `docs/runbooks/HOW_TO_USE_AGENT_OS.md`, sección "loop Refine")

## Qué monitorear después de un release

- Logs de aplicación (CloudWatch, Datadog, etc.)
- Métricas de latencia y error rate
- Trazas distribuidas
- Errores en Sentry / error tracker
- Impacto funcional: ¿el feature hace lo que debería?
- Contratos: ¿los consumidores siguen funcionando?

## Referencia

- `docs/governance/ROLLBACK_POLICY.md` — política formal de rollback
- `docs/governance/RISK_MATRIX.md` — matriz de riesgo
