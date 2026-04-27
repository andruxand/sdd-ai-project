@.github/copilot-instructions.md
@AGENTS.md

# Claude Code specific

## Build & validation

- Node.js version: see `.nvmrc` (currently 22). Always run `nvm use` before any command.
- Install: `npm install` (also sets up git hooks via husky)
- Validate all: `npm run validate` (runs lint, format check, md lint, yaml lint, spellcheck, typecheck, coverage via Turborepo)
- Lint: `npm run lint` (ESLint with import ordering, unused imports, react-hooks rules)
- Typecheck: `npm run typecheck` (via Turborepo across all workspaces)
- Test: `npm run test` / `npm run coverage`
- OpenSpec: `npm run openspec:validate`
- Contracts REST: `npx @redocly/cli lint packages/contracts/rest/openapi.yaml`
- Contracts GraphQL: `npx graphql-inspector validate 'packages/contracts/graphql/**/*.graphql'`
- Monorepo orchestration: Turborepo (`turbo.json`) — tasks are cached per workspace

## Git hooks (automated quality gates)

- pre-commit: lint-staged (ESLint + Prettier on staged files)
- commit-msg: commitlint (conventional commits)
- prepare-commit-msg: auto-prepends Jira key from branch name
- pre-push: runs typecheck across all workspaces

## Session management

- Use `/compact Focus on modified files, test results, and open decisions` when context grows
- Use `/clear` between unrelated tasks
- Name sessions with `/rename` using the pattern: `{change-id}-{phase}` (e.g., `PROJ-123-implementation`)
- Resume with `claude --resume` to continue a named session
- Generate a handoff document at the end of each phase: `openspec/changes/{change-id}/handoff.md`
- Use the handoff template: `openspec/templates/handoff.md`

## Model selection

- Use Sonnet for implementation, testing, and PR prep
- Use Opus for architectural design, security review, and complex debugging
- Use Haiku for simple subagent tasks like file search or linting

## Context preservation

- Delegate file-heavy investigation to subagents
- After compaction, re-read the handoff file if one exists for the current change
- Do not carry test logs, error traces, or discarded alternatives beyond the current task
