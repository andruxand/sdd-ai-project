````skill
---
name: jira-intake
description: Normalize a Jira ticket into OpenSpec-ready planning artifacts.
---

## Minimum required from Jira
- Business goal or user problem.
- Description of the requested change.
- At least one acceptance criterion.
- Identifier for traceability (Jira key).

## Optional but helpful
- Jira URL and related links.
- Prior delivery or PR references.
- Mockups, images, or attachments.
- Dependencies and constraints.

## Normalization steps
1. Extract raw information from the Jira ticket.
2. Identify missing minimum fields — ask for them, do not invent.
3. Classify impact areas: backend, frontend, REST, GraphQL, design system, observability, security, infra.
4. Classify cross-cutting concerns: auth, permissions, PII, IAM, WAF, JWT, API keys.
5. Identify risks: functional, security, contract, operational.
6. Draft rollback considerations.
7. Create the Git branch (see below).
8. Generate OpenSpec proposal draft using `openspec/templates/proposal.md`.

## Git branch creation (step 7)

After confirming the Jira key and change type, create the branch automatically **before writing any artifact**.

### Pre-flight checks (run these first, stop if any fails)

```bash
# 1. Verify working directory is clean
git status --porcelain
# If output is not empty: stop and tell the developer to commit or stash changes first.

# 2. Verify the branch does not already exist
git branch --list "<branch-name>"
# If output is not empty: stop and ask the developer whether to reuse that branch or create a new one.
````

### Branch naming convention

```
{type}/{JIRA-KEY}-{short-slug}
```

| Jira issue type           | Git branch type |
| ------------------------- | --------------- |
| Story / Feature / Task    | `feat`          |
| Bug / Defect              | `fix`           |
| Tech Debt / Chore / Spike | `chore`         |
| Documentation             | `docs`          |
| Hotfix / Critical Bug     | `hotfix`        |

Slug rules: lowercase, hyphens only, max 5 words, no articles.

Examples:

- `feat/PROJ-123-user-registration`
- `fix/PROJ-456-login-token-expiry`
- `chore/PROJ-789-update-node-deps`
- `docs/PROJ-101-api-reference`

### Create and check out

```bash
# For feat/*, fix/*, chore/*, docs/* — always branch from develop
git checkout develop && git pull origin develop
git checkout -b {branch-name}

# Exception: hotfix/* — branch from main (P0/P1 incidents only)
# git checkout main && git pull origin main
# git checkout -b hotfix/{JIRA-KEY}-{slug}
```

### After creation

- Report to the developer: `✓ Branch created: {branch-name}`
- Confirm which branch they are now on: `git branch --show-current`
- Proceed immediately to proposal generation — do not ask for permission.

### When NOT to create the branch automatically

- Working directory has uncommitted or staged changes → stop, report, wait.
- Branch already exists → ask developer: reuse or create a new one with a different slug?
- Developer explicitly says "I already created the branch" → skip this step entirely.
- A PR for this Jira key is already open → warn the developer before proceeding.

## Output

- Git branch created and checked out (or confirmed existing).
- Normalized proposal draft in `openspec/changes/<change-id>/proposal.md`.
- List of open questions for the requester.
- Risk classification with rationale.
- Recommended routing (trivial / standard / fullstack / high-risk).

## Anti-patterns

- Do NOT invent acceptance criteria.
- Do NOT assume scope that is not explicitly stated.
- Do NOT skip risk classification.
- Do NOT proceed without minimum required fields.
- Do NOT create a branch from a dirty working directory.
- Do NOT silently skip the branch step — always report what happened.

```

```
