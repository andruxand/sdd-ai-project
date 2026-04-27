# 00. Prerequisites

Este documento está pensado para alguien que entra por primera vez a este flujo.

## Qué necesitas antes de empezar

Instala y deja funcionando esto:

1. **Git**
2. **Node.js 22.x** — usa la versión exacta del archivo `.nvmrc` del repo
3. **npm**
4. **nvm** (o fnm) — para cambiar versiones de Node fácilmente
5. **VS Code**
6. **GitHub Copilot** en VS Code
7. **OpenSpec** — no requiere instalación. Es agent-driven: usa `@openspec` en Copilot Chat. Los scripts `npm run openspec:*` están incluidos en el repo.
8. **AWS CLI** si el proyecto usará AWS
9. **Serverless Framework v4** si el proyecto usará backend serverless
10. **Python/uv/uvx** solo si vas a usar MCP de AWS docs — instala `uv` con `brew install uv`, `uvx` viene incluido con `uv` (no requiere instalación separada).
11. Acceso a:
    - repositorio GitHub
    - Jira
    - cuenta AWS (si aplica)
    - GitHub Copilot (licencia activa)
12. **Variable de entorno `GH_TOKEN`** — el MCP de GitHub necesita un Personal Access Token. No se guarda en el repo, se configura en tu sistema operativo.

## Cómo confirmar acceso

Debes poder:

- clonar el repo
- abrir VS Code
- ver Copilot habilitado
- ejecutar `node -v` (debe responder 22.x)
- ejecutar `npm -v`
- ejecutar `git --version`
- ejecutar `echo $GH_TOKEN` (debe mostrar tu token, no vacío)

## Si algo de esto falta

No sigas con bootstrap ni con el primer feature. Primero completa accesos e instalación.
