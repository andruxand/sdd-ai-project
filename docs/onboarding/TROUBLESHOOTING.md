# Troubleshooting

## 1) `npm install` falla

Checklist rápido:

1. Ejecuta `nvm use` (el repo requiere Node 22).
2. Verifica `node -v` (debe ser 22.x).
3. Borra instalación previa y reintenta:

```bash
rm -rf node_modules package-lock.json
npm install
```

Si aparece error de engines, no estás en Node 22.

## 2) `npm run validate` falla

`validate` ejecuta múltiples gates. Identifica primero cuál falló:

- lint → `npm run lint`
- format check → `npm run format:check`
- markdown → `npm run md:lint`
- yaml → `npm run yaml:lint`
- spellcheck → `npm run spellcheck`
- typecheck → `npm run typecheck`
- coverage/tests → `npm run coverage`

Corrige el gate específico y vuelve a correr `npm run validate`.

## 3) OpenSpec no responde

1. Verifica CLI: `openspec --help`.
2. Si falla, reinstala: `npm install -g @fission-ai/openspec@latest`.
3. Reintenta:

```bash
npm run openspec:init
npm run openspec:profile
npm run openspec:update
```

## 4) VS Code no detecta prompts/agentes/skills

1. Command Palette → `Chat: Open Chat Customizations`.
2. Command Palette → `Chat: Diagnostics`.
3. Verifica que existan:
   - `.github/agents/*.agent.md`
   - `.github/prompts/*.prompt.md`
   - `.github/skills/*/SKILL.md`
4. Reinicia VS Code si Diagnostics no refleja cambios recientes.

## 5) No aparecen agentes al escribir `@`

1. Asegura sesión activa de Copilot en VS Code.
2. Revisa `settings.json` del workspace en `.vscode/` (chat agents habilitados).
3. Abre Diagnostics y corrige archivos con frontmatter inválido.

## 6) MCP de GitHub no funciona

1. Verifica token: `echo $GH_TOKEN` (no debe estar vacío).
2. Revisa `.vscode/mcp.json`.
3. Reinicia VS Code para recargar MCP servers.

## 7) Bootstrap no deja estructura esperada

1. Ejecuta preview:

```bash
npm run bootstrap:preview
```

2. Revisa `.generated/bootstrap-selection.json` y `.generated/active-profile.yaml`.
3. Ejecuta nuevamente `npm run bootstrap`.

Si quedó una selección inconsistente, elimina `.generated/` y vuelve a correr bootstrap.

## 8) Hook de git bloquea commit o push

### `pre-commit` falla

- corrige lint/format de archivos staged
- reintenta commit

### `commit-msg` falla

- usa formato conventional commits (`feat:`, `fix:`, `docs:`, etc.)

### `pre-push` falla

- ejecuta `npm run typecheck`
- corrige errores de tipo
- vuelve a pushear

Evita `--no-verify` salvo emergencia real.

## 9) Contratos fallan en CI

REST:

```bash
npx @redocly/cli lint packages/contracts/rest/openapi.yaml
```

GraphQL:

```bash
npx graphql-inspector validate 'packages/contracts/graphql/**/*.graphql'
```

Además confirma:

- existe `packages/contracts/rest/openapi.yaml`
- existe `packages/contracts/graphql/schema.graphql`
- módulos en `packages/contracts/graphql/modules/`

## 10) Playwright falla localmente

```bash
npx playwright install --with-deps chromium
```

Luego vuelve a correr tests e2e.

## 11) Storybook no aplica

- confirma que el módulo/storybook esté habilitado en bootstrap
- confirma que el perfil activo incluya frontend/design system

## 12) El agente se desvía o repite errores

1. Cierra fase con `/handoff`.
2. Abre chat nuevo con `/resume-phase`.
3. Refuerza scope exacto (task group aprobado, sin ampliar alcance).

Si persiste, usa agente más específico (por ejemplo `@backend-implementer` en lugar de fallback).

## 13) Dónde escalar

- Flujo y comandos: `QUICK_REFERENCE.md`
- Navegación de docs: `docs/DOC_INDEX.md`
- Gestión de sesiones: `docs/runbooks/SESSION_MANAGEMENT.md`
