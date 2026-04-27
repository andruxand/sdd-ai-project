```skill
---
name: openspec-proposal
description: Create or refine OpenSpec proposal, design, and tasks.
---

## Context
Templates: `openspec/templates/proposal.md`, `openspec/templates/design.md`, `openspec/templates/tasks.md`.
Config: `openspec/config.yaml` (defines rules and required fields).
Output: `openspec/changes/<change-id>/`.

## Proposal creation flow
1. Receive Jira ticket or requirement.
2. Extract: business goal, user problem, desired outcome.
3. Define scope: in and out.
4. Classify impact on: backend, frontend, REST, GraphQL, design system, observability, security, infra.
5. Identify risks: functional, security, contract, operational.
6. Define rollback: kill switch, revert path, data implications.

## Minimum required fields (from config.yaml)
- Jira key and business goal.
- Risks, dependencies, and open questions.
- Rollback considerations.

## Design creation flow (after proposal is approved)
1. Describe contracts (API shapes, types).
2. Define boundaries (which services/packages are affected).
3. Specify logging, tracing, and metrics plan.
4. Identify retry and error handling strategy.
5. Document security implications.

## Task creation flow (after design)
1. Break into small, independently verifiable task groups.
2. Each task group must include: implementation, tests, docs updates.
3. Include contract updates when behavior changes.
4. Tag task groups with recommended agent (backend-implementer, frontend-implementer, etc.).

## Quality rules
- Do NOT invent business rules — ask when unclear.
- Do NOT skip risk assessment.
- Do NOT create tasks without acceptance criteria.
- Every proposal must have a rollback section.

## Checklist
- [ ] Proposal has all required fields from config.yaml.
- [ ] Risks identified with rationale.
- [ ] Rollback defined.
- [ ] Tasks are small and independently testable.
- [ ] Each task references the correct agent for execution.
```
