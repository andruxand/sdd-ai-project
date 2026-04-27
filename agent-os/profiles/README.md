# Agent OS Profiles

Profiles are YAML files that map bootstrap selections to the active configuration for agents, skills, standards, and CI workflows.

## Schema: `agent-os-profile-v1`

| Section         | Purpose                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `identity`      | Profile name, topology, scope, contracts, criticality, designSystem.           |
| `workspaces`    | Which monorepo workspaces are active (backend, frontend, contracts, sharedUi). |
| `routing`       | Default routing type and per-agent activation rules.                           |
| `modules`       | Boolean flags for optional modules (storybook, playwright, etc.).              |
| `workflows`     | Boolean flags for which CI workflows are active.                               |
| `standards`     | List of standards docs applicable to this profile.                             |
| `skills`        | Skills grouped by domain (backend, frontend, contracts, crossCutting).         |
| `observability` | Platform, structured logs, tracing, metrics config.                            |

## How profiles are used

1. `npm run bootstrap` asks the developer for topology, scope, contracts, criticality, and design system.
2. Bootstrap selects the matching base profile and copies it to `.generated/active-profile.yaml`.
3. Bootstrap customizes the profile based on module selections (e.g., disabling storybook skills if module is off).
4. Agents and skills reference the active profile to know which standards and conventions apply.

## Creating new profiles

Copy an existing profile and modify the `identity` and downstream sections to match the new combination.
