# ⚡ Quick Reference — SDD AI Template

**Print this page or bookmark it.** All commands, agents, and common tasks in one place.

---

## 🚀 First-Time Setup

```bash
nvm use                    # Activate Node 22
npm install                # Install dependencies + git hooks
npm run bootstrap          # Initialize template (profiles, configs)
npm run validate           # Validate workspace quality gates
```

**Stuck?** → See `docs/onboarding/TROUBLESHOOTING.md`

---

## 📚 Core Commands (npm)

| Goal                       | Command                                                                    | Notes                                                                            |
| -------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Validate everything**    | `npm run validate`                                                         | Runs: lint, typecheck, test, coverage, spellcheck, md-lint, yaml-lint, contracts |
| **Fix code issues**        | `npm run format`                                                           | Auto-fixes lint + prettier issues                                                |
| **Run type checking**      | `npm run typecheck`                                                        | Check TypeScript across monorepo                                                 |
| **Run tests**              | `npm run test`                                                             | Unit tests only                                                                  |
| **Coverage report**        | `npm run coverage`                                                         | Shows `%` of code tested                                                         |
| **Test single file**       | `npm run test -- src/foo.test.ts`                                          | Filter by filepath                                                               |
| **Watch mode**             | `npm run test -- --watch`                                                  | Re-run on file changes                                                           |
| **Check REST contract**    | `npx @redocly/cli lint packages/contracts/rest/openapi.yaml`               | OpenAPI validation                                                               |
| **Check GraphQL contract** | `npx graphql-inspector validate 'packages/contracts/graphql/**/*.graphql'` | GraphQL schema validation                                                        |
| **OpenSpec validation**    | `npm run openspec:validate`                                                | Validate OpenSpec artifacts                                                      |

---

## 🤖 AI Agents (in VS Code Chat)

### Agentes disponibles (10 en total)

> Todos se invocan escribiendo `@nombre` en Copilot Chat. El punto de entrada siempre es `@openspec`.

| Agente                         | Qué hace                                               | Cuándo usarlo                                           |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| **@openspec**                  | Genera proposal, design y tasks en `openspec/changes/` | Siempre al iniciar un feature. Primer paso obligatorio. |
| **@contracts-implementer**     | Actualiza OpenAPI/GraphQL. Va antes que el backend.    | Cuando el feature agrega o modifica endpoints           |
| **@backend-implementer**       | Handlers, use cases, validación, logs (serverless/AWS) | Cuando tasks.md tiene tareas de backend                 |
| **@frontend-implementer**      | Componentes React, Storybook, FSD layers               | Cuando tasks.md tiene tareas de frontend                |
| **@observability-implementer** | Logs estructurados, tracing (X-Ray/Datadog), métricas  | Cuando tasks.md tiene tareas de observabilidad          |
| **@tester-backend**            | Tests unitarios e integración (vitest)                 | Después de `@backend-implementer`                       |
| **@tester-frontend**           | Tests de componentes (Vitest + Testing Library)        | Después de `@frontend-implementer`                      |
| **@e2e-tester**                | Tests de user journeys (Playwright)                    | Después de frontend, si el perfil tiene playwright      |
| **@security**                  | Revisión adversarial: auth, PII, IAM, OWASP            | Solo si risk=high en el spec                            |
| **@reviewer**                  | Revisa todo vs el spec, genera PR body                 | Siempre antes de abrir el PR                            |
| **@pr-comment-resolver**       | Clasifica y resuelve comentarios de revisores          | Solo cuando hay feedback en el PR                       |

### ¿Qué agente uso?

```text
¿Es trivial? (1 archivo, <1 hora, no toca contratos ni seguridad)
  → SÍ → @openspec (intake rápido) → @backend-implementer o @frontend-implementer → @reviewer
  → NO → Empieza siempre con @openspec

¿Qué perfil tienes? (ver .generated/active-profile.yaml)
  backend-only  → @openspec → [@contracts-implementer] → @backend-implementer → [@observability-implementer] → @tester-backend → [@security] → @reviewer
  frontend-only → @openspec → @frontend-implementer → @tester-frontend → [@e2e-tester] → @reviewer
  fullstack     → @openspec → @contracts-implementer → @backend-implementer → @frontend-implementer
                           → @observability-implementer → @tester-backend → @tester-frontend
                           → [@e2e-tester] → [@security] → @reviewer

Los corchetes [ ] indican pasos condicionales según el spec.
```

### Flujo de ejemplo completo (fullstack)

Cada número es una sesión de chat separada. Cierra y abre chat entre cada una.

```text
SESIÓN 1 — Spec
  Escribe: "@openspec Ticket: PROJ-123. Necesito endpoint GET /orders/{id}.
           AC: 200 con la orden, 404 si no existe, 401 si no autenticado."
  El agente genera proposal.md, design.md y tasks.md.
  Al terminar: "/handoff" → cierra el chat.

SESIÓN 2 — Contratos
  Abre chat nuevo. Escribe: "/resume-phase"
  Luego: "@contracts-implementer actualiza el contrato según design.md"
  Al terminar: "/handoff" → cierra el chat.

SESIÓN 3 — Backend
  Abre chat nuevo. Escribe: "/resume-phase"
  Luego: "@backend-implementer implementa el stream de backend según tasks.md"
  Al terminar: "/handoff" → cierra el chat.

SESIÓN 4 — Frontend (si aplica)
  Abre chat nuevo. Escribe: "/resume-phase"
  Luego: "@frontend-implementer implementa el stream de frontend según tasks.md"
  Al terminar: "/handoff" → cierra el chat.

SESIÓN 5 — Tests backend
  Abre chat nuevo. Escribe: "/resume-phase"
  Luego: "@tester-backend agrega tests para el stream de backend"
  Al terminar: "/handoff" → cierra el chat.

SESIÓN 6 — Tests frontend (si aplica)
  Abre chat nuevo. Escribe: "/resume-phase"
  Luego: "@tester-frontend agrega tests para los componentes implementados"
  Al terminar: "/handoff" → cierra el chat.

SESIÓN 7 — Review
  Abre chat nuevo. Escribe: "/resume-phase"
  Luego: "/review-pr"
  El reviewer genera el PR body. Abre el PR en GitHub.
```

---

## 🔗 Special Prompts (Type / in Chat)

| Prompt              | What It Does                              | Example                                          |
| ------------------- | ----------------------------------------- | ------------------------------------------------ |
| **/jira-to-change** | Convert Jira ticket → OpenSpec change     | `/jira-to-change JIRA-123`                       |
| **/route-feature**  | Route feature to correct agent            | `/route-feature This is fullstack`               |
| **/handoff**        | Save phase progress, generate handoff doc | `/handoff` (type when phase complete)            |
| **/resume-phase**   | Load previous handoff, continue work      | `/resume-phase` (type when starting new session) |

---

## 📂 Project Structure

```text
sdd-ai-template/
├── docs/                      # All documentation
│   ├── onboarding/           # Step-by-step setup guides (11 docs)
│   ├── runbooks/             # How-to guides (16 docs)
│   ├── standards/            # Technical standards (contracts, logging, etc.)
│   └── governance/           # Risk matrix, rollback policy
├── .github/
│   ├── agents/               # 11 specialized AI agents
│   ├── skills/               # 59 domain knowledge guides
│   ├── prompts/              # Reusable prompts (/handoff, /resume-phase, etc.)
│   ├── instructions/         # Path-specific instructions (backend, frontend, testing, etc.)
│   └── workflows/            # 13 GitHub Actions
├── apps/
│   └── web/                  # Frontend (React)
├── services/
│   └── api/                  # Backend (Node.js + Lambda)
├── packages/
│   ├── contracts/            # OpenAPI + GraphQL specs
│   ├── config/               # Shared config
│   └── shared/               # Shared UI components, utils
├── openspec/
│   ├── changes/              # Your feature specs & handoffs
│   ├── specs/                # Completed specs (archive)
│   └── templates/            # Handoff template
├── scripts/                  # Utility scripts
└── .nvmrc                    # Node version (22)
```

---

## 🔧 Git Workflow

```bash
# 1. @openspec creates the branch automatically during intake.
#    If you need to create it manually:
git checkout -b feat/JIRA-123-my-feature

# 2. Make changes
# [edit files...]

# 3. Stage & commit
git add .
git commit -m "add user login"  # Hook auto-adds JIRA-123 if in branch name

# 4. Pre-commit hook runs:
#    → ESLint + Prettier on staged files
#    → Blocks if violations

# 5. Push
git push origin feat/my-feature

# 6. Pre-push hook runs:
#    → TypeScript check across monorepo
#    → Blocks if types broken

# 7. Open PR (use template: .github/pull_request_template.md)

# 8. Close PR (requires CI green + approval)
#    → Auto-runs 13 GitHub Actions workflows
```

---

## 🐛 Troubleshooting (Super Quick)

| Problem                           | Fix                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **`nvm: command not found`**      | Install nvm: Run `brew install nvm` (macOS) or see docs/onboarding/00_PREREQUISITES.md                            |
| **Node version mismatch**         | Run `nvm use`                                                                                                     |
| **`npm: command not found`**      | Node not installed or not in PATH. Run `nvm install 22 && nvm use`                                                |
| **`npm install` fails**           | Network issue or dependency conflict. Try: `npm install --legacy-peer-deps`                                       |
| **`npm run validate` fails**      | Dependencies not installed. Run `npm install` first                                                               |
| **Lint errors**                   | Run `npm run format` to auto-fix                                                                                  |
| **Type errors**                   | Run `npm run typecheck` to see details. Fix type mismatches                                                       |
| **Test failures**                 | Run `npm run test -- --reporter=verbose` to see details                                                           |
| **Pre-commit hook blocks commit** | Fix lint issues: `npm run format`, then re-add & commit                                                           |
| **Pre-push hook blocks push**     | Fix types: `npm run typecheck`, commit fix, try push again                                                        |
| **Copilot can't find agents**     | Restart VS Code. Check: Settings → Extensions → GitHub Copilot. Verify MCP tokens set                             |
| **@agent not suggesting code**    | Check `.github/agents/{agent-name}.agent.md` exists. Verify path-specific instructions in `.github/instructions/` |
| **Unsure what doc to read**       | `docs/DOC_INDEX.md`                                                                                               |

---

## 📊 Monitoring & Metrics

Track your productivity:

| Metric                 | Target             | How to Check                               |
| ---------------------- | ------------------ | ------------------------------------------ |
| **First feature time** | < 2 days           | Track calendar days from clone → PR merged |
| **Test coverage**      | >= 80%             | `npm run coverage`                         |
| **CI pass rate**       | >= 95%             | GitHub Actions tab in PR                   |
| **Code review time**   | < 4 hours          | PR comments                                |
| **Time per phase**     | Demo → target time | Use `/handoff` which logs times            |

---

## 🎓 Learning Path

**Day 1:** Read this file  
**Day 1-2:** Read `docs/onboarding/05_AI_SDLC_ONE_DOC_PLAYBOOK.md`  
**Day 2:** Implement first feature following `docs/runbooks/FIRST_FEATURE_RUNBOOK.md`  
**Week 1:** Read `AGENTS.md` and `docs/runbooks/HOW_TO_USE_VSCODE_COPILOT.md`  
**Week 1-2:** Explore `docs/runbooks/` for your stack (backend, frontend, etc.)  
**Month 1:** Reference `docs/onboarding/MONTH_1_ROADMAP.md`

---

## 🆘 Still Stuck?

| Question                              | Answer                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| **Where do I start?**                 | `docs/onboarding/05_AI_SDLC_ONE_DOC_PLAYBOOK.md`                      |
| **How do I debug Copilot issues?**    | `docs/runbooks/HOW_TO_USE_VSCODE_COPILOT.md` → "Debugging" section    |
| **What if an agent makes a mistake?** | `docs/runbooks/HOW_TO_USE_VSCODE_COPILOT.md` → "Agent Error Recovery" |
| **How do sessions & handoffs work?**  | `docs/runbooks/SESSION_MANAGEMENT.md`                                 |
| **What's the risk matrix?**           | `docs/governance/RISK_MATRIX.md`                                      |
| **How does Agent OS work?**           | `docs/runbooks/HOW_TO_USE_AGENT_OS.md`                                |
| **CI/CD failing?**                    | `.github/workflows/` + `docs/onboarding/TROUBLESHOOTING.md`           |

---

## 📞 Contact / Escalation

- **Questions about your code:** Post in Slack #dev-help
- **Bugs in template:** File GitHub issue with label `type/template`
- **AI agent failing:** See `docs/onboarding/TROUBLESHOOTING.md` → AI Agent Errors, or ask @reviewer
- **Security concern:** Email security@ (see CONTRIBUTING.md)

---

**Version:** v3 (April 2026)  
**Last Updated:** [DATE]  
**Maintained By:** Engineering team

💡 **Pro Tip:** Bookmark or print this file. It's your fastest reference.
