```skill
---
name: review-learning-update
description: Convert repeated review feedback into standards, prompts, skills, templates, or runbook updates.
---

## Trigger
Reviewer or PR comment resolver identifies a recurring pattern that is not captured in existing assets.

## Decision matrix

| Feedback type | Threshold | Asset to update |
|---------------|-----------|----------------|
| **Package/library usage error** | **First occurrence** | The package's `.github/skills/<pkg>-patterns/SKILL.md` (create stub with `dependency-vetting` §7 if missing) |
| Code convention | 2+ occurrences | `docs/standards/` |
| Architecture pattern | 2+ occurrences | `docs/standards/` or relevant skill |
| Missing test scenario | First occurrence | `backend-test-hardening` or `frontend-test-hardening` skill |
| Missing log/trace | First occurrence | `observability-hardening` skill |
| Security oversight | First occurrence | `docs/standards/aws-security.md` or `security` skill |
| Missing spec field | 2+ occurrences | `openspec/templates/` |
| Agent missing a check | First occurrence | `.github/agents/*.agent.md` |
| Workflow gap | 2+ occurrences | `.github/workflows/` |
| Onboarding confusion | 2+ occurrences | `docs/onboarding/` or `docs/runbooks/` |

> **Note:** Security, observability, and package-specific findings act on **first occurrence**. The 2-occurrence rule applies only to style/convention findings where a single data point may be a legitimate exception.

## Process
1. Classify the feedback using the decision matrix above.
2. For package-usage findings: update or create the package skill immediately, in the same session.
3. For other findings: document the pattern (1 example is enough for security/observability; 2+ for conventions).
4. Draft the asset update with: context, correct example, anti-pattern example, one-line rule.
5. Get team approval (can be async via PR).
6. Merge and reference in the triggering PR comment thread.
7. Record the learning in `docs/runbooks/AI_FEEDBACK_LOG.md`.

## Checklist
- [ ] Feedback classified against decision matrix.
- [ ] Correct asset identified and threshold applied.
- [ ] Asset updated with examples (correct + anti-pattern).
- [ ] For package-specific: package skill updated in same session.
- [ ] Approved by team.
- [ ] Referenced in PR comment thread.
- [ ] Learning recorded in `docs/runbooks/AI_FEEDBACK_LOG.md`.
```
