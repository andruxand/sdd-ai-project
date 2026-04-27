---
name: jira-to-change
description: Turn a Jira ticket into OpenSpec planning artifacts with risk, open questions, and rollback.
argument-hint: 'Paste Jira key or issue reference, Jira URL if available, useful text, AC, related links, prior delivery, images/attachments if relevant.'
---

Normalize the requirement. Extract problem, scope, out-of-scope, dependencies, constraints, acceptance criteria, and open questions. Do not invent missing business rules.

Rules:

1. If the minimum information required to start is incomplete, ask for the missing pieces first.
2. Minimum information to start:
   - a business goal or user problem
   - a description of the requested change
   - at least one acceptance criterion or success condition
   - some identifier or reference for traceability (Jira key, issue ID, or equivalent)
3. Additional but optional context:
   - Jira URL
   - related links
   - prior delivery
   - mockups, images, or attachments
   - dependencies and constraints
4. If optional context is missing, continue when safe, but explicitly mark assumptions and open questions.

Then:

1. classify impact on backend, frontend, REST, GraphQL, design system, docs, observability
2. classify cross-cutting impact on auth, permissions, PII, logs, tracing, retries, IAM, WAF, API Gateway, JWT, API keys
3. generate or update OpenSpec proposal/design/tasks drafts
4. classify risk with rationale
5. propose rollback considerations
