# 01. Install Tools Step by Step

## 1. Git

Verifica:

```bash
git --version
```

Resultado esperado:

- aparece una versión, por ejemplo `git version ...`

## 2. nvm (Node Version Manager)

nvm te permite tener múltiples versiones de Node y cambiar entre ellas. El repo tiene un archivo `.nvmrc` que indica qué versión usar.

### Instalar nvm (si no lo tienes)

```bash
# macOS / Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
```

Cierra y vuelve a abrir la terminal después de instalar.

### Verificar

```bash
nvm --version
```

Alternativa: si prefieres `fnm` (Fast Node Manager), funciona igual. Lo importante es que puedas hacer `nvm use` o `fnm use` en el repo.

## 3. Node.js y npm

El repo requiere Node.js 22.x. Instálalo con nvm:

```bash
nvm install 22
nvm use 22
```

Verifica:

```bash
node -v
npm -v
```

Resultado esperado:

- `node` responde con una versión 22.x (por ejemplo `v22.15.0`)
- `npm` responde con una versión válida

> **Importante**: cuando entres al repo por primera vez, ejecuta `nvm use` en la raíz. nvm leerá `.nvmrc` y usará la versión correcta automáticamente. Si ves un error de "engines" al hacer `npm install`, es porque no estás usando Node 22.

## 4. VS Code

Abre VS Code y confirma que puedes abrir la carpeta del proyecto.

## 5. GitHub Copilot

En VS Code:

- inicia sesión en GitHub
- confirma que Copilot Chat está disponible
- confirma que puedes abrir el panel de chat

## 6. Variable de entorno GH_TOKEN

El MCP de GitHub (que conecta Copilot con la API de GitHub) necesita un Personal Access Token (PAT).

### Crear el token

1. Ve a https://github.com/settings/tokens?type=beta
2. Click "Generate new token"
3. Dale nombre descriptivo (ej: "sdd-template-mcp")
4. Selecciona el repo o repos que usarás
5. Permisos mínimos: `contents: read`, `pull_requests: read/write`, `issues: read/write`
6. Genera y copia el token

### Configurar en tu sistema

**macOS / Linux** — agrega a `~/.zshrc` (o `~/.bashrc`):

```bash
export GH_TOKEN="ghp_tu_token_aqui"
```

Luego recarga:

```bash
source ~/.zshrc
```

**Windows** — agrega como variable de entorno del sistema:

```powershell
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_tu_token_aqui', 'User')
```

### Verificar

```bash
echo $GH_TOKEN
```

Debe mostrar tu token (no vacío).

> **NUNCA** pegues tu token en archivos del repo como `settings.json`, `mcp.json`, o `.env`. El repo está configurado para leerlo desde la variable de entorno del sistema.

## 7. OpenSpec CLI

Instala:

```bash
npm install -g @fission-ai/openspec@latest
```

Verifica:

```bash
openspec --help
```

## 8. AWS CLI

Verifica:

```bash
aws --version
```

Si usarás AWS:

```bash
aws configure
```

## 9. Serverless Framework v4

Instala según el estándar del equipo. Verifica que `serverless` o `sls` responda.

## 10. uv / uvx (solo para MCP AWS docs)

Verifica:

```bash
uv --version
uvx --help
```

## 11. Herramientas de contratos (si aplica)

Si el proyecto usa contratos REST o GraphQL, instala las herramientas de validación.

### REST (OpenAPI)

```bash
# Redocly CLI — lint y bundle de OpenAPI
npm install -g @redocly/cli

# oasdiff — detección de breaking changes
brew install oasdiff
# o descarga desde https://github.com/Tufin/oasdiff/releases
```

Verifica:

```bash
redocly --version
oasdiff --version
```

### GraphQL

```bash
# graphql-inspector — validación y diff de schemas
npm install -g @graphql-inspector/cli
```

Verifica:

```bash
graphql-inspector --help
```

> **Nota**: si no sabes si tu proyecto usa contratos, no instales aún. El bootstrap (paso 04) te preguntará y podrás instalar después.

## 12. VS Code extensiones recomendadas

Al abrir el repo en VS Code, te pedirá instalar las extensiones recomendadas. Acepta.

Si no te lo pide, abre la paleta de comandos (`Cmd+Shift+P`) y busca "Extensions: Show Recommended Extensions".

Las extensiones clave son:

- GitHub Copilot + Copilot Chat
- ESLint
- Prettier
- EditorConfig (lee `.editorconfig` automáticamente)
- Markdownlint
- YAML
- Playwright Test for VS Code
- Code Spell Checker
- Vitest Explorer

## 13. Confirmación final

Debes poder correr:

```bash
git --version
node -v        # debe ser 22.x
npm -v
echo $GH_TOKEN # debe mostrar tu token
openspec --help
```

Si activaste contratos:

```bash
redocly --version          # REST
oasdiff --version          # REST
graphql-inspector --help   # GraphQL
```
