---
applyTo: '**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx'
---

# Test Instructions

- Use `vitest` for unit and integration tests. Use `@playwright/test` for e2e.
- Each test file must import from `vitest` (`describe`, `it`, `expect`, `vi`).
- Follow Arrange-Act-Assert (AAA) pattern. Separate each section with a blank line.
- Test names must describe behavior, not implementation: "returns 404 when user not found" not "test getUserById".
- Mock external dependencies (AWS SDK, HTTP clients, DB) — never call real services in unit tests.
- Use `vi.mock()` for module mocks. Use `vi.spyOn()` for partial mocks.
- Reset mocks in `beforeEach` or use `vi.restoreAllMocks()`.
- Never use `test.only` or `describe.only` in committed code.
- Coverage thresholds are enforced at 80%. Do not lower them.
- For React components: use `@testing-library/react`. Prefer `screen.getByRole` over `getByTestId`.
- For API handlers: test the handler function directly with mocked event objects.
- For e2e (Playwright): use Page Object pattern. Store selectors in page objects, not in test files.
