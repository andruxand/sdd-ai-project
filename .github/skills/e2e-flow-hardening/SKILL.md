```skill
---
name: e2e-flow-hardening
description: Add or improve Playwright coverage for user journeys.
---

## Context
Tool: Playwright. Config: `apps/web/playwright.config.ts`. Tests: `apps/web/e2e/`.

## When to add E2E tests
- New user-facing journey (login, checkout, form submission).
- Critical path spanning multiple pages/components.
- Regression for bugs not caught by unit/component tests.

## Best practices
- Use role-based locators: `getByRole`, `getByLabel`, `getByText`.
- Each test independent — no shared state between tests.
- Tag tests: `test('...', { tag: '@smoke' }, ...)`.
- Mock heavy APIs with `page.route()` when needed.

## Accessibility in E2E
- Use `@axe-core/playwright` for a11y checks on key pages.

## Data and environment
- Never use real credentials or PII.
- Tests must work against local dev server or CI preview.

## CI integration
- Runs on `pull_request`.
- Artifacts: screenshots + traces on failure.
- Configure `retries: 1` in CI only.

## Anti-patterns
- Do NOT test API logic through E2E.
- Do NOT chain tests (B depends on A).
- Do NOT use `page.waitForTimeout()`.
- Do NOT hardcode URLs with ports — use `baseURL`.

## Checklist
- [ ] Critical journeys have E2E coverage.
- [ ] Tests use accessible locators.
- [ ] No sensitive data in test files.
- [ ] Failure artifacts configured.
```
