```skill
---
name: pr-prep
description: Prepare PR summary, checklist, evidence, and follow-up actions.
---

## PR template
Use `.github/pull_request_template.md` as the base.

## Sections to complete

### Jira + OpenSpec
- Jira key and URL.
- OpenSpec change ID, proposal, design, and tasks references.

### Summary
- What changed and why (1-3 sentences).
- Business context for reviewers.

### Scope
- Files/packages affected.
- What is NOT included (explicit out-of-scope).

### Contract impact
- None / REST / GraphQL / Both.
- If breaking: migration plan documented.

### Risk
- Low / Medium / High with rationale.
- After PR creation, apply the corresponding GitHub label: `risk:low`, `risk:medium`, or `risk:high`.
  - Create missing labels if needed: `gh label create "risk:low" --color "#0E8A16"`, `gh label create "risk:medium" --color "#E4A000"`, `gh label create "risk:high" --color "#B60205"`.
  - Apply with: `gh pr edit <PR-number> --add-label "risk:<level>"`.

### Security / sensitive areas
- Logs sanitized.
- Auth/permissions reviewed.
- No secrets exposed.
- Error handling reviewed.
- WAF/IAM/API Gateway implications if applicable.

### Quality
- Docs updated.
- Storybook updated if shared UI changed.
- Tests added/updated.
- Rollback defined.

### Validation
- lint, typecheck, unit, integration, e2e, contracts, security checks.

### Evidence
- Screenshots, test results, coverage reports if applicable.

## Checklist
- [ ] PR title follows conventional commits.
- [ ] All template sections filled.
- [ ] CI passes.
- [ ] Self-review completed.
- [ ] Appropriate reviewers assigned (check CODEOWNERS).
```
