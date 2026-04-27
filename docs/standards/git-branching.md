# Git Branching Strategy

## Model: Environment Promotion with Tag-Gated Production

This strategy is designed for teams that:

- Deploy to multiple AWS environments (dev → qa → cert → prod)
- Use CI/CD pipelines that auto-deploy on branch push
- Gate production deploys via semantic version tags
- Share a production database in the certification environment (see §7)

---

## Branch hierarchy

```
main        ← production environment  (tag-gated deploy; v1.2.3 → prod)
  ↑ PR from cert only
cert        ← certification environment  (uses prod DB read replica or shared)
  ↑ PR from qa only
qa          ← QA environment  (full regression; automated + manual)
  ↑ PR from develop only
develop     ← development integration  (always deployable to dev)
  ↑ PR from feat/*, fix/*, chore/*
feat/*      ← feature branches
fix/*       ← bugfix branches
hotfix/*    ← emergency production fixes (branch from main, see §6)
```

All branches except `feat/*`, `fix/*`, `chore/*`, and `hotfix/*` are **long-lived
protected branches**. They never receive direct pushes.

---

## 1. Feature development

```
develop  ──┬──────────────────────────────────────────► develop
           │                                             ↑ squash merge
           └─► feat/PROJ-123-order-notifications ───────┘
                (branch from develop, PR → develop)
```

### Naming convention

| Type          | Pattern                        | Example                                |
| ------------- | ------------------------------ | -------------------------------------- |
| Feature       | `feat/{JIRA-KEY}-{slug}`       | `feat/PROJ-456-order-notifications`    |
| Bug fix       | `fix/{JIRA-KEY}-{slug}`        | `fix/PROJ-789-notification-read-error` |
| Chore / infra | `chore/{JIRA-KEY}-{slug}`      | `chore/PROJ-100-upgrade-node-22`       |
| Hotfix        | `hotfix/{JIRA-KEY}-{slug}`     | `hotfix/PROJ-999-payment-503`          |
| Promotion     | `promote/{source}-to-{target}` | `promote/develop-to-qa`                |

### Rules

- Always branch from `develop`, never from `qa`, `cert`, or `main`.
- One feature per branch. Never accumulate unrelated changes.
- Branch lifetime ≤ 5 working days. Long-lived feature branches require a daily
  rebase against `develop` to avoid drift.
- Squash merge into `develop` — preserves a clean, linear history on the
  integration branch.

---

## 2. PR targets

| From                         | To        | Merge type               | Who approves                |
| ---------------------------- | --------- | ------------------------ | --------------------------- |
| `feat/*`, `fix/*`, `chore/*` | `develop` | Squash                   | 1 peer reviewer             |
| `hotfix/*`                   | `main`    | Squash                   | tech lead + 1 peer          |
| `develop` → `qa` (promotion) | `qa`      | Merge commit (no squash) | QA lead                     |
| `qa` → `cert` (promotion)    | `cert`    | Merge commit (no squash) | Tech lead                   |
| `cert` → `main` (release)    | `main`    | Merge commit (no squash) | Tech lead + release manager |

> **Why no squash on promotion PRs?** Promotion branches carry a batch of features.
> Squashing them would lose individual commit attribution and break `git blame`
> traceability back to the original feature branch.

---

## 3. Promotion flow (dev → qa → cert → main)

```
develop ──► PR "promote/develop-to-qa"  ──► qa  (auto-deploy to QA environment)
                                                     ↓ QA sign-off
qa      ──► PR "promote/qa-to-cert"     ──► cert (auto-deploy to cert environment)
                                                     ↓ cert sign-off + DB migration review
cert    ──► PR "promote/cert-to-main"   ──► main
                                                     ↓ tag triggers prod
main    ──► tag v1.2.3                  ──► PROD
```

### Promotion PR rules

1. Title: `chore(promote): {source} → {target} — {date}` (e.g., `chore(promote):
develop → qa — 2026-04-23`).
2. Body: list every feature/fix included since the last promotion (generated from
   `git log --oneline qa..develop`).
3. No new code in promotion PRs — only the merge itself. If a fix is needed,
   make a `fix/*` branch, merge to `develop`, then re-promote.
4. Promotion PRs must pass all required status checks before merge.

---

## 4. Tagging and production release

This template uses **two separate release tracks** that serve different purposes:

### Track 1 — Package versioning (Changesets, automatic)

`release.yml` triggers on **push to `main`** and uses the
[Changesets action](https://github.com/changesets/action). It does one of two
things depending on the state of pending changesets:

- **No pending changesets** → no-op: the workflow runs but creates nothing.
- **Pending changesets exist** → creates or updates a "Version Packages" PR.
  When that PR is merged, it bumps versions in `package.json` files and runs
  `npm run release` (which publishes to npm if `NPM_TOKEN` is set).

This track manages npm package releases for shared libraries inside the monorepo.
It is NOT the AWS environment deploy.

### Track 2 — AWS environment deploy (tags, project-specific)

AWS production deployments are triggered by semantic version tags. The tag-based
deploy workflow (`deploy.yml`) is **project-specific** — it is not shipped in
this template because it requires your AWS account credentials, region, and
Serverless stage configuration. You must create it per project.

Reference pattern — add `.github/workflows/deploy.yml` to your project:

```yaml
name: Deploy to Production

on:
  push:
    tags: ['v[0-9]+.[0-9]+.[0-9]+']

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production # requires Tech Lead + Release Manager approval
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run deploy:prod # → serverless deploy --stage prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

Until this deploy workflow exists, production deploys must be run manually:

```bash
cd services/api
npm run deploy:prod
```

### Tagging workflow

```bash
# After cert → main PR is merged and smoke tests pass:
git checkout main && git pull origin main
git tag -a v1.2.3 -m "release: v1.2.3 — order notifications + bug fixes"
git push origin v1.2.3
```

The tag triggers the `deploy.yml` workflow (once created) and serves as the
permanent release marker in GitHub — visible in Releases and used for rollbacks.

### Semantic versioning

| Change                            | Version bump  | Example         |
| --------------------------------- | ------------- | --------------- |
| Bug fix, internal                 | Patch `0.0.x` | v1.2.3 → v1.2.4 |
| New feature, backwards-compatible | Minor `0.x.0` | v1.2.3 → v1.3.0 |
| Breaking API or contract change   | Major `x.0.0` | v1.2.3 → v2.0.0 |

Pre-release tags for cert smoke testing: `v1.3.0-rc.1`, `v1.3.0-rc.2`.

---

## 5. CI per branch

`ci.yml` runs on **every pull request** (all base branches) and on **push to
`main`**. Additional specialized workflows run on pull requests in parallel.

| Trigger            | Workflows that run                                                                                                                       | Deploy target                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| PR from any branch | `ci` (lint, typecheck, coverage, openspec) · `risk-gate` · `cfn-lint` · `cfn-guard` · `checkov` · `contracts-rest` · `contracts-graphql` | ✗                                          |
| `push: develop`    | `ci` (via PR merge) · `risk-gate`                                                                                                        | `dev` environment (once deploy.yml added)  |
| `push: qa`         | `ci`                                                                                                                                     | `qa` environment (once deploy.yml added)   |
| `push: cert`       | `ci` + migration review gate                                                                                                             | `cert` environment (once deploy.yml added) |
| `push: main`       | `ci` · `release` (Changesets — npm package versioning)                                                                                   | ✗ (deploys only via tag)                   |
| tag `v*.*.*`       | `deploy.yml` (**project-specific** — add to your repo)                                                                                   | `production` (approval required)           |
| `hotfix/*`         | `ci` (via PR)                                                                                                                            | ✗                                          |

> Environment deploys (dev/qa/cert/prod) require a project-specific `deploy.yml`
> workflow that is not included in this template. See §4 for a reference pattern.

---

## 6. Hotfix flow (emergency production fix)

A hotfix skips the normal promotion path to minimize time-to-restore.

```
main ──► hotfix/PROJ-999-payment-503
               ↓ implement fix, tests
         PR   → main   (tech lead approval, squash)
               ↓ tag v1.2.4   → prod deploy
         PR   → develop (backport — prevents fix from being overwritten on next
                          promotion cycle)
```

**Rules:**

- Only for P1/P0 production incidents.
- Tech lead must approve before any hotfix PR merges to `main`.
- Backport PR to `develop` is mandatory — failure to backport means the fix is lost
  on the next `develop → qa → cert → main` cycle.
- Document the incident in `openspec/changes/{id}/proposal.md` even for hotfixes
  (abbreviated form is acceptable, but scope + rollback must be written).

---

## 7. Certification environment and production database

### Current state

`cert` deploys to AWS pointing to the **same database as production**. This means:

- Any migration run in `cert` affects production data.
- Any schema change that is not backwards-compatible **will break production** before
  the cert → main promotion.

### Mandatory safeguards

1. **Additive migrations only in cert**: every migration promoted to `cert` must be
   backwards-compatible (new columns nullable, new tables only, no column renames or
   drops). Use the `dynamodb-migrations` passive skill for DynamoDB schema changes.
2. **Migration review gate in CI**: the `cert` deploy workflow must include a step
   that detects migration files in the commit and **blocks auto-deploy**, requiring
   explicit DBA or tech lead approval via a GitHub environment protection rule.
3. **Never run destructive operations against cert/prod DB**: `DROP`, `TRUNCATE`,
   column renames, and index drops are forbidden unless behind a maintenance window
   with a documented rollback.
4. **Read replica for reads**: if possible, configure `cert` to read from the RDS
   read replica and write to prod only for integration-tested paths. This is the
   migration path toward full isolation.

### Migration path toward DB isolation (recommended)

```
Phase 1 (now):   cert → prod DB (shared write) + migration review gate in CI
Phase 2:         cert → prod DB (shared write) + separate cert schema per feature
Phase 3:         cert → prod DB read replica (reads) + prod DB (writes, gated)
Phase 4 (ideal): cert → point-in-time snapshot of prod restored daily
```

---

## 8. Branch protection rules

Configure in GitHub → Settings → Branches → Add ruleset:

### `main`

| Rule                    | Value                                     |
| ----------------------- | ----------------------------------------- |
| Require PR              | yes                                       |
| Required approvals      | 2 (tech lead + 1)                         |
| Code owners review      | required                                  |
| Dismiss stale approvals | yes                                       |
| Required status checks  | `validate`, `risk`, `cfn-lint`, `checkov` |
| Restrict push to        | nobody (only PR merge)                    |
| Restrict force push     | yes                                       |
| Restrict deletions      | yes                                       |

### `cert`

| Rule                   | Value                  |
| ---------------------- | ---------------------- |
| Require PR             | yes                    |
| Required approvals     | 1 (tech lead)          |
| Required status checks | `validate`, `risk`     |
| Restrict push to       | nobody (only PR merge) |
| Restrict force push    | yes                    |

### `qa`

| Rule                   | Value                  |
| ---------------------- | ---------------------- |
| Require PR             | yes                    |
| Required approvals     | 1 (QA lead)            |
| Required status checks | `validate`             |
| Restrict push to       | nobody (only PR merge) |

### `develop`

| Rule                   | Value              |
| ---------------------- | ------------------ |
| Require PR             | yes                |
| Required approvals     | 1 (peer)           |
| Required status checks | `validate`, `risk` |
| Restrict force push    | yes                |

---

## 9. GitHub Environments (AWS deploy gating)

Configure in GitHub → Settings → Environments:

| Environment  | Branch source | Required reviewers          | Wait timer |
| ------------ | ------------- | --------------------------- | ---------- |
| `dev`        | `develop`     | none (auto)                 | 0 min      |
| `qa`         | `qa`          | none (auto)                 | 0 min      |
| `cert`       | `cert`        | Tech lead (if migrations)   | 0 min      |
| `production` | tag `v*.*.*`  | Tech lead + Release manager | 5 min      |

The 5-minute wait timer on `production` provides a cancellation window after tag push.

---

## 10. Anti-patterns

- **Do NOT push directly to `develop`, `qa`, `cert`, or `main`** — all changes via
  PR. Branch protection enforces this.
- **Do NOT feature-branch from `qa`, `cert`, or `main`** — always from `develop`.
  Exception: `hotfix/*` branches from `main`.
- **Do NOT add code changes to promotion PRs** — promotion PRs are strictly merges.
  If a review finds a bug, fix it in `develop` first, never directly in the
  promotion PR.
- **Do NOT tag on branches other than `main`** — tags must point to commits that are
  already on `main`.
- **Do NOT run destructive DB operations in `cert`** without explicit approval and
  maintenance window (shared prod DB).
- **Do NOT skip the backport PR after a hotfix** — the fix will be overwritten on
  the next promotion cycle.
- **Do NOT accumulate features on a branch > 5 days** — creates merge conflicts and
  review fatigue. Prefer trunk-based development where features are small and
  merged quickly.

---

## 11. Quick reference

```bash
# Start a feature
git checkout develop && git pull origin develop
git checkout -b feat/PROJ-456-order-notifications
# ... implement ...
git push -u origin feat/PROJ-456-order-notifications
gh pr create --base develop --title "feat(notifications): PROJ-456 order status notifications"

# Start a hotfix
git checkout main && git pull origin main
git checkout -b hotfix/PROJ-999-payment-503
# ... fix ...
git push -u origin hotfix/PROJ-999-payment-503
gh pr create --base main --title "fix(payments): PROJ-999 503 on payment retry"
# After merge → tag
git checkout main && git pull origin main
git tag -a v1.2.4 -m "hotfix: PROJ-999 503 on payment retry"
git push origin v1.2.4
# Backport
git checkout develop && git pull origin develop
gh pr create --base develop --head hotfix/PROJ-999-payment-503 \
  --title "chore(backport): PROJ-999 hotfix into develop"

# Promote develop → qa
git checkout develop && git pull origin develop
gh pr create --base qa --head develop \
  --title "chore(promote): develop → qa — $(date +%Y-%m-%d)"

# Tag for production
git checkout main && git pull origin main
git tag -a v1.3.0 -m "release: v1.3.0 — order notifications"
git push origin v1.3.0
```

---

## Checklist before opening any PR

- [ ] Branch named following the convention (`feat/`, `fix/`, `chore/`, `hotfix/`,
      `promote/`).
- [ ] PR targets the correct base branch (see §2).
- [ ] CI passes locally (`npm run validate`).
- [ ] Squash merge for feature/fix branches; merge commit for promotion.
- [ ] If promotion PR: body lists every included feature/fix.
- [ ] If hotfix: backport PR opened against `develop` before closing incident.
- [ ] If cert promotion includes migrations: tech lead approved the migration review
      gate.
- [ ] Tag created from `main` only, after cert → main merge.
