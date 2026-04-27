# Security and Quality Checklist

Repo-controlled:

- conventional commits
- commitlint
- husky
- prettier
- eslint
- markdownlint
- yamllint
- cspell
- unit/integration/e2e
- codeql
- dependency review
- gitleaks
- checkov
- scorecard
- risk labels
- CODEOWNERS
- PR template
- issue template

Manual:

- protected branches
- required checks
- merge queue
- environment protection
- secrets
- Qodo
- Jira integration
- AWS account setup

## AWS IaC note

If you enable the AWS pack, also review the `cfn-lint` and `CloudFormation Guard` placeholder workflows.

## Template smoke tests

This template includes minimal smoke tests so CI and coverage have a working baseline from day 1. Replace or extend them as soon as the first real feature lands.
