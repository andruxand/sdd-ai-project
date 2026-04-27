```skill
---
name: frontend-test-hardening
description: Add or improve frontend test coverage.
---

## Context
Test runner: Vitest. Component testing: Vitest + Testing Library (React). E2E: Playwright.

## Test types
| Type | When | Tool |
|------|------|------|
| Unit | Pure functions, hooks, utilities | Vitest |
| Component | Rendering, user interactions, state | Vitest + Testing Library |
| Storybook interaction | Visual + interaction in story context | Storybook play functions |
| E2E | Full user journeys | Playwright |

## Testing Library conventions
- Query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`.
- Use `userEvent` over `fireEvent`.
- Wrap state updates in `act()` or use `waitFor()`.

## What to test
- Components: renders correctly, handles events, displays correct states.
- Hooks: returns expected values, reacts to dependency changes.
- Utils: pure function input/output.
- Error states: API failure, empty data, loading.

## Coverage targets
- >80% on components with business logic.
- 100% on shared/ui primitives.

## Anti-patterns
- Do NOT snapshot-test component HTML.
- Do NOT test implementation details.
- Do NOT mock the component under test.
- Do NOT use `data-testid` as first choice.

## Checklist
- [ ] All new components have tests.
- [ ] All shared/ui primitives have tests + stories.
- [ ] No sensitive data in test fixtures.
- [ ] Coverage does not decrease.
```
