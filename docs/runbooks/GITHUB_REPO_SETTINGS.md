# GitHub Repository Settings — Guía de configuración completa

Esta guía cubre toda la configuración externa del repositorio en GitHub. Se hace una sola vez por repo, después de crearlo.

Para el flujo completo de onboarding (instalar herramientas, bootstrap, SDLC), ver `docs/onboarding/05_AI_SDLC_ONE_DOC_PLAYBOOK.md`.

---

## Índice

1. [Labels de riesgo](#1-labels-de-riesgo)
2. [Labels de área](#2-labels-de-área)
3. [Branch protection rule para main](#3-branch-protection-rule-para-main)
4. [Branch protection rules para develop / qa / cert](#4-branch-protection-rules-para-develop--qa--cert)
5. [Secrets del repositorio](#5-secrets-del-repositorio)
6. [Environments: dev, qa, cert, production](#6-environments-dev-qa-cert-production)
7. [CODEOWNERS](#7-codeowners)
8. [Dependabot](#8-dependabot)
9. [GitHub Apps: Qodo](#9-github-apps-qodo)
10. [Status checks requeridos — cuándo aparecen](#10-status-checks-requeridos--cuándo-aparecen)
11. [Verificación final](#11-verificación-final)

---

## 1. Labels de riesgo

El workflow `risk-gate.yml` aplica automáticamente uno de estos labels a cada PR según qué archivos toca. Los labels deben existir en el repo antes de que corra el workflow.

**Con GitHub CLI (recomendado — un comando, sin clicks):**

```bash
gh label create "risk:low"    --color "0E8A16" --description "Safe change: docs, config, low-impact"
gh label create "risk:medium" --color "FBCA04" --description "Service or package change"
gh label create "risk:high"   --color "D93F0B" --description "Auth, infra, migrations, contracts"
```

**Con GitHub UI (si prefieres):**

1. Ve a tu repositorio en GitHub.
2. Haz clic en la pestaña **Issues**.
3. Haz clic en el botón **Labels** (está a la derecha, junto a la barra de búsqueda de issues).
4. Haz clic en **New label**.
5. Rellena:
   - **Label name**: `risk:low`
   - **Description**: `Safe change: docs, config, low-impact`
   - **Color**: pega el hex `0E8A16` o haz clic en el círculo de color y escríbelo
6. Haz clic en **Create label**.
7. Repite para `risk:medium` (color `FBCA04`) y `risk:high` (color `D93F0B`).

---

## 2. Labels de área

El workflow `labeler.yml` aplica estos labels automáticamente según las carpetas modificadas.

```bash
gh label create "area:api"        --color "0075CA" --description "Changes to services/api"
gh label create "area:web"        --color "7057FF" --description "Changes to apps/web"
gh label create "area:contracts"  --color "E4E669" --description "Changes to packages/contracts"
gh label create "area:docs"       --color "C2E0C6" --description "Documentation changes"
gh label create "area:config"     --color "BFD4F2" --description "Config and tooling changes"
gh label create "area:infra"      --color "D4C5F9" --description "CI/CD and infrastructure"
gh label create "area:shared-ui"  --color "F9D0C4" --description "packages/shared/ui"
gh label create "area:ai-tooling" --color "0E8A16" --description ".github/agents, skills, prompts"
```

---

## 3. Branch protection rule para `main`

Esta regla evita pushes directos a `main` y garantiza que CI pase antes de cualquier merge.

### 3.1 Cómo configurarla

1. Ve a tu repositorio en GitHub.
2. Haz clic en **Settings** (pestaña en la barra superior — necesitas ser admin del repo).
3. En el menú izquierdo, haz clic en **Branches** (bajo la sección "Code and automation").
4. Haz clic en **Add branch ruleset** (si ves esta opción) o **Add rule** (en repos con la UI más antigua).

### 3.2 Configuración del ruleset

En **Branch name pattern**: escribe `main`.

Activa estas opciones una por una:

| Opción                                                               | Dónde está                            | Por qué activarla                                                       |
| -------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| **Require a pull request before merging**                            | Sección "Protect matching branches"   | Nadie puede hacer push directo a main                                   |
| **Required number of approvals before merging: 1**                   | Aparece al activar la opción anterior | Al menos 1 revisor humano debe aprobar                                  |
| **Dismiss stale pull request approvals when new commits are pushed** | Sub-opción de approvals               | Si se agrega un commit después de aprobación, se requiere re-aprobación |
| **Require review from Code Owners**                                  | Sub-opción de approvals               | Quienes están en CODEOWNERS deben aprobar su área                       |
| **Require status checks to pass before merging**                     | Sección siguiente                     | CI debe estar verde antes del merge                                     |
| **Require branches to be up to date before merging**                 | Sub-opción de status checks           | La rama debe tener los últimos cambios de main incorporados             |
| **Do not allow bypassing the above settings**                        | Sección final                         | Ni los admins saltan la protección                                      |

### 3.3 Agregar status checks requeridos

Bajo **Require status checks to pass**, en el campo de búsqueda aparecen los checks disponibles. **Solo aparecen después de que los workflows se ejecutaron al menos una vez.**

Para que aparezcan por primera vez: crea una rama de prueba, abre un PR pequeño y espera a que corran los workflows. Luego vuelve a esta pantalla y agrega:

- `validate` (del workflow `ci.yml`)
- `risk` (del workflow `risk-gate.yml`)

Haz clic en **Save changes** o **Create**.

---

## 4. Branch protection rules para `develop` / `qa` / `cert`

Esta sección cubre las ramas de entorno del pipeline de promoción.
Ver `docs/standards/git-branching.md` para el modelo completo.

### `develop` (entorno: dev)

| Opción                    | Valor              |
| ------------------------- | ------------------ |
| Require PR before merging | yes                |
| Required approvals        | 1 (peer reviewer)  |
| Required status checks    | `validate`, `risk` |
| Restrict force push       | yes                |
| Restrict deletions        | yes                |

### `qa` (entorno: QA)

| Opción                    | Valor                                  |
| ------------------------- | -------------------------------------- |
| Require PR before merging | yes                                    |
| Required approvals        | 1 (QA lead)                            |
| Required status checks    | `validate`                             |
| Restrict push to          | nobody — solo merge PR desde `develop` |
| Restrict force push       | yes                                    |

### `cert` (entorno: certificación — comparte DB de producción)

| Opción                    | Valor                             |
| ------------------------- | --------------------------------- |
| Require PR before merging | yes                               |
| Required approvals        | 1 (tech lead)                     |
| Required status checks    | `validate`, `risk`                |
| Restrict push to          | nobody — solo merge PR desde `qa` |
| Restrict force push       | yes                               |

> ⚠️ **Importante — `cert` comparte la DB de producción**: cualquier migración que llegue a `cert` afecta datos de producción. La regla de entorno `cert` en GitHub Environments debe requerir aprobación del tech lead cuando el PR contiene archivos de migración. Ver `docs/standards/git-branching.md` §7 para las salvaguardas obligatorias.

---

## 5. Secrets del repositorio

Los secrets son variables sensibles que los workflows usan en runtime. Se configuran en GitHub y nunca se exponen en el código.

### 4.1 Cómo agregar un secret

1. Ve a **Settings** → **Secrets and variables** → **Actions**.
2. Haz clic en **New repository secret**.
3. Rellena el nombre y el valor.
4. Haz clic en **Add secret**.

### 4.2 Secrets de este template

| Secret      | Cuándo se necesita                       | Cómo obtenerlo                                                                                            |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN` | Solo si publicas paquetes a npm registry | Ve a https://www.npmjs.com → tu avatar → **Access Tokens** → **Generate New Token** → tipo **Automation** |

### 4.3 GITHUB_TOKEN — no lo configures tú

`GITHUB_TOKEN` aparece referenciado en workflows como `secrets.GITHUB_TOKEN`. **No debes crearlo.** GitHub lo genera automáticamente al inicio de cada workflow run con permisos sobre el repo donde corre. Expira al terminar el run. Es el mecanismo estándar de GitHub para que los workflows puedan interactuar con la API de GitHub (crear PRs, comentar, agregar labels, etc.).

---

## 6. Environments: dev, qa, cert, production

Esta plantilla usa 4 environments que mapean directamente a las ramas de entorno.
Cada environment controla qué rama puede hacer deploy y qué aprobaciones se necesitan.

### Cómo crear environments

1. Ve a **Settings** → **Environments** (menú izquierdo).
2. Haz clic en **New environment**.
3. Configura cada uno según la tabla a continuación.

### Tabla de environments

| Environment  | Branch source | Required reviewers             | Wait timer | Notas                                    |
| ------------ | ------------- | ------------------------------ | ---------- | ---------------------------------------- |
| `dev`        | `develop`     | ninguno (auto-deploy)          | 0 min      | Deploy automático en merge a develop     |
| `qa`         | `qa`          | ninguno (auto-deploy)          | 0 min      | Deploy automático en merge a qa          |
| `cert`       | `cert`        | Tech lead (si hay migraciones) | 0 min      | Comparte DB de producción — ver §7       |
| `production` | tag `v*.*.*`  | Tech lead + Release manager    | 5 min      | 5 min de ventana de cancelación post-tag |

### `dev`

- **Name**: `dev`
- Sin required reviewers.
- Opcionalmente agrega variables de entorno específicas del entorno.

### `qa`

- **Name**: `qa`
- Sin required reviewers.
- Opcionalmente agrega variables de entorno de QA.

### `cert`

- **Name**: `cert`
- **Required reviewers**: Tech lead — **obligatorio cuando el PR incluye migraciones**.
  Para los demás PRs puede ser opcional según la criticidad del cambio.
- **Prevent self-review**: activar.

> ⚠️ **`cert` usa la DB de producción.** Los deployments a `cert` que incluyan migraciones deben requerir aprobación explícita. Ver `docs/standards/git-branching.md` §7.

### `production`

- **Name**: `production`
- **Deployment branches**: `tag: v*.*.*` — solo tags semánticos.
- **Required reviewers**: Tech lead + Release manager.
- **Prevent self-review**: activar.
- **Wait timer**: 5 minutos (ventana de cancelación después del `git push tag`).

---

## 7. CODEOWNERS

El archivo `.github/CODEOWNERS` define quién debe revisar cambios según la parte del codebase que afectan. Ya está en el repo con patrones base. Edítalo con los usernames reales de tu equipo.

### 6.1 Cómo editarlo

```bash
nano .github/CODEOWNERS
```

### 6.2 Formato y ejemplos

```
# Sintaxis: patrón    @usuario-o-equipo
# El último patrón que hace match gana.

# Todos los archivos — fallback global
*                                  @tu-usuario

# API backend
/services/api/**                   @backend-dev @tech-lead

# Frontend
/apps/web/**                       @frontend-dev

# Contratos — alta sensibilidad, requiere tech lead
/packages/contracts/**             @tech-lead @api-owner

# CI/CD e infraestructura
/.github/                          @devops-lead
/infra/**                          @devops-lead

# Documentación — cualquiera puede revisar
/docs/**                           @tu-usuario
```

Los equipos se referencian como `@org/team-name`. Los usuarios individuales como `@username`.

### 6.3 Cómo toma efecto

Una vez que está en `main`, cada PR que toque los paths definidos requerirá automáticamente la aprobación de los owners, siempre que la branch protection tenga **Require review from Code Owners** activo (configurado en §3).

---

## 8. Dependabot

Dependabot revisa automáticamente si tus dependencias tienen vulnerabilidades de seguridad o versiones desactualizadas, y abre PRs con los updates.

### 7.1 Estado actual

El archivo `.github/dependabot.yml` ya está en el repo. GitHub lo detecta automáticamente — no necesitas hacer nada adicional para activarlo.

Verifica que está presente:

```bash
cat .github/dependabot.yml
```

### 7.2 Qué hace en práctica

- Revisa `package.json` y dependencias de npm en todos los workspaces
- Abre PRs automáticos con actualizaciones (ej: "bump eslint from 9.18.0 to 9.20.0")
- Marca PRs con alertas de seguridad si encuentra vulnerabilidades conocidas (CVE)

### 7.3 Cómo gestionar los PRs de Dependabot

- Para updates de patch/minor sin breaking changes: revisa que CI esté verde y haz merge
- Para updates de major con breaking changes: revisa el CHANGELOG de la dependencia antes de hacer merge
- Para PRs de seguridad: priorízalos sobre features normales

---

## 9. GitHub Apps: Qodo

Qodo es una GitHub App que revisa PRs con IA. Publica comentarios con análisis de código en cada PR automáticamente.

### 8.1 Instalación

1. Ve a https://app.qodo.ai.
2. Haz clic en **Sign up with GitHub** y autoriza con tu cuenta.
3. Una vez dentro, haz clic en **Install GitHub App**.
4. Selecciona la organización o cuenta dueña del repo.
5. En **Repository access**, selecciona **Only select repositories** y elige tu repo específico (o **All repositories** si quieres activarlo en todos).
6. Haz clic en **Install & Authorize**.

### 8.2 Qué hace en cada PR

Automáticamente publica en el PR:

- un resumen del cambio
- análisis de código por archivo (si el cambio es relevante)
- sugerencias de mejora
- detección de bugs potenciales

No bloquea el merge — es informativo. Puedes ignorar sus comentarios si no aplican.

---

## 10. Status checks requeridos — cuándo aparecen

Los status checks en branch protection solo pueden configurarse después de que los workflows se ejecutan por primera vez. Pasos para activarlos:

1. **Asegúrate de que los workflows estén presentes** en `.github/workflows/`. Ya están en el template.
2. **Haz push de cualquier rama** (puede ser un cambio trivial en un archivo de docs).
3. **Abre un PR** desde esa rama hacia `main`.
4. **Espera** a que los workflows corran (2-5 minutos).
5. **Vuelve a Settings → Branches** y edita la branch protection de `main`.
6. En **Status checks**, busca y agrega:
   - `validate`
   - `risk`
7. Guarda.

A partir de ese momento, ningún PR puede hacer merge a `main` sin que esos checks estén en verde.

---

## 11. Verificación final

Después de completar toda la configuración, verifica con estos comandos:

```bash
# Confirma que los labels de riesgo existen
gh label list | grep "risk:"

# Confirma que los labels de área existen
gh label list | grep "area:"

# Confirma la branch protection de main
gh api repos/{owner}/{repo}/branches/main/protection 2>/dev/null | grep '"enabled"' | head -5

# Confirma branch protection de develop
gh api repos/{owner}/{repo}/branches/develop/protection 2>/dev/null | grep '"enabled"' | head -5

# Lista environments configurados
gh api repos/{owner}/{repo}/environments | jq '.environments[].name'
```

Y desde GitHub UI:

1. **Settings → Branches**: debe mostrar reglas para `main`, `develop`, `qa`, y `cert`.
2. **Settings → Environments**: debe mostrar `dev`, `qa`, `cert`, y `production`.
3. **Settings → Secrets**: debe mostrar `NPM_TOKEN` si aplica.
4. **Issues → Labels**: debe mostrar los 3 labels de riesgo y los 8 de área.
