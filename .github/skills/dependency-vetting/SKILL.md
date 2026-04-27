````skill
---
name: dependency-vetting
description: Pre-install due diligence for any npm package — skill lookup, security, license, bundle size, and skill-creation protocol. Load this skill BEFORE running any npm install command.
type: always-active
agents: [backend-implementer, frontend-implementer]
---

## When to load

Load this skill every time you need to run `npm install`, `npm install -D`, or add a package to any `package.json` in the monorepo. No exceptions.

---

## Step 1 — Check if a skill already exists

Before evaluating the package yourself, search `.github/skills/` for an existing skill that covers it.

```bash
ls .github/skills/ | grep -i "<package-name>"
# or search by keyword
ls .github/skills/ | grep -i "dynamo\|cognito\|middy\|zod\|rhf\|react-query"
```

**Skill-to-package mapping** (known associations — not exhaustive):

| Package(s) | Skill to load |
|-----------|--------------|
| `tailwindcss`, `clsx`, `tailwind-merge`, `class-variance-authority` | `tailwind-patterns` |
| `@mui/material`, `@mui/icons-material`, `@emotion/react` | `mui-patterns` |
| `antd`, `@ant-design/icons` | `antd-patterns` |
| `@chakra-ui/react` | `chakra-patterns` |
| `bootstrap`, `react-bootstrap` | `bootstrap-patterns` |
| `@tanstack/react-query` | `react-query-patterns` |
| `react-hook-form`, `@hookform/resolvers` | `form-validation-patterns` |
| `zod` | `form-validation-patterns`, `input-validation-patterns` |
| `zustand` | `zustand-patterns` |
| `@apollo/client`, `graphql` | `graphql-client-patterns` |
| `@aws-lambda-powertools/*` | `powertools-patterns` |
| `@aws-sdk/*` (DynamoDB) | `dynamodb-patterns` |
| `@aws-sdk/*` (Cognito) | `cognito-auth-patterns` |
| `@aws-sdk/*` (S3) | `s3-storage-patterns` |
| `middy`, `@middy/*` | `middy-patterns` |
| `cockatiel` | `circuit-breaker`, `http-client-retry` |
| `msw` | `msw-mock-patterns` |
| `datadog-browser-rum` | `datadog-rum-patterns` |
| `@playwright/test` | `e2e-flow-hardening` |
| `vitest`, `@vitest/*` | `vitest-patterns` |
| `k6` | `load-testing-k6` |

If a skill exists → load it and follow its conventions before writing any code that uses the package. **Do not install alternatives to packages already covered by a skill without an OpenSpec proposal.**

---

## Step 2 — Check if the package is already a project dependency

```bash
# from the workspace root
grep -r '"<package-name>"' packages/*/package.json services/*/package.json apps/*/package.json
```

If it is already installed in another workspace, prefer importing it from there or align versions before adding it again.

---

## Step 3 — Security vetting

Run these checks **before** committing the install:

```bash
# 1. Audit after install (do not commit if high/critical vulns with no fix)
npm audit --audit-level=high

# 2. Check the package on npm for maintenance signals
# - Last publish date > 2 years ago: flag it
# - Weekly downloads < 1000 for a non-niche package: flag it
# - Open CVEs: check https://osv.dev or https://snyk.io/vuln

# 3. License check (copyleft licenses require legal review)
npx license-checker --production --onlyAllow 'MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;CC0-1.0;Unlicense;0BSD;Python-2.0'
```

**License risk levels:**

| License | Action |
|---------|--------|
| MIT, ISC, BSD, Apache-2.0, CC0, Unlicense | ✅ Approved — no action needed |
| LGPL-2.1, LGPL-3.0 | ⚠️ Flag — check dynamic vs static linking; get tech-lead sign-off |
| GPL-2.0, GPL-3.0, AGPL | ❌ Blocked — requires legal review before use |
| Commercial / proprietary | ❌ Blocked — requires procurement and legal review |
| Unknown / missing | ❌ Blocked — do not install until resolved |

**Supply-chain signals to reject:**

- Package was published in the last 7 days and has >100k weekly downloads suddenly (typosquatting risk).
- Package has no README, no repository link, and one author only.
- Package name is a single letter or close misspelling of a popular package.
- Package requires `postinstall` script that runs arbitrary shell commands without clear documentation.

---

## Step 4 — Bundle / performance impact (frontend only)

For packages being installed into `apps/web` or `packages/shared/ui`:

```bash
# Check bundle size before committing
npx bundlephobia-cli <package-name>
# or check https://bundlephobia.com manually

# Check if tree-shakeable (important for libraries like lodash, date-fns, etc.)
```

Rules:
- If adding >50 KB (gzipped) to the frontend bundle, document it in the OpenSpec task and confirm with the orchestrator.
- Prefer tree-shakeable alternatives: `date-fns` over `moment`, `lodash-es` over `lodash`.
- If a package is used in only one component, prefer a smaller focused alternative.

---

## Step 5 — Peer dependency audit

```bash
# After npm install, check for unmet peer deps
npm ls 2>&1 | grep "UNMET PEER"
# Fix all UNMET PEER DEPENDENCY warnings before committing
```

Missing peer deps cause runtime errors in other developers' environments.

---

## Step 6 — Does this package warrant a new skill?

Answer yes to **any** of these → create a skill stub (section 7):

- The package has non-obvious patterns or anti-patterns (e.g., Middy, Powertools, Apollo, Redis).
- The package has specific security requirements (e.g., JWT libs, crypto libs, auth SDKs).
- The package has project-wide usage conventions that are not in existing skills.
- The package has a PR review comment that revealed a usage mistake.

Answer no to all → add a usage note in the implementing task's handoff instead.

---

## Step 7 — Skill stub when no skill exists

When a significant new package is added with no existing skill, create a stub immediately:

```bash
mkdir -p .github/skills/<package-slug>-patterns
cat > .github/skills/<package-slug>-patterns/SKILL.md << 'EOF'
```skill
---
name: <package-slug>-patterns
description: <Package name> — patterns, conventions, and anti-patterns. Stub created on <date> for v<version>.
type: conditional
condition: package <package-name> is used
agents: [backend-implementer, frontend-implementer]
---

## Stack

```bash
# installed in <workspace> on <date>
npm install <package-name>
```

## TODO — populate from:
- [ ] Official documentation: <docs-url>
- [ ] PR comments / review findings
- [ ] Team usage patterns

## Known constraints
<!-- What NOT to do — fill in as patterns are discovered -->

## Anti-patterns
<!-- Fill in from PR feedback and team experience -->
EOF
```

This stub is a placeholder. The agent and team populate it from:
1. Official documentation for the package.
2. Any PR comments received about the package's usage.
3. Team-discovered anti-patterns during the first feature that uses it.

---

## Step 8 — After any PR comment about a package

**When a PR reviewer flags a usage error for a specific package:**

1. Fix the code.
2. **Immediately update the corresponding skill** (do not wait for a second occurrence).
3. Add the finding as a new section in the skill:

```markdown
## Anti-patterns — from PR feedback

### [Date] [PR #] — [short description]
**Reviewer comment**: "<exact or paraphrased comment>"
**Wrong pattern**:
```typescript
// ❌ what was written
```
**Correct pattern**:
```typescript
// ✅ what it should be
```
**Rule**: one sentence capturing why this matters.
```

4. Reference the skill update in the PR comment resolution.
5. Record the learning in `docs/runbooks/AI_FEEDBACK_LOG.md`.

---

## Monorepo workspace routing

| Install location | Command | When |
|-----------------|---------|------|
| Backend service | `cd services/api && npm install <pkg>` | Lambda handler or use-case dependency |
| Frontend app | `cd apps/web && npm install <pkg>` | React component or hook dependency |
| Shared UI | `cd packages/shared/ui && npm install <pkg>` | Design system component dependency |
| Root (tooling only) | `npm install -D <pkg> -w .` | Dev tooling used across all workspaces |
| Config package | `cd packages/config && npm install <pkg>` | Shared ESLint/TS config dependency |

Never install a runtime dependency in the root `package.json`. Never cross-install frontend packages in backend workspaces.

---

## Guardrails

| Rule | Rationale |
|------|-----------|
| Never `npm install` in CI — use `npm ci` | Reproducible builds, lock file enforced |
| Never `--force` or `--legacy-peer-deps` without an issue explaining why | Masks real conflicts |
| Pin major versions (`"^x.y.z"`) for runtime deps, exact for security-sensitive | Prevents surprise upgrades |
| Run `npm audit` after every install | Catch known CVEs before they reach CI |
| Check license before installing anything in `production` deps | Avoid copyleft contamination |
| Create skill stub for significant new packages | Institutional knowledge doesn't get lost |
````
