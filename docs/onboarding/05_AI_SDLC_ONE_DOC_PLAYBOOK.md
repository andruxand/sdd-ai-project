# AI SDLC One-Doc Playbook

Este documento es **la única referencia que necesitas**.

Cubre todo, desde cero absoluto: crear una cuenta en GitHub, clonar el template, instalar cada herramienta, configurar el repositorio, hasta implementar un feature completo con IA y hacer merge a producción.

No asume que sabes nada del template, de los agentes, de OpenSpec ni de las herramientas. Cada paso está explicado con suficiente contexto para que puedas ejecutarlo sin buscar en ningún otro archivo.

> Si tu entorno ya está configurado y quieres ir directo a implementar un feature, salta al [§9 — Flujo SDLC completo](#9-flujo-sdlc-completo--feature-real-paso-a-paso).

## Regla principal: este flujo es agent-first

**La IA lidera. El dev valida y aprueba.**

- primero se usa IA (agentes o prompts en Copilot Chat)
- luego el dev revisa y valida el output
- por último el dev ejecuta los únicos pasos que no puede delegar (merge, deploy)

Cuando veas comandos de terminal en este doc, son obligatoriamente manuales: setup local, operaciones Git o fallbacks operativos.

---

## Índice

1. [Conceptos clave — qué es cada cosa](#1-conceptos-clave--qué-es-cada-cosa)
2. [Crear cuenta GitHub y repositorio](#2-crear-cuenta-github-y-repositorio)
3. [Instalar herramientas locales](#3-instalar-herramientas-locales)
4. [Clonar y preparar el repo localmente](#4-clonar-y-preparar-el-repo-localmente)
5. [Configurar GitHub: branch protection, secrets, labels, environments](#5-configurar-github-branch-protection-secrets-labels-environments)
6. [Configurar VS Code y Copilot](#6-configurar-vs-code-y-copilot)
7. [Bootstrap del template](#7-bootstrap-del-template)
8. [Inicializar OpenSpec](#8-inicializar-openspec)
9. [Flujo SDLC completo — feature real paso a paso](#9-flujo-sdlc-completo--feature-real-paso-a-paso)
10. [Gestión de sesiones y handoffs](#10-gestión-de-sesiones-y-handoffs)
11. [Validación de calidad](#11-validación-de-calidad)
12. [Contratos de API](#12-contratos-de-api)
13. [Changesets — versionado antes del merge](#13-changesets--versionado-antes-del-merge)
14. [Abrir PR y hacer merge](#14-abrir-pr-y-hacer-merge)
15. [Release y rollback](#15-release-y-rollback)
16. [Automatizaciones activas — qué pasa sin que hagas nada](#16-automatizaciones-activas--qué-pasa-sin-que-hagas-nada)
17. [Risk Gate — cómo se clasifica el riesgo del cambio](#17-risk-gate--cómo-se-clasifica-el-riesgo-del-cambio)
18. [Dev Container — entorno reproducible opcional](#18-dev-container--entorno-reproducible-opcional)
19. [Checklist antes del primer merge](#19-checklist-antes-del-primer-merge)
20. [FAQ — preguntas frecuentes](#20-faq--preguntas-frecuentes)

---

## 1. Conceptos clave — qué es cada cosa

Antes de instalar nada, entiende las capas:

### 1.1 Las 4 capas del sistema

```
┌──────────────────────────────────────────┐
│  OpenSpec                                │
│  Artefactos spec-first: proposal,        │
│  design, tasks. Son la fuente de verdad  │
│  de qué y por qué se implementa.         │
├──────────────────────────────────────────┤
│  Agent OS (.github/agents, skills,       │
│  prompts, instructions)                  │
│  Define roles de IA, guías de dominio    │
│  y atajos para tareas repetitivas.       │
├──────────────────────────────────────────┤
│  Copilot en VS Code                      │
│  Interfaz de conversación donde invocas  │
│  @agentes y /prompts.                    │
├──────────────────────────────────────────┤
│  Calidad y release                       │
│  Turborepo, Husky hooks, CI (GitHub      │
│  Actions), contracts, Changesets.        │
└──────────────────────────────────────────┘
```

### 1.2 Tabla de referencia rápida

| Pieza             | Qué hace                                                                                                                    | Cuándo entra en juego                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Agent OS**      | Capa de operación de IA. Define estándares globales para todos los agentes.                                                 | Durante todo el SDLC                            |
| **Custom agents** | Roles especializados como `@openspec`, `@backend-implementer`, `@reviewer`. Cada uno sabe exactamente qué hacer en su fase. | Al invocarlos en Copilot Chat por fase          |
| **Skills**        | Guías técnicas de dominio (testing, seguridad, performance, etc.). La IA las carga automáticamente según el contexto.       | Durante implementación y testing                |
| **Prompts**       | Atajos reutilizables como `/handoff`, `/jira-to-change`, `/resume-phase`. Los invocas con barra.                            | Para tareas repetitivas de sesión               |
| **OpenSpec CLI**  | Herramienta que valida que los artefactos spec (proposal/design/tasks) existan y estén bien formados antes de implementar.  | Antes de arrancar cualquier feature             |
| **MCP servers**   | Conectores que permiten a la IA consultar GitHub y docs de AWS directamente desde el chat.                                  | Cuando la IA necesita contexto externo          |
| **Dev Container** | Imagen Docker con todo el toolchain preinstalado. Evita el "en mi máquina funciona".                                        | Opcional, especialmente útil en Codespaces      |
| **Changesets**    | Sistema de versionado semántico. Registra qué cambió y con qué impacto antes del merge.                                     | Antes de hacer merge si el cambio es de paquete |
| **Turborepo**     | Orquestador de tareas del monorepo. Corre lint/test/build en todos los workspaces con caché.                                | Al correr `npm run validate`                    |
| **Husky**         | Hooks de Git preconfigurados. Actúan en commit y push automáticamente.                                                      | Siempre, sin acción del dev                     |

### 1.3 Quién ejecuta qué

| Tipo                         | Ejemplos                                                                  | Cómo                                  |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| **Totalmente automático**    | Hooks de commit, labels de PR, CI, typecheck en push                      | No haces nada                         |
| **IA asistido — tú invocas** | Intake, proposal, design, tasks, routing, implementación, testing, review | `@agente` o `/prompt` en Copilot Chat |
| **Manual obligatorio**       | `npm install`, `npm run validate`, decisión de merge                      | Terminal o GitHub UI                  |

---

## 2. Crear cuenta GitHub y repositorio

### 2.1 Crear cuenta en GitHub (si no tienes una)

1. Abre https://github.com en tu navegador.
2. Haz clic en **Sign up** (esquina superior derecha).
3. Ingresa tu email, crea una contraseña y elige un username.
4. Verifica el email que GitHub te envía.
5. Selecciona el plan **Free** (es suficiente para empezar).

### 2.2 Activar GitHub Copilot

Copilot es la IA que usarás. Necesitas una suscripción activa.

1. Ve a https://github.com/features/copilot.
2. Haz clic en **Start a free trial** o **Subscribe**.
3. Sigue el proceso de pago (hay plan individual ~$10/mes) o usa el acceso de tu organización si ya tienes uno.
4. Una vez activo, verás **Copilot** en el menú de tu avatar arriba a la derecha.

> Si eres estudiante, GitHub Copilot es gratuito via GitHub Education: https://education.github.com/

### 2.3 Crear el repositorio desde este template

**No hagas fork ni clones a mano**. Este template se usa con la función "Use this template" de GitHub.

1. Ve a la URL del template: `https://github.com/[org]/sdd-ai-template` (reemplaza `[org]` con la organización dueña del template).
2. Haz clic en el botón verde **Use this template** → **Create a new repository**.
3. Completa el formulario:
   - **Owner**: tu usuario de GitHub o la organización de tu equipo.
   - **Repository name**: el nombre de tu proyecto, ej: `mi-proyecto-api`.
   - **Description**: describe brevemente para qué es el proyecto.
   - **Visibility**: elige `Private` para proyectos de trabajo o `Public` para open source.
4. Haz clic en **Create repository**.

GitHub crea una copia completa del template en tu cuenta con todos los archivos, workflows y configuración. **No hereda el historial de commits del template** — tu repo empieza limpio.

---

## 3. Instalar herramientas locales

Instala en este orden exacto. No saltes pasos.

### 3.1 Homebrew (macOS solamente)

Homebrew es el gestor de paquetes de macOS. Todo lo demás se instala a través de él.

1. Abre la aplicación **Terminal** (la encuentras en `/Applications/Utilities/Terminal.app` o buscando "Terminal" en Spotlight con `Cmd+Space`).
2. Pega y ejecuta:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

3. Sigue las instrucciones en pantalla. Te pedirá tu contraseña de macOS.
4. Al finalizar, ejecuta los comandos que Homebrew indique para agregar brew al PATH (los muestra al final de la instalación, comienzan con `echo 'eval ...'`).
5. Verifica: `brew --version` debe mostrar un número de versión.

**En Linux (Ubuntu/Debian):** usa `apt`:

```bash
sudo apt update && sudo apt upgrade -y
```

**En Windows:** usa WSL2 (Windows Subsystem for Linux) y sigue las instrucciones de Ubuntu arriba. Instalar directamente en Windows sin WSL no está soportado.

### 3.2 Git

Git viene preinstalado en macOS pero puede estar desactualizado.

```bash
brew install git
```

Verifica: `git --version` debe mostrar `2.40` o superior.

Configura tu identidad (Git la necesita para los commits):

```bash
git config --global user.name "Tu Nombre Completo"
git config --global user.email "tu@email.com"
```

Usa el mismo email de tu cuenta de GitHub.

### 3.3 Node Version Manager (nvm)

`nvm` permite instalar múltiples versiones de Node.js y cambiar entre ellas. Este template requiere Node 22.

```bash
brew install nvm
```

Homebrew te dirá que agregues estas líneas a tu `~/.zshrc` o `~/.bash_profile`. Hazlo:

```bash
# Abre el archivo de configuración de tu shell
nano ~/.zshrc
```

Agrega al final del archivo:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"
```

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`. Luego recarga el shell:

```bash
source ~/.zshrc
```

Verifica: `nvm --version` debe mostrar un número de versión.

Instala Node 22:

```bash
nvm install 22
nvm use 22
nvm alias default 22
```

Verifica: `node --version` debe mostrar `v22.x.x`.

### 3.4 GitHub CLI (`gh`)

La CLI de GitHub te permite autenticarte y ejecutar operaciones de GitHub desde terminal.

```bash
brew install gh
```

Autentícate:

```bash
gh auth login
```

El wizard te pregunta:

- **Where do you use GitHub?** → `GitHub.com`
- **What is your preferred protocol?** → `HTTPS`
- **Authenticate with GitHub credentials?** → `Yes`
- **How would you like to authenticate?** → `Login with a web browser`

Sigue las instrucciones: copia el código que aparece en terminal y ábrelo en tu navegador. Autoriza la aplicación.

Verifica: `gh auth status` debe mostrar `Logged in to github.com` con tu username.

Configura el token como variable de entorno (la IA lo necesita vía MCP):

```bash
echo 'export GH_TOKEN=$(gh auth token)' >> ~/.zshrc
source ~/.zshrc
```

Verifica: `echo $GH_TOKEN` debe mostrar un token (cadena larga que comienza con `ghp_` o `gho_`).

### 3.5 Python 3 (para MCP server de AWS docs)

```bash
brew install python@3.12
```

También necesitas `uv` (ejecutor de Python moderno que usa el MCP):

```bash
brew install uv
```

Verifica: `python3 --version` debe mostrar `3.12.x` y `uv --version` un número de versión.

> **Nota sobre `uvx`:** El MCP server de AWS docs usa el comando `uvx` (runner de herramientas de `uv`). `uvx` está incluido cuando instalas `uv` — no requiere instalación separada. Verifica con `uvx --version`.

### 3.6 Visual Studio Code

1. Ve a https://code.visualstudio.com.
2. Descarga la versión para tu OS.
3. Arrastra la app a tu carpeta `/Applications` (macOS).
4. Abre VS Code.
5. Instala el comando `code` en el PATH: abre el Command Palette con `Cmd+Shift+P`, busca **Shell Command: Install 'code' command in PATH** y ejecútalo.

Verifica: `code --version` en terminal debe mostrar un número de versión.

### 3.7 Extensiones requeridas de VS Code

Con VS Code abierto, instala estas extensiones. La forma más fácil: abre el Command Palette (`Cmd+Shift+P`), busca **Extensions: Install Extensions** y busca cada una por nombre.

| Extensión           | Publisher | Para qué sirve                         |
| ------------------- | --------- | -------------------------------------- |
| GitHub Copilot      | GitHub    | IA principal, chat y completions       |
| GitHub Copilot Chat | GitHub    | Interfaz de chat con agentes y prompts |
| ESLint              | Microsoft | Lint en tiempo real                    |
| Prettier            | Prettier  | Formateo automático                    |

O instálalas en un solo comando desde terminal:

```bash
code --install-extension github.copilot
code --install-extension github.copilot-chat
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
```

### 3.8 Validar instalación completa

Corre esto para confirmar que todo está listo:

```bash
node --version    # debe decir v22.x.x
npm --version     # debe decir 10.x.x
git --version     # debe decir 2.40.x o superior
gh auth status    # debe decir Logged in to github.com
echo $GH_TOKEN    # debe mostrar un token (no vacío)
python3 --version # debe decir 3.12.x
uv --version      # debe mostrar un número
code --version    # debe mostrar un número
```

Si alguno falla, vuelve al paso correspondiente antes de continuar.

---

## 4. Clonar y preparar el repo localmente

### 4.1 Clonar el repositorio

Reemplaza `TU_USUARIO` y `mi-proyecto-api` con tus valores reales:

```bash
git clone https://github.com/TU_USUARIO/mi-proyecto-api.git
cd mi-proyecto-api
```

### 4.2 Activar la versión correcta de Node

Este template incluye un archivo `.nvmrc` que especifica la versión de Node requerida. Siempre corre esto primero al entrar al repo:

```bash
nvm use
```

Debes ver: `Now using node v22.x.x`. Si ves un error como "version not installed", corrije con `nvm install 22 && nvm use`.

### 4.3 Instalar dependencias

```bash
npm install
```

Este comando:

- instala todas las dependencias del monorepo
- configura automáticamente los hooks de Husky (pre-commit, commit-msg, pre-push)
- linkea los workspaces internos (apps, services, packages)

Debe finalizar sin errores. Si ves errores de peer dependencies o permisos, no ignores — resuélvelos antes de continuar.

### 4.4 Verificar hooks activos

Los hooks de Git se configuran solos con `npm install`. Para confirmar que están activos:

```bash
ls -la .husky/
```

Debes ver archivos: `pre-commit`, `commit-msg`, `prepare-commit-msg`, `pre-push`.

¿Qué hace cada uno?

- **pre-commit**: cuando ejecutas `git commit`, automáticamente corre ESLint y Prettier sobre los archivos staged. Si hay errores de lint o formato, el commit se cancela.
- **commit-msg**: valida que el mensaje del commit siga [Conventional Commits](https://www.conventionalcommits.org/). Formato requerido: `tipo(scope): descripción`. Ej: `feat(api): add user endpoint`. Si el mensaje no cumple, el commit se cancela.
- **prepare-commit-msg**: si tu rama tiene una Jira key (ej: `feat/PROJ-123-algo`), la prepend automáticamente al mensaje del commit. No tienes que hacerlo a mano.
- **pre-push**: cuando ejecutas `git push`, corre typecheck global del monorepo. Si hay errores de tipos, el push se cancela.

---

## 5. Configurar GitHub: branch protection, secrets, labels, environments

Esta es la configuración externa en GitHub que activa todas las protecciones y automatizaciones. Se hace una sola vez por repositorio, desde la interfaz web de GitHub.

> Para tener esta configuración disponible también como referencia rápida, ver `docs/runbooks/GITHUB_REPO_SETTINGS.md`.

### 5.1 Crear labels de riesgo

Los workflows de CI aplican labels automáticamente a cada PR para indicar el nivel de riesgo del cambio. Pero los labels deben existir primero en el repo.

**Opción A — GitHub CLI (recomendado):**

```bash
gh label create "risk:low"    --color "0E8A16" --description "Safe change: docs, config, low-impact"
gh label create "risk:medium" --color "FBCA04" --description "Service or package change"
gh label create "risk:high"   --color "D93F0B" --description "Auth, infra, migrations, contracts"
```

**Opción B — GitHub UI:**

1. Ve a tu repositorio en GitHub.
2. Haz clic en la pestaña **Issues**.
3. Haz clic en **Labels** (botón gris a la derecha de la barra de búsqueda).
4. Haz clic en **New label**.
5. Crea los 3 labels con los colores indicados arriba.

### 5.2 Crear labels de área

Estos labels identifican qué parte del codebase toca cada PR:

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

### 5.3 Branch protection rule para `main`

Esta regla evita que alguien haga push directo a `main` sin pasar por un PR y checks.

1. Ve a tu repositorio en GitHub.
2. Haz clic en **Settings** (pestaña superior, necesitas ser admin del repo).
3. En el menú izquierdo, haz clic en **Branches**.
4. Haz clic en **Add branch ruleset** o **Add rule** (depende de la versión de GitHub UI).
5. En **Branch name pattern**, escribe `main`.
6. Activa las siguientes opciones:

| Opción                                               | Por qué                                        |
| ---------------------------------------------------- | ---------------------------------------------- |
| **Require a pull request before merging**            | Nadie puede hacer push directo a main          |
| **Required approvals: 1** (o más)                    | Al menos un revisor humano antes de merge      |
| **Require status checks to pass before merging**     | CI debe estar verde antes de merge             |
| **Require branches to be up to date before merging** | La rama debe tener los últimos cambios de main |
| **Do not allow bypassing the above settings**        | Ni los admins saltan la protección             |

7. En **Status checks that are required**, agrega estos checks (aparecen después de que los workflows se ejecutan por primera vez):
   - `validate` (del workflow `ci.yml`)
   - `risk` (del workflow `risk-gate.yml`)

8. Haz clic en **Create** o **Save changes**.

### 5.4 Configurar Secrets del repositorio

Los secrets son variables sensibles que los workflows usan sin exponerlas en el código.

1. Ve a **Settings** → **Secrets and variables** → **Actions**.
2. Haz clic en **New repository secret** para cada uno:

| Secret      | Valor              | Para qué                                                                                                             |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN` | Token de npmjs.com | Si publicas paquetes a npm registry. Ve a npmjs.com → Access Tokens → Generate. Si no publicas paquetes, omite este. |

> `GITHUB_TOKEN` **no lo configuras tú** — GitHub lo genera automáticamente en cada workflow run. Ya está disponible como `secrets.GITHUB_TOKEN` sin que hagas nada.

### 5.5 Configurar Environments

Este template usa 4 environments que mapean directamente al pipeline de ramas
`develop → qa → cert → main`. Configura cada uno en **Settings → Environments**.

Para la guía completa (incluyendo branch source y permisos por environment), ver
`docs/runbooks/GITHUB_REPO_SETTINGS.md` §6.

#### Resumen rápido

| Environment  | Branch source | Required reviewers             | Wait timer |
| ------------ | ------------- | ------------------------------ | ---------- |
| `dev`        | `develop`     | ninguno (auto-deploy)          | 0 min      |
| `qa`         | `qa`          | ninguno (auto-deploy)          | 0 min      |
| `cert`       | `cert`        | Tech lead (si hay migraciones) | 0 min      |
| `production` | tag `v*.*.*`  | Tech lead + Release manager    | 5 min      |

1. Ve a **Settings** → **Environments** → **New environment**.
2. Crea `dev`: sin required reviewers.
3. Crea `qa`: sin required reviewers.
4. Crea `cert`:
   - Required reviewers: Tech lead — obligatorio si el PR incluye migraciones.
   - Activa **Prevent self-review**.
5. Crea `production`:
   - Deployment branches: solo tags semánticos (`v*.*.*`).
   - Activa **Required reviewers** (tech lead + release manager).
   - Activa **Prevent self-review**.
   - Configura un **wait timer** de 5 minutos (ventana de cancelación post-tag).

### 5.6 Instalar GitHub App: Qodo (revisión de PR con IA)

Qodo es una GitHub App que revisa PRs automáticamente con IA.

1. Ve a https://app.qodo.ai.
2. Regístrate con tu cuenta de GitHub.
3. Haz clic en **Install** y selecciona el repositorio donde quieres activarlo.
4. Aprueba los permisos solicitados.

Una vez instalada, Qodo comentará automáticamente en cada PR con un análisis de código.

### 5.7 Configurar Dependabot

Dependabot revisa dependencias desactualizadas o con vulnerabilidades automáticamente.

El archivo `.github/dependabot.yml` ya está en el repo configurado. Solo verifica que exista:

```bash
cat .github/dependabot.yml
```

Si está presente, Dependabot ya está activo — GitHub lo detecta automáticamente.

### 5.8 CODEOWNERS

El archivo `.github/CODEOWNERS` define quién debe revisar cada parte del codebase. Ya está configurado con patrones base. Edítalo para poner tus usernames reales:

```bash
# Ejemplo de CODEOWNERS
*                          @tu-usuario
/services/api/**           @tu-usuario @otro-dev
/packages/contracts/**     @tech-lead
/.github/                  @devops-lead
```

---

## 6. Configurar VS Code y Copilot

### 6.1 Abrir el repo en VS Code

```bash
code .
```

Abre VS Code en la carpeta del repositorio. Esto es importante: VS Code debe estar en la raíz del repo para que los agentes y prompts sean detectados.

### 6.2 Iniciar sesión en Copilot

1. En VS Code, haz clic en el ícono de Copilot en la barra inferior (o en el panel izquierdo).
2. Haz clic en **Sign In**.
3. Inicia sesión con la misma cuenta de GitHub donde tienes Copilot activo.
4. Acepta los permisos.

Si Copilot ya estaba configurado, este paso puede saltarse.

### 6.3 Verificar que el Agent OS es detectado

1. Abre el panel de Copilot Chat: `Cmd+Shift+I` o haz clic en el ícono de chat.
2. Escribe `@` — debe aparecer un dropdown con los agentes disponibles (`@openspec`, `@backend-implementer`, etc.).
3. Escribe `/` — debe aparecer el dropdown de prompts (`/handoff`, `/jira-to-change`, etc.).

Si los agentes no aparecen:

- Verifica que el repo fue abierto en la raíz (no en una subcarpeta).
- Verifica que la extensión **GitHub Copilot Chat** está instalada y actualizada.
- Reinicia VS Code.

### 6.4 Verificar MCP servers

Los MCP servers permiten a la IA consultar GitHub y AWS docs directamente.

Configuración: `.vscode/mcp.json` ya está en el repo. Para que funcione:

1. Confirma que `$GH_TOKEN` está seteado (`echo $GH_TOKEN` en terminal).
2. Abre VS Code desde el terminal del repo (no desde el ícono del dock) para que herede las variables de entorno.
3. En Copilot Chat, pide algo que requiera GitHub: "¿Qué PRs están abiertos?" — si responde con datos reales, MCP funciona.

### 6.5 El archivo `.copilotignore`

El repo incluye un archivo `.copilotignore` en la raíz. Este archivo le indica a Copilot
qué archivos **no** debe leer en su contexto, similar a `.gitignore`.

Está configurado para excluir: `node_modules/`, `dist/`, `build/`, `.generated/`, `coverage/`,
archivos de lock (`*.lock`, `package-lock.json`), y archivos de entorno (`.env`, `.env.*`).

Por qué importa: si Copilot parece no ver ciertos archivos al preguntarle sobre el proyecto,
revisa `.copilotignore` — el archivo puede estar excluido deliberadamente. Los archivos en
`.generated/` y `coverage/` no son útiles para la IA y agregarían ruido al contexto.

---

## 7. Bootstrap del template

El bootstrap es un asistente interactivo que adapta el template a tu tipo de proyecto. Solo se corre una vez.

```bash
npm run bootstrap
```

El wizard te hace preguntas sobre:

- tipo de proyecto (backend-only, frontend-only, fullstack-monorepo)
- características que necesitas (auth, contratos GraphQL, observabilidad, etc.)

Al finalizar genera:

- `.generated/active-profile.yaml` — el perfil activo de tu proyecto
- `.generated/bootstrap-selection.json` — tus elecciones del wizard
- `.generated/next-steps.md` — próximos pasos específicos para tu configuración

**Lee `.generated/next-steps.md`** antes de continuar. Puede tener instrucciones adicionales específicas para tu perfil.

También actualiza `openspec/config.yaml` con el nombre real de tu proyecto (el bootstrap no lo hace automáticamente):

```yaml
# openspec/config.yaml
context:
  project_name: mi-proyecto # cambia esto
```

---

## 8. Inicializar OpenSpec

OpenSpec es el sistema que garantiza que siempre haya un spec claro antes de implementar. Piénsalo como el "contrato" entre el negocio y el equipo técnico.

**OpenSpec es agent-first: no requiere CLI.** Los artefactos son creados y gestionados por el agente `@openspec` en Copilot Chat, no por comandos de terminal.

Cuando abres una conversación con `@openspec`, el agente ejecuta `openspec:status` automáticamente y te muestra los cambios activos. Después de crear o actualizar cualquier artefacto, ejecuta `openspec:validate` automáticamente y te reporta el resultado en el chat — no tienes que correr nada.

En CI, `openspec:validate` corre en cada push para verificar que no haya artefactos vacíos.

**Regla de oro: no inicies implementación sin un spec aprobado en `openspec/changes/`.**

---

## 9. Flujo SDLC completo — feature real paso a paso

A partir de aquí el flujo se repite por cada feature. Sigue estos pasos en orden.

### 9.1 Paso 1 — Intake con IA (la rama se crea automáticamente)

`@openspec` crea la rama automáticamente durante el intake, aplicando la convención del repo a partir de la Jira key:

```
tipo/JIRA-KEY-descripcion-corta
```

Ejemplos de nombres generados:

- `feat/PROJ-123-user-registration`
- `fix/PROJ-456-login-token-expiry`
- `chore/PROJ-789-update-dependencies`

Si por alguna razón necesitas crear la rama manualmente (ej: ya tenías la rama o prefieres hacerlo antes), puedes saltarte este paso y el agente lo detectará.

### 9.2 Paso 2 — Intake con IA

Ahora le explicas a la IA qué quieres construir. Usa `@openspec` en Copilot Chat.

Formato recomendado de intake:

```
@openspec

Ticket: PROJ-123
Problema: los usuarios no pueden registrarse con email y contraseña
Objetivo: implementar endpoint de registro con validación y email de confirmación
Criterios de aceptación:
  - POST /users/register recibe email y password
  - valida formato de email y longitud de password
  - envía email de confirmación
  - retorna 201 con userId en respuesta
Restricciones:
  - no guardar password en plain text
  - cumplir contrato OpenAPI existente si ya existe el path
Contexto adicional: [links a Jira, Figma, etc. si tienes]
```

Si el ticket viene de Jira, usa el prompt `/jira-to-change` primero para normalizar:

```
/jira-to-change https://miorg.atlassian.net/browse/PROJ-123
```

### 9.3 Paso 3 — Spec con IA (obligatorio antes de implementar)

Continúa en la misma sesión de chat con `@openspec`:

```
@openspec genera proposal, design y tasks para el intake anterior
```

La IA producirá en orden:

1. **Proposal** (`openspec/changes/PROJ-123/proposal.md`): qué y por qué. Incluye problema, solución propuesta, alternativas descartadas y riesgos.
2. **Design** (`openspec/changes/PROJ-123/design.md`): cómo. Incluye diagrama de arquitectura, contratos de API, esquemas de datos, dependencias.
3. **Tasks** (`openspec/changes/PROJ-123/tasks.md`): lista de tareas técnicas divididas por stream (backend, frontend, contratos, etc.).

**Revisa los 3 artefactos.** Si algo no está claro o tiene supuestos incorrectos, corrígelo en el chat antes de continuar.

`@openspec` ejecuta `openspec:validate` automáticamente después de crear cada artefacto y te reporta el resultado en el chat. No necesitas correr nada manualmente.

### 9.4 Paso 4 — Orden de ejecución de agentes

El spec que generó `@openspec` ya contiene el `tasks.md` dividido por stream. Lee la sección de tasks para saber qué hay que hacer. El orden de ejecución de agentes es siempre el mismo y depende de tu perfil.

**Regla:** no necesitas ningún agente "organizador" extra. El orden está definido en `AGENTS.md` y en tu `tasks.md`.

**Orden estándar (fullstack):**

```
1. @contracts-implementer  ← primero si el feature toca endpoints
2. @backend-implementer
3. @frontend-implementer
4. @observability-implementer  ← solo si tasks.md lo indica
5. @tester-backend
6. @tester-frontend
7. @e2e-tester  ← solo si el perfil tiene playwright
8. @security    ← solo si risk=high en el spec
9. @reviewer
```

**Orden estándar (backend-only):**

```
1. @contracts-implementer  ← solo si toca endpoints
2. @backend-implementer
3. @observability-implementer  ← solo si tasks.md lo indica
4. @tester-backend
5. @security    ← solo si risk=high
6. @reviewer
```

**Orden estándar (frontend-only):**

```
1. @frontend-implementer
2. @tester-frontend
3. @e2e-tester  ← solo si el perfil tiene playwright
4. @reviewer
```

Si tienes dudas sobre qué streams aplican a tu feature específico, usa `/route-feature` para que el sistema te lo confirme con base en tu `tasks.md` actual.

```
/route-feature ¿Qué agentes necesito ejecutar para este feature?
```

### 9.5 Paso 5 — Implementación por stream

Ejecuta cada stream en su propia sesión de chat.

**Contratos (si el feature toca API):**

```
@contracts-implementer implementa los changes de contrato según design.md
```

**Backend:**

```
@backend-implementer implementa el stream de backend según tasks.md, sección Backend
```

**Frontend:**

```
@frontend-implementer implementa el stream de frontend según tasks.md, sección Frontend
```

**Observabilidad (si aplica):**

```
@observability-implementer agrega trazas, métricas y logs según el feature
```

Regla: **una sesión por stream**. Cuando un stream termina, haz `/handoff` antes de abrir el siguiente.

### 9.6 Paso 6 — Testing

Después de implementar cada stream, corre testing con el agente correspondiente:

```
@tester-backend genera tests para el stream de backend implementado
```

```
@tester-frontend genera tests para los componentes implementados
```

```
@e2e-tester genera tests end-to-end para el flujo completo (si aplica)
```

### 9.7 Paso 7 — Revisión de seguridad (si aplica)

Obligatorio si el feature toca cualquiera de: auth, permisos, datos de usuario (PII), integraciones externas, contratos, IAM, WAF, JWT, API keys.

```
@security revisa el feature implementado en busca de vulnerabilidades
```

### 9.8 Paso 8 — Revisión técnica final

Antes de abrir el PR:

```
@reviewer prepara el PR: verifica calidad, tests, contratos y checklist de merge
```

---

## 10. Gestión de sesiones y handoffs

### 10.1 Por qué importa

Una sesión de chat degradada (con historial largo de errores, alternativas descartadas, código viejo) hace que la IA empiece a contradecirse o repetir errores ya resueltos.

**Regla: una fase por sesión.**

### 10.2 Cerrar una sesión correctamente

Al terminar una fase (ej: terminaste el stream de backend):

```
/handoff
```

La IA produce un documento de handoff en `openspec/changes/{change-id}/handoff.md` que incluye:

- qué se hizo
- decisiones tomadas
- estado actual
- próximos pasos

### 10.3 Arrancar la siguiente sesión

En una sesión nueva de Copilot Chat:

```
/resume-phase openspec/changes/PROJ-123/handoff.md
```

La IA lee el handoff y retoma desde donde quedó, sin necesidad de re-explicar todo el contexto.

### 10.4 Cuándo NO cortar la sesión

| Situación                                | Acción           |
| ---------------------------------------- | ---------------- |
| Iteración rápida dentro de la misma fase | Mantén la sesión |
| Debug activo con feedback loop corto     | Mantén la sesión |
| Spec conversacional (intake → proposal)  | Mantén la sesión |

---

## 11. Validación de calidad

### 11.1 Validación completa (obligatoria antes de PR)

```bash
npm run validate
```

Este comando corre en secuencia:

1. `lint` — ESLint en todos los archivos TypeScript/JavaScript
2. `format:check` — Prettier verifica que el formato sea correcto
3. `md:lint` — markdownlint en todos los `.md`
4. `yaml:lint` — yamllint en todos los `.yml`/`.yaml`
5. `spellcheck` — cspell en todos los archivos
6. `typecheck` — TypeScript compiler en todos los workspaces
7. `coverage` — tests con reporte de cobertura

Si falla en algún paso, el output te dice exactamente en qué archivo y línea.

**Para auto-corregir formato y lint automáticamente:**

```bash
npm run lint -- --fix
npm run format
```

Luego vuelve a correr `npm run validate` para confirmar verde.

### 11.2 Diagnóstico puntual

Si quieres correr solo una parte:

```bash
npm run lint         # solo ESLint
npm run typecheck    # solo TypeScript
npm run test         # solo tests (sin coverage)
npm run coverage     # tests + coverage report
```

### 11.3 Validación de OpenSpec

`@openspec` ejecuta `openspec:validate` automáticamente durante el flujo de spec — no es un paso manual del dev.

En CI corre en cada push y falla el pipeline si hay artefactos vacíos. Si quieres correrlo manualmente en cualquier momento:

```bash
npm run openspec:validate
```

---

## 12. Contratos de API

Si tu feature toca la API (REST o GraphQL), los contratos deben validarse por separado.

### 12.1 REST (OpenAPI)

```bash
npx @redocly/cli lint packages/contracts/rest/openapi.yaml
```

### 12.2 GraphQL

```bash
npx graphql-inspector validate 'packages/contracts/graphql/**/*.graphql'
```

### 12.3 Cuándo actualizar contratos

- si agregas un endpoint nuevo: define el path en `packages/contracts/rest/paths/`
- si cambias un response schema: actualiza el componente en `packages/contracts/rest/components/`
- si cambias el schema GraphQL: modifica el `.graphql` correspondiente

Los contratos van **antes** que la implementación cuando usas `@contracts-implementer`.

---

## 13. Changesets — versionado antes del merge

### 13.1 ¿Qué es y para qué?

Changeset es un pequeño archivo `.md` que registra qué paquetes cambiaron y con qué semántica de versión (`patch`, `minor`, `major`). El workflow de release los consume para bumping de versiones y generación de CHANGELOG.

### 13.2 Cuándo crear un changeset

Crea uno cuando tu PR:

- agrega o cambia funcionalidad de un paquete publicable (`packages/*`, `services/*`)
- rompe una API existente (`major`)
- agrega algo nuevo retrocompatible (`minor`)
- corrige un bug sin cambiar la API (`patch`)

**No creas changeset para:** cambios de docs, config, tooling, o ajustes internos que no afectan la API pública del paquete.

### 13.3 Cómo crear un changeset

```bash
npx changeset
```

El wizard interactivo te pide:

1. qué paquetes cambiaron (selecciona con espacio, confirma con enter)
2. tipo de cambio por paquete (`patch`, `minor`, `major`)
3. descripción del cambio (va al CHANGELOG)

Genera un archivo en `.changeset/nombre-aleatorio.md`. Haz commit de ese archivo junto con tu feature.

### 13.4 Qué pasa en CI con el changeset

Cuando haces merge a `main`, el workflow `release.yml` detecta los changesets y:

1. crea automáticamente un PR "chore(release): version packages" con los bumps de versión
2. cuando ese PR se hace merge, corre `changeset publish` para publicar a npm (si aplica)

---

## 14. Abrir PR y hacer merge

### 14.1 Push de la rama

```bash
git push origin feat/PROJ-123-user-registration
```

El hook `pre-push` corre typecheck automáticamente. Si falla, el push se cancela — corrige los errores de tipo y vuelve a intentar.

### 14.2 Crear el PR en GitHub

**Opción A — GitHub CLI:**

```bash
gh pr create --fill
```

Esto crea el PR con el título y descripción del último commit. Agrega `--web` para abrirlo en el navegador y editar la descripción.

**Opción B — GitHub UI:**

1. Ve a tu repositorio en GitHub.
2. Aparecerá un banner amarillo "Compare & pull request" para tu rama reciente. Haz clic.
3. Completa:
   - **Title**: sigue conventional commits: `feat(api): add user registration endpoint`
   - **Description**: usa el template que GitHub carga automáticamente (`.github/pull_request_template.md`)
   - **Reviewers**: asigna revisores
   - **Labels**: los labels de área y riesgo se aplican automáticamente por los workflows

### 14.3 Qué pasa automáticamente después de abrir el PR

- **CI corre** (`ci.yml`): lint, format, typecheck, tests, coverage, OpenSpec validate
- **Risk Gate corre** (`risk-gate.yml`): analiza qué archivos cambiaron y aplica `risk:low`, `risk:medium`, o `risk:high` como label
- **Labeler corre** (`labeler.yml`): aplica labels de área según carpetas modificadas
- **Qodo revisa** (si está instalado): publica un comentario de análisis de código

### 14.4 Hacer merge

Solo cuando:

- [ ] todos los checks de CI están en verde ✓
- [ ] el PR tiene al menos una aprobación humana ✓
- [ ] no hay comentarios pendientes de resolver ✓
- [ ] si es `risk:high`, hay aprobación del responsable de seguridad ✓

Merge recomendado: **Squash and merge** para mantener el historial de `main` limpio.

---

## 15. Release y rollback

### 15.1 Flujo de release automático

Cuando el PR hace merge a `main`:

1. El workflow `release.yml` detecta los archivos en `.changeset/`.
2. Si hay changesets, **crea automáticamente un PR** titulado `chore(release): version packages`.
3. Ese PR acumula todos los changesets pendientes.
4. Cuando el equipo hace merge de ese PR de release, `changeset publish` corre y publica los paquetes.

### 15.2 Rollback de emergencia

Si algo salió mal en `main`:

```bash
# Identifica el commit bueno
git log --oneline main

# Crea una rama de hotfix
git checkout -b fix/PROJ-emergency-rollback

# Revierte el commit problemático
git revert <sha-del-commit-problemático>

# Push y PR de emergencia
git push origin fix/PROJ-emergency-rollback
gh pr create --title "fix(emergency): revert PROJ-123" --fill
```

Para rollback de infraestructura o base de datos, consulta `docs/governance/ROLLBACK_POLICY.md`.

---

## 16. Automatizaciones activas — qué pasa sin que hagas nada

| Momento            | Qué pasa automáticamente                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `git commit`       | ESLint + Prettier sobre staged files. Commit se cancela si hay errores.                         |
| `git commit`       | Validación de mensaje conventional commit. Cancela si no cumple formato.                        |
| `git commit`       | Jira key de la rama se prepend al mensaje automáticamente.                                      |
| `git push`         | Typecheck global del monorepo. Push se cancela si hay errores de tipos.                         |
| PR abierto         | Labels de área aplicados según archivos modificados (`labeler.yml`).                            |
| PR abierto         | Label de riesgo aplicado (`risk:low/medium/high`) según archivos modificados (`risk-gate.yml`). |
| PR abierto         | Qodo publica análisis de código si está instalado.                                              |
| CI verde requerido | Checks `validate` y `risk` deben pasar para hacer merge (branch protection).                    |
| Merge a main       | Changesets detectados → PR de versión creado automáticamente.                                   |

---

## 17. Risk Gate — cómo se clasifica el riesgo del cambio

El workflow `risk-gate.yml` analiza automáticamente qué archivos toca tu PR y aplica uno de estos labels:

| Label         | Paths que lo disparan                                                                                                 | Implicación                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `risk:high`   | `infra/**`, `serverless.ts/yml`, `auth/**`, `security/**`, `permissions/**`, `migrations/**`, `packages/contracts/**` | Requiere revisión adicional de seguridad. Considera `@security` antes del PR. |
| `risk:medium` | `services/**`, `apps/**`, `packages/**`                                                                               | Revisión normal de PR. Al menos 1 aprobación.                                 |
| `risk:low`    | `docs/**`                                                                                                             | Cambios seguros. Merge más liviano permitido.                                 |

Si tu PR modifica tanto `docs/` como `services/`, prevalece `risk:medium`.

Para agregar o modificar rutas de riesgo, edita `.github/workflows/risk-gate.yml` sección `filters`.

---

## 18. Dev Container — entorno reproducible opcional

El Dev Container estandariza el entorno de desarrollo: misma versión de Node, Python, AWS CLI, y extensiones de VS Code para todos.

### 18.1 Cuándo usarlo

- cuando trabajas en equipo y quieres garantizar "mismo entorno para todos"
- cuando usas GitHub Codespaces (entorno en la nube, sin instalación local)
- cuando tu equipo tiene problemas de "en mi máquina funciona"

### 18.2 Cómo activarlo localmente

Prerrequisito: Docker Desktop instalado (`brew install --cask docker`).

1. Abre VS Code.
2. Instala la extensión **Dev Containers** (Microsoft).
3. Abre el Command Palette (`Cmd+Shift+P`).
4. Busca y ejecuta: **Dev Containers: Reopen in Container**.
5. VS Code reconstruye el entorno dentro del contenedor. La primera vez tarda 3-5 minutos.

### 18.3 Qué incluye el container

Configuración: `.devcontainer/devcontainer.json`.

- Node.js 22
- GitHub CLI (`gh`)
- Python 3.12
- AWS CLI
- `npm install && npx playwright install --with-deps chromium` corre automáticamente al crear el container

---

## 19. Checklist antes del primer merge

Completa esto en orden la primera vez que uses el template en un repo nuevo:

- [ ] Cuenta GitHub creada y Copilot activo
- [ ] Repositorio creado desde template (no fork)
- [ ] Herramientas instaladas: nvm, node 22, git, gh, python, uv, VS Code
- [ ] `npm install` ejecutado sin errores
- [ ] Hooks de Husky activos (`ls -la .husky/`)
- [ ] `$GH_TOKEN` disponible en el entorno (`echo $GH_TOKEN`)
- [ ] Labels de riesgo creados en GitHub (`risk:low`, `risk:medium`, `risk:high`)
- [ ] Labels de área creados en GitHub
- [ ] Branch protection activa en `main`
- [ ] Environments `dev`, `qa`, `cert` y `production` configurados en GitHub Settings → Environments
- [ ] Extensiones de VS Code instaladas (Copilot, Copilot Chat, ESLint, Prettier)
- [ ] Agentes detectados en Copilot Chat (escribe `@` y verifica dropdown)
- [ ] Prompts detectados en Copilot Chat (escribe `/` y verifica dropdown)
- [ ] `npm run bootstrap` ejecutado y `.generated/next-steps.md` leído
- [ ] `openspec/config.yaml` actualizado con `project_name` real
- [ ] `@openspec` detectado en Copilot Chat y ejecuta `openspec:validate` automáticamente
- [ ] `npm run validate` en verde
- [ ] Primera rama creada y primer feature iniciado con `@openspec`

---

## 20. FAQ — preguntas frecuentes

### ¿Por qué no puedo hacer push directo a `main`?

Branch protection está activa. Siempre debes abrir un PR. Esto garantiza que CI corra, haya revisión humana y los artefactos de spec estén presentes.

### ¿Por qué mi commit fue rechazado?

Dos razones posibles:

1. **Lint o formato**: ESLint o Prettier encontraron errores. El mensaje de error indica el archivo y línea. Corre `npm run lint -- --fix && npm run format` y vuelve a intentar.
2. **Mensaje de commit inválido**: el mensaje no sigue conventional commits. Formato correcto: `tipo(scope): descripción` donde `tipo` es `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `ci`.

### ¿Por qué mi push fue rechazado?

TypeScript encontró errores de tipos en el monorepo. El hook `pre-push` los detecta. Corre `npm run typecheck` para ver el detalle y corrige antes de volver a hacer push.

### ¿La IA crea la rama automáticamente?

Sí. El agente `@openspec` crea la rama automáticamente en el Step 1.5 del intake, usando la Jira key para derivar el nombre correcto según las convenciones del repo. Si la rama ya existe o el working directory tiene cambios sin commitear, el agente lo detecta, reporta el problema y te pide que lo resuelvas antes de continuar.

### ¿`GITHUB_TOKEN` es un secreto que debo crear?

No. GitHub lo genera automáticamente en cada workflow run. Ya está disponible como `secrets.GITHUB_TOKEN` sin configuración. No aparece en la lista de secrets del repo porque no es un secret que tú creaste — es inyectado por GitHub directamente.

### ¿Qué es Turborepo y por qué existe?

Turborepo es el orquestador del monorepo. Cuando corres `npm run validate`, en lugar de ejecutar lint/test/build workspace por workspace en secuencia, Turborepo los ejecuta en paralelo donde puede y cachea resultados. Si `services/api` no cambió desde el último run, Turborepo no re-corre sus tests — usa el cache.

### ¿Un changeset es obligatorio en cada PR?

No. Solo cuando el PR afecta paquetes publicables y quieres trazabilidad de versión. Cambios de docs, config, tooling, o features internas generalmente no necesitan changeset.

### ¿Qué pasa si OpenSpec validate falla?

Significa que hay un spec incompleto o mal formado en `openspec/changes/`. Abre el archivo indicado en el error y completa las secciones faltantes. No avances a implementación hasta que valide.

### ¿Puedo saltar el @openspec intake y ir directo a implementar?

Técnicamente sí, pero no es el flujo recomendado. El intake y spec generan los artefactos de trazabilidad (proposal/design/tasks) que el resto de agentes usan como contexto. Sin ellos, la calidad del output de `@backend-implementer` baja considerablemente porque no tiene el "por qué" ni los criterios de aceptación del feature.

### ¿Cómo sé cuándo cortar la sesión de Copilot Chat?

Señales de que la sesión está degradada:

- el modelo repite razonamiento que ya resolvió antes
- olvida instrucciones que le diste 10 turnos atrás
- genera código que contradice código que generó antes en la misma tarea
- necesitas más de 2 correcciones sobre el mismo punto

Cuando veas cualquiera de estas señales: `/handoff` → nueva sesión → `/resume-phase`.

---

## 21. Errores de CI frecuentes — qué significan y cómo resolverlos

Esta sección explica los checks de CI que pueden fallar y qué hacer en cada caso.
No necesitas leer los estándares técnicos completos — los agentes los aplican por ti.
Esta sección es para cuando CI falla y quieres entender por qué.

### CI validate falla (`npm run validate`)

El workflow `ci.yml` corre lint, format, typecheck, tests, coverage y OpenSpec validate.
El output del check indica exactamente qué paso falló y en qué archivo.

| Error en el output            | Causa                                          | Solución rápida                                                             |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `ESLint: X problems`          | Código con lint errors                         | `npm run lint -- --fix`                                                     |
| `Prettier: Code style issues` | Formato incorrecto                             | `npm run format`                                                            |
| `TS error: ...`               | Error de tipos TypeScript                      | Corrige el tipo. Nunca uses `any` para tapar el error.                      |
| `Test failed: X`              | Test roto                                      | Lee el test — puede ser que el comportamiento cambió y el test es correcto. |
| `Coverage below threshold`    | Cobertura de tests insuficiente                | Agrega tests para el código nuevo.                                          |
| `openspec:validate failed`    | Spec incompleto o vacío en `openspec/changes/` | Abre el archivo indicado y completa las secciones.                          |

### Lighthouse CI falla (performance / accesibilidad)

El workflow `lighthouse.yml` corre en cada PR que toca `apps/web/**`.
Mide Core Web Vitals y accesibilidad. Algunos umbrales bloquean el merge (error),
otros son advertencias (warn).

**Los que bloquean merge:**

| Métrica                        | Umbral    | Cómo diagnosticar                                                                                                               |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility score            | < 90      | Abre el reporte en el artefacto `lighthouse-report`. La pestaña Accessibility lista cada violación con el elemento HTML exacto. |
| Largest Contentful Paint (LCP) | > 2500 ms | Suele ser una imagen sin `loading="lazy"` o sin dimensiones fijas.                                                              |
| Total Blocking Time (TBD)      | > 300 ms  | JavaScript ejecutándose en el hilo principal. Revisa imports pesados en la ruta crítica.                                        |
| Cumulative Layout Shift (CLS)  | > 0.1     | Elementos que cambian de posición al cargar. Añade dimensiones explícitas a imágenes y skeletons.                               |

**Cómo ver el reporte completo:**

1. En el PR, haz clic en **Details** del check `lighthouse`.
2. Baja a la sección **Artifacts** y descarga `lighthouse-report`.
3. Abre el `.html` para el reporte visual interactivo.

**Cómo correr Lighthouse localmente antes de abrir PR:**

```bash
npm run build --workspace=apps/web
npx @lhci/cli autorun
```

El reporte queda en `.lighthouseci/`. Abre el `.html` en el navegador.

**Si el umbral es demasiado restrictivo para el estado actual del proyecto:**

No lo relajes sin acuerdo del equipo. Primero pregunta en chat a `@frontend-implementer`
qué está causando la regresión — puede haber una solución en el código sin tocar el umbral.

### Risk gate aplica `risk:high` a mi PR

El workflow `risk-gate.yml` analiza qué archivos tocaste. Si toca `serverless.ts`,
`auth/**`, `packages/contracts/**`, o `infra/**`, aplica `risk:high` automáticamente.

Qué hacer:

1. Pide revisión de `@security` antes de solicitar aprobación humana.
2. Si el cambio es realmente de bajo riesgo pero toca esos paths (ej: solo actualizas un timeout), docúmentalo en la descripción del PR.
3. No omitas el label — solo cambia los paths en `.github/workflows/risk-gate.yml` si hay un acuerdo de equipo de que esa ruta dejó de ser de alto riesgo.

### ¿Por qué los agentes aplican estándares que no conozco?

Los agentes leen automáticamente los documentos en `docs/standards/` antes de implementar.
No necesitas conocerlos de memoria. Pero si CI falla con un error que no entiendes
o quieres saber por qué el agente tomó una decisión, estos son los documentos de referencia:

| Estándar                                      | Cuándo consultarlo                                      |
| --------------------------------------------- | ------------------------------------------------------- |
| `docs/standards/aws-architecture.md`          | Idempotencia, DLQ, connection reuse, diseño Lambda      |
| `docs/standards/aws-security.md`              | Domain errors, OWASP, IAM, encriptación                 |
| `docs/standards/aws-logging-observability.md` | Powertools Logger/Tracer/Metrics, Datadog               |
| `docs/standards/serverless-v4.md`             | Config de serverless.ts, Datadog plugin, API versioning |
| `docs/standards/feature-flags.md`             | Cuándo y cómo usar feature flags, kill switches         |
| `docs/standards/frontend-storybook.md`        | Componentes, a11y, Lighthouse budgets, React patterns   |
| `docs/standards/contracts.md`                 | OpenAPI, GraphQL, breaking vs additive changes          |
| `docs/governance/RISK_MATRIX.md`              | Clasificación de riesgo por tipo de cambio              |
