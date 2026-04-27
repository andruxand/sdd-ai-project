# Contributing

## Prerequisites

See [docs/onboarding/00_PREREQUISITES.md](docs/onboarding/00_PREREQUISITES.md).

## Getting started

```bash
nvm use                    # use pinned Node.js version from .nvmrc
npm install                # install deps + sets up git hooks (husky)
npm run bootstrap          # interactive project setup
npm run validate           # full quality check (via Turborepo)
```

## Branch naming

```text
<type>/<JIRA-KEY>-<short-desc>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.

Examples: `feat/PROJ-42-order-checkout`, `fix/PROJ-99-payment-timeout`, `docs/observability-runbook`.

> **Tip:** If your branch includes a Jira key (e.g. `feat/PROJ-42-checkout`), the `prepare-commit-msg` hook will auto-prepend `[PROJ-42]` to every commit message.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>
```

Enforced by `commitlint` via a Husky commit-msg hook.

## Development workflow

1. Start a new feature by invoking `@openspec` in Copilot Chat — it creates the branch automatically (following the naming convention above). If you need to create the branch manually, use `git checkout -b tipo/JIRA-KEY-descripcion-corta`.
2. Run `npm run validate` before pushing (or rely on git hooks — see below).
3. If your change affects a published package, run `npx changeset` to create a changeset file describing the change.
4. Open a PR using the PR template.
5. Address review comments.
6. Ensure CI passes.
7. Merge strategy depends on branch (see [docs/standards/git-branching.md](docs/standards/git-branching.md) §2):
   - Feature/fix/chore branches → **squash merge** into `develop`
   - Promotion PRs (`develop → qa`, `qa → cert`, `cert → main`) → **merge commit** (no squash — preserves attribution)
   - Hotfix branches → **squash merge** into `main`, then mandatory backport to `develop`

## Git hooks (automatic)

These run automatically — no manual setup beyond `npm install`:

| Hook                   | What it does                                         | When         |
| ---------------------- | ---------------------------------------------------- | ------------ |
| **pre-commit**         | Runs ESLint + Prettier on staged files (lint-staged) | Every commit |
| **commit-msg**         | Validates conventional commit format (commitlint)    | Every commit |
| **prepare-commit-msg** | Auto-prepends Jira key from branch name              | Every commit |
| **pre-push**           | Runs `npm run typecheck` across all workspaces       | Every push   |

If a hook blocks you, fix the issue it reports. Do **not** skip hooks with `--no-verify` unless you have a valid reason.

## AI-assisted workflow (SDD)

Each phase runs in its own Copilot Chat session. Generate a `/handoff` at the end of each phase and use `/resume-phase` to start the next one.

1. `@openspec` — generates proposal, design, and tasks in `openspec/changes/`. Always the entry point.
2. `@contracts-implementer` — updates OpenAPI/GraphQL before or alongside the backend (if the feature touches an API endpoint).
3. `@backend-implementer` — implements handlers, use cases, input validation, structured logs.
4. `@frontend-implementer` — implements React components, Storybook stories (if the feature has UI).
5. `@observability-implementer` — adds traces, metrics, and log instrumentation (if tasks.md includes observability tasks).
6. `@tester-backend` — adds unit and integration tests for the backend stream.
7. `@tester-frontend` — adds component tests (if the feature has a frontend stream).
8. `@e2e-tester` — adds Playwright end-to-end tests for critical user journeys (if the profile includes playwright).
9. `@security` — adversarial review: auth, PII, IAM, OWASP (only if risk=high in the spec).
10. `@reviewer` — final review against the spec, generates PR body.
11. `@pr-comment-resolver` — classifies and resolves PR reviewer comments (only if there is feedback).

See [AGENTS.md](../AGENTS.md) for the full flow per project type (backend-only, frontend-only, fullstack).
See [docs/onboarding/05_AI_SDLC_ONE_DOC_PLAYBOOK.md](docs/onboarding/05_AI_SDLC_ONE_DOC_PLAYBOOK.md) for a complete step-by-step walkthrough.

## Development scripts

```bash
# Start local development (both API + web in parallel)
npm run dev

# Or independently:
npm run dev:api     # serverless-offline → localhost:3000
npm run dev:web     # Vite dev server    → localhost:5173

# Build all workspaces
npm run build

# Run tests in watch mode (in the relevant workspace directory)
npm run test:watch
npm run test:ui     # Vitest with graphical UI

# Run E2E tests with visual debug
npm run test:e2e:ui

# Generate TypeScript types from OpenAPI spec (in packages/contracts)
npm run generate:types
```

## Quality gates

All gates run via `npm run validate` (orchestrated by Turborepo for parallel execution and caching).

| Gate              | Command                               | CI  | Local hook                |
| ----------------- | ------------------------------------- | --- | ------------------------- |
| Lint              | `npm run lint`                        | ✅  | pre-commit (staged files) |
| Format            | `npm run format:check`                | ✅  | pre-commit (staged files) |
| Types             | `npm run typecheck`                   | ✅  | pre-push                  |
| Coverage          | `npm run coverage`                    | ✅  | —                         |
| Spelling          | `npm run spellcheck`                  | ✅  | —                         |
| Markdown          | `npm run md:lint`                     | ✅  | —                         |
| YAML              | `npm run yaml:lint`                   | ✅  | —                         |
| OpenSpec          | `npm run openspec:validate`           | ✅  | —                         |
| Contracts REST    | `npm run lint:openapi` (in contracts) | ✅  | —                         |
| Contracts GraphQL | `npm run lint:graphql` (in contracts) | ✅  | —                         |

> **Note:** `npm run test` also works and runs the same suite. `npm run coverage`
> is what CI uses as it includes the threshold check.

## Standards

All standards are documented in `docs/standards/`. Read and follow them.
