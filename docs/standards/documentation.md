# Documentation Standards

## Trigger: when to update docs

If ANY of the following changes, documentation MUST be updated:

- Behavior of an existing feature.
- API contract (REST or GraphQL).
- UI flow or user-facing behavior.
- Operational procedures (deploy, rollback, monitoring).
- Repeated PR feedback that reveals a missing standard.

## What to update

| Change type        | Update target                                   |
| ------------------ | ----------------------------------------------- |
| API behavior       | OpenSpec spec + OpenAPI/GraphQL schema + docs   |
| UI behavior        | OpenSpec spec + Storybook stories + docs        |
| New standard       | `docs/standards/` + relevant agent/skill        |
| Operational        | `docs/runbooks/`                                |
| Repeated PR lesson | `docs/standards/` or skill or agent or template |
| Onboarding gap     | `docs/onboarding/`                              |
| Risk/governance    | `docs/governance/`                              |

## Documentation conventions

- Use Markdown for all documentation.
- Use headers for structure (H2 for sections, H3 for subsections).
- Include examples for complex concepts.
- Include anti-patterns when documenting standards.
- Include checklists for processes.
- Keep docs concise — prefer tables and lists over prose.

## OpenSpec documentation

- Every feature change must have a proposal in `openspec/changes/`.
- Stable specs live in `openspec/specs/`.
- Use templates from `openspec/templates/` (proposal.md, design.md, tasks.md).

## Anti-patterns

- Do NOT merge behavior changes without updating docs.
- Do NOT create docs that duplicate existing standards.
- Do NOT write docs without examples.
- Do NOT leave TODO placeholders in merged docs.

## Checklist

- [ ] Affected docs identified.
- [ ] Docs updated with correct information.
- [ ] Examples provided.
- [ ] PR template docs section checked.
