# Template Audit Notes

This template already includes:

- OpenSpec
- Agent OS
- VS Code + Copilot customizations
- prompts, custom agents, and skills
- Storybook and Playwright hooks
- security, quality, and risk workflows
- rollback and review-learning flow

This template still expects project-specific connection for:

- OpenAPI generation
- GraphQL schema generation
- cfn-lint target templates
- CloudFormation Guard rules
- GitHub Apps like Qodo
- branch protection, required checks, environments, and secrets

## Template smoke tests

This template includes minimal smoke tests so CI and coverage have a working baseline from day 1. Replace or extend them as soon as the first real feature lands.
