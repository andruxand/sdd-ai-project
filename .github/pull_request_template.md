## Jira / Ticket

- Key:
- URL:
- Agent that handled this issue: `@[agent-name]` (e.g., @backend-implementer, @openspec)

## OpenSpec

- Change ID:
- Proposal:
- Design:
- Tasks:

## Summary

<!-- 1-2 sentences: What does this PR accomplish? -->

## Scope

<!-- List the main changes. Keep focused—if scope is large, split into multiple PRs. -->

## Contract impact

- [ ] None
- [ ] REST
- [ ] GraphQL
- [ ] Both

## AI Workflow

- [ ] Handoff generated on phase transition (spec→impl, impl→test, etc.)
- [ ] Handoff file: `openspec/changes/{change-id}/handoff.md`
- [ ] If handoff generated, include link in this PR or comment

## Risk

- [ ] Low
- [ ] Medium
- [ ] High

## Security / sensitive areas

- [ ] PII/secrets audit: No PII, API keys, tokens in code or logs
- [ ] Logs sanitized: Checked for structured logging, no sensitive data
- [ ] Auth/permissions reviewed: Any auth changes documented
- [ ] Error handling reviewed: No unhandled exceptions, graceful failures
- [ ] WAF/IAM/API Gateway implications reviewed if applicable
- [ ] Breaking changes documented (if any)

## Quality

- [ ] Docs updated (README, specs, runbooks if behavior changed)
- [ ] Storybook updated if shared UI changed
- [ ] Tests added/updated: coverage >= 80%
- [ ] Rollback defined: Can this PR be safely reverted?
- [ ] No `test.only` or `describe.only` in committed code
- [ ] All imports correctly sorted (ESLint plugin: import-x)

## Validation

- [ ] lint: `npm run lint` passes
- [ ] typecheck: `npm run typecheck` passes
- [ ] unit: `npm run test` passes
- [ ] integration tests pass (if applicable)
- [ ] e2e tests pass (if applicable)
- [ ] contracts validated (REST/GraphQL if applicable)
- [ ] security checks passed (secrets scanning, dependency audit)

## Rollout / Rollback

<!-- Deployment strategy & recovery plan -->

- Deployment method: [ ] Direct merge | [ ] Staged rollout | [ ] Feature flag
- Rollback: Can be reverted by: [ ] Direct revert | [ ] Hotfix | [ ] Data migration required
- Estimated impact: [ ] Low (~1 min) | [ ] Medium (~5 min) | [ ] High (>5 min)

## Evidence

<!-- Screenshots, test results, logs proving this works -->
