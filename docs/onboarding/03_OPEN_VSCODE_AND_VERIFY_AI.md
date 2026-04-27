# 03. Open VS Code and Verify AI Setup

## Paso 1

Abre la carpeta del proyecto en VS Code.

## Paso 2

Abre el panel de GitHub Copilot Chat.

## Paso 3

Confirma que existen estos archivos:

- `.github/copilot-instructions.md`
- `AGENTS.md`
- `.github/prompts/`
- `.github/agents/`
- `.github/skills/`

## Paso 4

En el Command Palette ejecuta:

- `Chat: Open Chat Customizations`
- `Chat: Diagnostics`

## Paso 5

Qué debes confirmar

- que VS Code detecta prompts
- que detecta agentes
- que detecta skills
- que no hay errores de parsing

## Paso 6

Prueba básica
En Copilot Chat ejecuta:

```text
/jira-to-change
```

Si VS Code reconoce el prompt, la instalación de customizations está bien.

## Paso 7

Si el prompt no aparece
Revisa:

- nombre del archivo `.prompt.md`
- YAML frontmatter
- `settings.json`
- Diagnostics

## Paso 8

MCP Servers (Model Context Protocol)

El proyecto incluye servidores MCP configurados en `.vscode/mcp.json`. Estos le dan a Copilot acceso a herramientas externas.

Servidores incluidos:

- **GitHub MCP** — permite a Copilot interactuar con repos, PRs, issues de GitHub
- **AWS Docs MCP** — permite a Copilot consultar documentación oficial de AWS

### Qué hacer

1. Abre `.vscode/mcp.json` y confirma que los servers están configurados.
2. El de GitHub (`@github/github-mcp-server`) se ejecuta con `npx` — no necesita instalación extra.
3. El de AWS docs (`awslabs.aws-documentation-mcp-server`) se ejecuta con `uvx` — necesitas tener `uv` y `uvx` instalados (ver paso 01, sección 8).

### Cómo verificar

En Copilot Chat, abre el panel de MCP tools. Deberías ver herramientas de GitHub y AWS si los servers se están ejecutando.

> **Nota**: si no vas a usar AWS, puedes eliminar el server `aws-docs` de `.vscode/mcp.json`. No afecta nada.
