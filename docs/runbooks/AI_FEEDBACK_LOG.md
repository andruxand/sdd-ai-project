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

| Date | PR  | Trigger                                                                          | Package / Area | Asset Updated | Rule Added | Threshold |
| ---- | --- | -------------------------------------------------------------------------------- | -------------- | ------------- | ---------- | --------- |
| —    | —   | _No entries yet. First entry will appear here after the first PR uses this log._ | —              | —             | —          | —         |

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
