```markdown
# Glosario

Términos que necesitas entender para trabajar con este template.

## Conceptos del template

| Término       | Qué significa                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SDD**       | Spec-Driven Development. Metodología donde primero se define la especificación (proposal, design, contracts) y luego se implementa. Evita desarrollar sin claridad.  |
| **OpenSpec**  | Herramienta y flujo para gestionar artefactos de cambio: proposal, design, tasks. Cada cambio tiene un `change-id` y sus artefactos viven en `openspec/changes/`.    |
| **Agent OS**  | Capa de estándares vivos del proyecto. No es un software — es el conjunto de agents, skills, prompts, standards y profiles que configura cómo trabaja la IA contigo. |
| **Bootstrap** | Script interactivo (`npm run bootstrap`) que adapta el template al tipo de proyecto elegido: elimina lo que no aplica, activa lo que sí.                             |
| **Profile**   | Configuración que define scope, topology, contracts, modules y qué agents/skills están activos. Se genera en `.generated/active-profile.yaml`.                       |

## Piezas de VS Code + Copilot

| Término                  | Qué es                                                                                                                                     | Cómo se usa                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **Agent**                | Rol especializado con instrucciones, skills y guardrails. Vive en `.github/agents/*.agent.md`.                                             | Se invoca con `@nombre` en Copilot Chat (ej: `@openspec`).           |
| **Skill**                | Guía de dominio que un agente consulta para hacer su trabajo. Vive en `.github/skills/*/SKILL.md`.                                         | No se invoca directamente — los agentes lo referencian internamente. |
| **Prompt**               | Atajo reutilizable para una tarea común. Vive en `.github/prompts/*.prompt.md`.                                                            | Se invoca con `/nombre` en Copilot Chat (ej: `/jira-to-change`).     |
| **MCP**                  | Model Context Protocol. Estándar para que Copilot se conecte a herramientas externas (GitHub API, AWS docs). Config en `.vscode/mcp.json`. | Automático — Copilot lo usa cuando necesita.                         |
| **Copilot instructions** | Reglas globales que Copilot siempre sigue, sin importar qué agente uses. Vive en `.github/copilot-instructions.md`.                        | Automático.                                                          |

## Contratos

| Término               | Qué significa                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Spec-first**        | Primero se escribe el contrato (OpenAPI o GraphQL schema), luego se implementa.                            |
| **OpenAPI**           | Estándar para describir APIs REST. El spec vive en `packages/contracts/rest/openapi.yaml`.                 |
| **$ref**              | Mecanismo de OpenAPI para referenciar definiciones en otros archivos (modularidad).                        |
| **extend type**       | Patrón de GraphQL para agregar campos a un tipo base desde otro archivo (modularidad).                     |
| **Redocly**           | CLI para lint y bundle de specs OpenAPI. Config en `packages/contracts/redocly.yaml`.                      |
| **oasdiff**           | CLI para detectar breaking changes entre dos versiones de un spec OpenAPI.                                 |
| **graphql-inspector** | CLI para validar schemas GraphQL y detectar breaking changes.                                              |
| **Breaking change**   | Cambio en un contrato que rompe a los consumidores existentes (ej: eliminar un campo). Requiere migración. |
| **Additive change**   | Cambio en un contrato que no rompe a nadie (ej: agregar un campo opcional). Seguro.                        |

## CI/CD y gobernanza

| Término                          | Qué significa                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Workflow**                     | GitHub Action que corre automáticamente en CI (lint, test, security, contracts). Viven en `.github/workflows/`. |
| **Risk gate**                    | Workflow que asigna un label de riesgo (`risk:low/medium/high`) al PR según qué archivos cambiaron.             |
| **CODEOWNERS**                   | Archivo que define quién debe aprobar cambios en qué paths del repo.                                            |
| **Guard (file-existence guard)** | Patrón en workflows que verifica si un archivo existe antes de correr — evita fallos si el spec no existe aún.  |

## Herramientas

| Término                  | Qué es                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| **Vitest**               | Framework de testing para TypeScript/JavaScript.                         |
| **Playwright**           | Framework para tests end-to-end en el navegador.                         |
| **Storybook**            | Herramienta para desarrollar y documentar componentes UI en aislamiento. |
| **Serverless Framework** | Framework para desplegar funciones Lambda y otros servicios AWS.         |
| **Husky + lint-staged**  | Hooks de Git que corren validaciones automáticas antes de commit/push.   |
| **Commitlint**           | Valida que los mensajes de commit sigan Conventional Commits.            |
| **Changesets**           | Sistema para gestionar versioning y changelogs en monorepos.             |
```
