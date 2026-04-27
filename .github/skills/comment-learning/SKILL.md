```skill
---
name: comment-learning
description: Turn repeated PR comments into standards, prompts, skills, or templates.
---

## When to use

### Package / library feedback — first occurrence

If a PR comment is about a specific package, library, or framework **and the finding
would apply to every future use of that package**, act on the first occurrence:
- Wrong API usage (e.g., using static `message.error()` instead of `App.useApp()` in antd)
- Missing configuration always required for a package (e.g., missing `CssBaseline` in MUI)
- Security anti-pattern specific to a library

Go directly to the relevant skill in `.github/skills/` and add an anti-pattern entry.

### General patterns — 2+ occurrences

When the same type of PR feedback appears 2+ times across different PRs, it signals a systemic gap.

## Process
1. Identify the repeated pattern (e.g., "always add correlation ID to logs").
2. Determine the best asset type:
   - **Standard**: add to `docs/standards/` if it is a project-wide rule.
   - **Skill**: enrich the relevant skill in `.github/skills/` if it is domain-specific guidance.
   - **Prompt**: update or create a prompt in `.github/prompts/` if it is an agent workflow improvement.
   - **Template**: update OpenSpec template if proposals/tasks consistently miss something.
   - **Agent definition**: update `.github/agents/` if an agent consistently misses a check.
3. Write the asset with: context, rule, examples, anti-patterns.
4. Reference the new asset in the PR comment resolution.

## Quality criteria for new assets
- Specific and actionable (not vague platitudes).
- Includes examples of correct and incorrect patterns.
- References the original PR comments that triggered it.
- Approved by team lead before merging.

## Anti-patterns
- Do NOT create assets for one-off issues.
- Do NOT duplicate existing standards.
- Do NOT create assets without examples.
```
