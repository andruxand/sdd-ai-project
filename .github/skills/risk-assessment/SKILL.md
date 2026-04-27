```skill
---
name: risk-assessment
description: Assess risk based on paths, contracts, security, and operations.
---

## Risk classification

### High risk (requires security agent + explicit approval)
- Auth / permissions changes.
- PII handling or storage.
- Sensitive logs exposure.
- Public contract breaking changes.
- Infrastructure / IAM / WAF / API Gateway changes.
- Database migrations.
- Payment / compliance flows.

### Medium risk
- New endpoints or API extensions.
- Significant functional changes.
- Shared design system modifications.
- New external service integrations.

### Low risk
- Documentation updates.
- Internal refactors (no behavior change).
- Non-sensitive UI changes.

## Assessment process
1. List files changed and classify by risk matrix area.
2. Identify contract impact (none / additive / breaking).
3. Check for security-sensitive patterns (auth, PII, IAM, secrets).
4. Evaluate rollback complexity (code-only / data involved / coordination needed).
5. Determine required approvals based on risk level.

## Output
- Risk level: low / medium / high.
- Rationale.
- Required approvals.
- Rollback considerations.
- Follow-up actions.

## Integration with CI
The `risk-gate.yml` workflow auto-labels PRs based on paths changed (high/medium/low).
Ensure paths are correctly mapped in the workflow filter.
```
