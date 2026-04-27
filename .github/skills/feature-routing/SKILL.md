```skill
---
name: feature-routing
description: Split a feature into task groups and recommend routing/order across specialized agents.
---

## Purpose
After OpenSpec proposal and design are ready, this skill helps split work into task groups and map each to the right agent.

## Classification
1. **Trivial**: single-stream, low risk -> `openspec -> backend-implementer (or frontend-implementer) -> reviewer`.
2. **Standard backend**: backend-focused -> `openspec -> [contracts-implementer] -> backend-implementer -> tester-backend -> [security] -> reviewer`.
3. **Standard frontend**: UI-focused -> `openspec -> frontend-implementer -> tester-frontend -> [e2e-tester] -> reviewer`.
4. **Fullstack**: both streams -> `openspec -> contracts-implementer -> backend-implementer -> frontend-implementer -> observability-implementer -> tester-backend -> tester-frontend -> [e2e-tester] -> [security] -> reviewer`.
5. **High-risk**: auth, payments, PII, infra -> add `@security` agent (phase 9, only if risk=high in spec).

## Task group rules
- Each group must be independently implementable and testable.
- Groups should not have circular dependencies.
- Contract changes should be in their own group (enables parallel work).
- Observability is its own group if non-trivial.

## Output format
For each task group, specify:
- Group ID and description.
- Recommended agent.
- Dependencies (which groups must complete first).
- Risk level: low / medium / high.
- Human approval required: yes / no.

## Human checkpoints
Mandatory human approval at:
- After proposal (before design).
- After design (before implementation).
- Before merge of high-risk changes.
- After security review on high-risk paths.
```
