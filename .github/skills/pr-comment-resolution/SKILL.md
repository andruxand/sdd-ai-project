````skill
---
name: pr-comment-resolution
description: Process PR feedback and turn repeated lessons into reusable assets.
---

## Comment classification
1. **Must fix**: code correctness, security, contract violation -> resolve before merge.
2. **Should fix**: code quality, naming, structure -> resolve or document reason to defer.
3. **Nit**: style preference, minor suggestion -> resolve or acknowledge.
4. **Question**: clarification needed -> respond with explanation.
5. **Praise**: positive feedback -> acknowledge.

## Resolution process
1. Read each comment and classify.
2. For must-fix: implement the fix, reference the comment in the commit.
3. For should-fix: implement or create follow-up issue with justification.
4. For questions: respond inline with context.
5. Mark resolved when addressed.

## Package-related feedback — immediate action (no 2-occurrence rule)

When a reviewer comment is about the **usage of a specific library or package**, act immediately — do not wait for a second occurrence:

1. Fix the code.
2. Identify the package's skill in `.github/skills/` (see `dependency-vetting` mapping table).
3. Add a new section to the skill under `## Anti-patterns — from PR feedback`:
   ```markdown
   ### [YYYY-MM-DD] [PR #N] — <short description>
   **Reviewer comment**: "<paraphrased>"
   <!-- ❌ wrong pattern -->
   <!-- ✅ correct pattern -->
   **Rule**: one sentence.
````

4. If no skill exists for the package, create a stub using `dependency-vetting` section 7.
5. Record the learning in `docs/runbooks/AI_FEEDBACK_LOG.md`.

## Repeated lesson detection (general patterns)

If the same feedback appears across 2+ PRs AND it is not package-specific:

1. Identify the pattern.
2. Determine the right asset to create:
   - Code pattern → update `docs/standards/`.
   - Prompt improvement → update `.github/prompts/`.
   - Skill gap → enrich relevant skill in `.github/skills/`.
   - Template issue → update `openspec/templates/`.
   - Agent missing a check → update `.github/agents/`.
3. Create or update the asset with: context, rule, correct example, anti-pattern example.
4. Reference the new/updated asset in the PR comment resolution thread.
5. Record the learning in `docs/runbooks/AI_FEEDBACK_LOG.md`.

## Anti-patterns

- Do NOT dismiss comments without explanation.
- Do NOT resolve comments without actual changes.
- Do NOT create massive follow-up issues for simple fixes.
- Do NOT wait for a second occurrence when the comment is package/library-specific.

## Checklist

- [ ] All must-fix comments resolved.
- [ ] All should-fix comments resolved or deferred with justification.
- [ ] Questions answered.
- [ ] Repeated lessons converted to reusable assets.

```

```
