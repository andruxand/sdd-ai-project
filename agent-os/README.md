# Bootstrap Profiles Layer

> **Note:** This folder is named `agent-os/` for historical reasons but it is **not** the
> [Agent OS by buildermethods.com](https://buildermethods.com/agent-os). That project is a
> Claude Code-native system (uses `/discover-standards`, `/inject-standards`, `/shape-spec`).
> This folder contains bootstrap configuration profiles read by `scripts/bootstrap.mjs`.

This directory defines profile YAML files that control which agents, skills, modules, and
workflows are active after running `npm run bootstrap`.

## Workflow

1. **Discover** — Bootstrap selects a profile based on topology, scope, contracts, criticality, and design system choices.
2. **Inject** — The selected profile determines which agents, skills, standards, workflows, and modules are active.
3. **Build** — Developers use agents and prompts to implement features following the active profile's constraints.
4. **Refine** — PR feedback loops create new standards, skills, and agent improvements via comment-learning.

## Profiles

Profiles live in `agent-os/profiles/` as YAML files. Each profile maps bootstrap selections to active agents, skills, standards, and workflows.

Available base profiles:

- `fullstack-monorepo.yaml` — full stack with all agents and modules.
- `backend-only.yaml` — backend-focused, frontend agents disabled.
- `frontend-only.yaml` — frontend-focused, backend agents disabled.

The bootstrap script copies and customizes the matching profile based on user selections.

## Profile schema

See `agent-os/profiles/README.md` for the YAML schema reference.
