# 02. Validate Installation

## Paso 1. Verificar versión de Node

```bash
nvm use   # lee .nvmrc y activa Node 22
node -v   # debe responder v22.x
```

Si ves un error, ejecuta `nvm install 22` primero.

## Paso 2. Instalar dependencias del repo

En la raíz:

```bash
npm install
```

> Si ves un error de "engine", asegúrate de estar usando Node 22 (`nvm use`). El repo tiene `engine-strict=true` en `.npmrc`.

## Paso 3. Confirmar estructura base

Debes ver al menos:

- `.github/` — agentes, skills, prompts, instrucciones, workflows
- `.vscode/` — settings, tasks, launch configs, MCP servers
- `docs/` — onboarding, runbooks, estándares
- `openspec/` — config, templates, specs
- `scripts/` — bootstrap, yaml-lint
- `.husky/` — git hooks (pre-commit, commit-msg, pre-push, prepare-commit-msg)
- `turbo.json` — configuración de Turborepo
- `.nvmrc` — versión de Node pinneada
- `.editorconfig` — formato consistente en cualquier editor
- `.copilotignore` — archivos excluidos de sugerencias de Copilot

Y, según el perfil:

- `apps/web`
- `services/api`
- `packages/shared/ui`
- `packages/contracts`

## Paso 4. Validar VS Code customizations

En VS Code:

1. abre el repositorio
2. abre Copilot Chat
3. usa:
   - `Chat: Open Chat Customizations`
   - `Chat: Diagnostics`

Debes ver que el repo tiene:

- **instrucciones**: copilot-instructions.md + archivos en `.github/instructions/` (backend, frontend, testing, contracts, config)
- **prompts**: handoff, resume-phase, implement-task, review-pr, etc.
- **agentes**: openspec, backend-implementer, frontend-implementer, etc.
- **skills**: 59 skills por dominio (47 siempre activos + 12 condicionales)
- **MCP servers**: github, aws-docs

## Paso 5. Verificar git hooks

Los hooks se instalan automáticamente con `npm install` (husky). Verifica:

```bash
ls .husky/
```

Debes ver:

- `pre-commit` — corre lint-staged (ESLint + Prettier en archivos que cambies)
- `commit-msg` — valida que el mensaje siga conventional commits
- `prepare-commit-msg` — agrega el Jira key de la branch al commit automáticamente
- `pre-push` — corre typecheck antes de pushear

### Qué hacen los hooks en tu flujo diario

| Hook                 | Cuándo corre          | Qué hace                                                                        | Si falla                                                              |
| -------------------- | --------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `pre-commit`         | Al hacer `git commit` | Formatea y lintea SOLO los archivos staged                                      | Corrige automáticamente lo que puede. Si no puede, muestra el error.  |
| `commit-msg`         | Al hacer `git commit` | Valida formato del mensaje (ej: `feat:`, `fix:`, `docs:`)                       | Rechaza el commit. Revisa `CONTRIBUTING.md` para el formato correcto. |
| `prepare-commit-msg` | Al hacer `git commit` | Si tu branch se llama `PROJ-123-algo`, agrega `PROJ-123:` al inicio del mensaje | Silencioso. Si la branch no tiene patrón Jira, no hace nada.          |
| `pre-push`           | Al hacer `git push`   | Corre `npm run typecheck` en todos los workspaces                               | Rechaza el push. Corrige los errores de tipos antes de pushear.       |

### Si quieres saltarte un hook temporalmente

```bash
git commit --no-verify -m "wip: work in progress"
git push --no-verify
```

Usa `--no-verify` solo en emergencias. Los hooks están para evitar que llegue código roto a CI.

## Paso 6. Verificar VS Code tasks

Abre la paleta de comandos (`Cmd+Shift+P`) → "Tasks: Run Task". Debes ver:

- Validate All
- Lint
- Typecheck
- Test
- Coverage
- OpenSpec Validate
- Storybook Dev

## Paso 7. Validar scripts del repo

Ejecuta:

```bash
npm run validate
```

Todo debe pasar en verde. Si falla, ve a `docs/onboarding/TROUBLESHOOTING.md`.

## Paso 8. Nota sobre OpenSpec

OpenSpec se configura DESPUÉS del bootstrap (paso 04), no antes.
No ejecutes `openspec:init` ni `openspec:profile` aquí.
Eso se hace en el paso 04 una vez que el bootstrap haya materializado la estructura.

## Paso 9. Qué hacer si falla algo

Ve a `docs/onboarding/TROUBLESHOOTING.md`
