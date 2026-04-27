# Template Final Audit Report

> **Superseded — April 2026.**
> This report reflects the audit state at v3.3. All findings listed here were
> subsequently resolved. The template has since been upgraded with comprehensive
> agent tooling, standards, and CI coverage. Refer to the git log from commit
> `7fd8d3f` onward for the full change history.

## What was corrected in v3.3

1. Added TypeScript-aware ESLint configuration via `typescript-eslint`.
2. Added `@vitest/coverage-v8`.
3. Added minimal Vitest smoke tests for `apps/web` and `services/api`.
4. Added explicit Vitest config files to keep the baseline deterministic.

## What remains intentionally project-specific

- OpenAPI generation
- GraphQL schema generation
- oasdiff / GraphQL Inspector wiring
- CloudFormation Guard rules
- cfn-lint target templates
- GitHub Apps like Qodo
- protected branches, required checks, environments, secrets, and Jira integration

## What was improved in v3.4

- explicit routing map in AGENTS.md
- specialized implementer/tester agents
- feature-orchestrator as a routing agent
- pr-comment-resolver for review feedback
- existing docs updated instead of creating redundant new docs

## What was corrected in v3.5

- aligned the first-feature runbooks with specialized routing
- made `/route-feature` explicit in the practical flow
- clarified that `implementer` and `tester` are fallback agents, not the preferred default for complex work

## What was improved in v3.6

- clarified that strong requirement context is provided once at intake, not repeated on every OpenSpec command
- clarified the minimum information required to start
- made planner and jira-to-change explicitly guided: they must ask for missing minimum information instead of inventing it
- updated existing docs rather than adding redundant new files
