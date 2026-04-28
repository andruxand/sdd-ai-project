# AI Feedback Log

Audit trail of PR review findings that were converted into AI instruction assets (skills, standards, agent definitions, or prompts).

> **Who writes here**: `@reviewer` and `@pr-comment-resolver` agents. Both must append an entry whenever a finding results in an asset update.
> **Why this exists**: make the "AI gets smarter from PRs" loop observable and auditable. Without a log, learnings are invisible to the team and likely to repeat.

---

## Format

Each entry:

| Field           | Content                                            |
| --------------- | -------------------------------------------------- |
| `date`          | YYYY-MM-DD                                         |
| `pr`            | `#N — <PR title>`                                  |
| `trigger`       | Exact or paraphrased reviewer comment              |
| `package/area`  | Library name, architectural area, or workflow step |
| `asset updated` | File path relative to repo root                    |
| `rule added`    | One sentence capturing the permanent rule          |
| `threshold`     | `first-occurrence` \| `2+ occurrences`             |

---

## Log

<!-- Entries are prepended (newest first) -->

<!-- TEMPLATE — copy and fill, then remove this comment block
| YYYY-MM-DD | #N — PR title | "Reviewer comment here" | package-name | `.github/skills/package-patterns/SKILL.md` | Never do X because Y. | first-occurrence |
-->

| Date       | PR                     | Trigger                                                                                                                                               | Package / Area           | Asset Updated                                                                      | Rule Added                                                                                                                                                            | Threshold        |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --- | ----------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 2026-04-28 | DIG-123456 CI fix      | CI validate failed: Prettier reformatted `mockServiceWorker.js` — MSW-generated file, must never be reformatted                                       | Prettier / MSW           | `.prettierignore`                                                                  | Add generated files (MSW, codegen output) to `.prettierignore`; generated files must never be reformatted by Prettier.                                                | first-occurrence |
| 2026-04-28 | DIG-123456 CI fix      | E2E CI: `ERR_CONNECTION_REFUSED localhost:5173` — `webServer` was `undefined` in CI, leaving no dev server running for Playwright                     | Playwright / CI          | `apps/web/playwright.config.ts`                                                    | Always define `webServer` in playwright.config; never conditionally set it to `undefined` in CI — Playwright manages server lifecycle automatically.                  | first-occurrence |
| 2026-04-28 | DIG-123456 CI fix      | Lighthouse CI: `lcp-lazy-loaded` returns NaN; `errors-in-console` fires on stub API URL; `meta-description` missing in `index.html`                   | Lighthouse CI            | `.lighthouserc.cjs`, `apps/web/index.html`                                         | Disable `lcp-lazy-loaded` + `errors-in-console` in lighthouserc for SPA builds with stub env; add `<meta name="description">` in initial scaffolding of `index.html`. | first-occurrence |
| 2026-04-28 | DIG-123456 review      | `import-x/order` ESLint warnings on imports placed after `vi.mock()` — cannot auto-fix without breaking mock hoisting                                 | vitest / import-x        | `.github/skills/vitest-patterns/SKILL.md`                                          | Document that import-after-vi.mock warnings are intentional false-positives for the hook-mocking pattern; do not suppress them via eslint-disable.                    | first-occurrence |     | vitest / import-x | `.github/skills/vitest-patterns/SKILL.md` | Document that import-after-vi.mock warnings are intentional false-positives for the hook-mocking pattern; do not suppress them via eslint-disable. | first-occurrence |
| 2026-04-28 | DIG-123456 review      | `npm run validate` failed with `util.styleText is not a function` (Node v19 active, .nvmrc requires 22)                                               | Node.js / nvm            | `.github/copilot-instructions.md` already states `nvm use` is required             | Always run `nvm use` before any npm command in this project or validate will silently fail on wrong Node version.                                                     | first-occurrence |
| 2026-04-27 | DIG-123456 E2E session | Loading-state assertion raced: signal fired when request intercepted but response already delivered before `expect()` ran                             | Playwright / React Query | `.github/skills/e2e-flow-hardening/SKILL.md`, `.github/agents/e2e-tester.agent.md` | Use a Promise latch (`await responseHeld` inside route handler) to hold the response; assert loading state while response is blocked, then call `releaseResponse()`.  | first-occurrence |
| 2026-04-27 | DIG-123456 E2E session | `page.evaluate(() => dispatchEvent('visibilitychange'))` did not trigger React Query refetch reliably in Playwright                                   | Playwright / React Query | `.github/skills/e2e-flow-hardening/SKILL.md`, `.github/agents/e2e-tester.agent.md` | For backend stop/restore journeys, use route-swap + `page.reload()` — never rely on focus/visibilitychange events to drive re-fetches in E2E tests.                   | first-occurrence |
| 2026-04-27 | DIG-123456 E2E session | axe E2E audit caught color-contrast violation: MUI `success.main` (#16a34a) on `success.main` + 10% opacity background = ratio 2.82 (< 4.5:1 WCAG AA) | MUI theme / a11y         | `.github/skills/e2e-flow-hardening/SKILL.md`                                       | Add `.dark` entries to MUI success/warning/error theme palette and use `palette.{color}.dark` for text on low-opacity same-hue backgrounds.                           | first-occurrence |
| 2026-04-27 | DIG-123456 E2E session | Playwright test run failed with "Executable doesn't exist" for Firefox and WebKit — browsers not installed                                            | Playwright               | `.github/skills/e2e-flow-hardening/SKILL.md`, `.github/agents/e2e-tester.agent.md` | Run `npx playwright install` and `nvm use` as pre-flight steps before writing or running any Playwright test.                                                         | first-occurrence |

---

## How to add an entry

### Agent instructions

After updating a skill or standard from PR feedback, append a row to the table above:

```markdown
| 2026-04-25 | #42 — feat: add order export | "You're calling `dayjs().format()` without specifying a locale — output will vary by server timezone" | `dayjs` | `.github/skills/dayjs-patterns/SKILL.md` | Always call `dayjs.utc()` before `.format()` for server-side date formatting; set locale explicitly at app init. | first-occurrence |
```

Then reference the log entry in the PR comment thread:

> "Learning recorded in `docs/runbooks/AI_FEEDBACK_LOG.md` — skill updated."

### When NOT to add an entry

- Nit comments (style, naming) that were fixed without creating assets.
- Comments that resulted in no code or asset change.
- Praise or questions.

---

## Searching the log

```bash
# Find all entries for a specific package
grep -i "dayjs\|zod\|react-query" docs/runbooks/AI_FEEDBACK_LOG.md

# Find entries that triggered skill updates
grep "SKILL.md" docs/runbooks/AI_FEEDBACK_LOG.md

# Find entries that triggered standards updates
grep "docs/standards/" docs/runbooks/AI_FEEDBACK_LOG.md
```

---

## Deriving improvements from the log

Run this review quarterly:

1. Group entries by `package/area` — if 3+ entries touch the same package, the skill may need a deeper rewrite.
2. Group entries by `asset updated` — if the same skill is updated 5+ times, evaluate whether it needs to be promoted from a stub to a full skill.
3. Group entries by `rule added` — if the same rule appears in multiple entries, it may belong in `docs/standards/` rather than a per-package skill.
4. Forward the top-3 repeated findings to the team's tech guild for standards review.
