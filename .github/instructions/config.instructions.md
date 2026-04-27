---
applyTo: '**/*.yml,**/*.yaml'
---

# YAML/Config Instructions

- Use 2-space indentation consistently.
- Use quotes for strings that could be misinterpreted (e.g., `"on"`, `"yes"`, `"3.10"`).
- GitHub Actions workflows: always pin action versions with full SHA or major version tag.
- Serverless Framework: use `${self:custom.*}` for shared values, `${env:*}` for secrets.
- Do not hardcode AWS account IDs, regions, or resource ARNs in YAML files.
- OpenSpec config: follow the structure in `openspec/config.yaml`. Do not add new top-level keys.
- Agent OS profiles: follow the structure in `agent-os/profiles/`. Reference skills by folder name.
