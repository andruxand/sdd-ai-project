```skill
---
name: backend-test-hardening
description: Add or improve backend test coverage.
---

## Context
Test runner: Vitest. Coverage: @vitest/coverage-v8. Stack: AWS Lambda + SLS v4 + Node/TS.

## Strategy
1. Unit tests for business logic (use cases, services, utilities).
2. Integration tests for handlers — mock AWS services using aws-sdk-client-mock or similar.
3. Behavior-based tests, not implementation-detail tests.

## What to test
- Happy path: correct input produces correct output.
- Validation: invalid input returns appropriate error.
- Edge cases: empty arrays, null values, boundary numbers.
- Error handling: service failures, timeouts, permission errors.
- Auth paths: authorized, unauthorized, forbidden, expired token.

## Coverage targets
- >80% line coverage on business logic.
- 100% coverage for validation schemas.
- Handler tests must cover: 200, 400, 401, 403, 404, 500 paths.

## Mocking guidelines
- Mock external services (AWS SDK, HTTP clients), never business logic.
- Use factory functions for test data.
- Reset mocks between tests.
- Prefer `vi.fn()` and `vi.mock()` over manual stubs.

## Anti-patterns
- Do NOT test private methods or implementation details.
- Do NOT write tautological tests.
- Do NOT mock the unit under test.
- Do NOT skip tests without a linked issue.
- Do NOT snapshot-test JSON responses.

## Checklist
- [ ] All new business logic has unit tests.
- [ ] All new handlers have integration tests covering success and error paths.
- [ ] No sensitive data in test fixtures.
- [ ] Tests run in CI.
- [ ] Coverage does not decrease from current baseline.
```
