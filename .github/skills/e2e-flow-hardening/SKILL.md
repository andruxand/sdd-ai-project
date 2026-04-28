````skill
---
name: e2e-flow-hardening
description: Add or improve Playwright coverage for user journeys.
---

## Context
Tool: Playwright. Config: `apps/web/playwright.config.ts`. Tests: `apps/web/e2e/`.

## Pre-flight: before writing or running any test
1. Run `nvm use` from workspace root — the project requires Node 22.
2. Verify browser binaries; missing binaries cause "Executable doesn't exist" errors, not test failures:
   Run `npx playwright install`
3. Confirm `@axe-core/playwright` is in devDependencies; if missing run:
   `npm install --save-dev @axe-core/playwright`
4. Verify `playwright.config.ts` has `webServer` defined **unconditionally** (not wrapped in `process.env.CI ? undefined : ...`).
   Playwright manages server start/stop automatically — removing `webServer` in CI silently leaves no server running.

   ✅ Correct:
   ```ts
   webServer: {
     command: 'npm run dev --workspace=apps/web',
     url: 'http://localhost:5173',
     reuseExistingServer: !process.env.CI,
   }
   ```
   ❌ Wrong:
   ```ts
   webServer: process.env.CI ? undefined : { ... }
   ```

## When to add E2E tests
- New user-facing journey (login, checkout, form submission).
- Critical path spanning multiple pages/components.
- Regression for bugs not caught by unit/component tests.

## Best practices
- Use role-based locators: `getByRole`, `getByLabel`, `getByText`.
- Each test independent — no shared state between tests.
- Tag tests: `test('...', { tag: '@smoke' }, ...)`.
- Mock heavy APIs with `page.route()` when needed.

## Pattern: observing a loading state

Do NOT use a flag/signal triggered when the request is intercepted — by the time
you assert, the response may already be delivered and the loading state gone.

Use a **Promise latch** that blocks the response until assertions are complete:

```typescript
test('shows loading then ok', async ({ page }) => {
  let releaseResponse!: () => void;
  const responseHeld = new Promise<void>((resolve) => { releaseResponse = resolve; });

  await page.route('**/health', async (route) => {
    await responseHeld;   // blocks delivery until test releases
    await route.fulfill({ status: 200, contentType: 'application/json', body: '...' });
  });

  await page.goto('/');
  await expect(page.getByLabel('Checking service status')).toBeVisible(); // still loading
  releaseResponse();
  await expect(page.getByRole('status')).toHaveAccessibleName('Service Operational');
});
````

## Pattern: backend stop and backend restore journeys

Do NOT dispatch `visibilitychange` or `focus` events via `page.evaluate()` to trigger
React Query re-fetches — these events are not guaranteed to fire synchronously in Playwright
and React Query refetch-on-focus detection may not respond in test conditions.

Use **route swapping + `page.reload()`** instead:

```typescript
// healthy → error
await page.route('**/health', (r) =>
  r.fulfill({ status: 200, body: '{"status":"ok"}' }),
);
await page.goto('/');
await expect(page.getByRole('status')).toHaveAccessibleName(
  'Service Operational',
);
await page.unroute('**/health');
await page.route('**/health', (r) => r.abort('failed'));
await page.reload();
await expect(page.getByRole('status')).toHaveAccessibleName(
  'Service Unavailable',
);

// error → restored
await page.unroute('**/health');
await page.route('**/health', (r) =>
  r.fulfill({ status: 200, body: '{"status":"ok"}' }),
);
await page.reload();
await expect(page.getByRole('status')).toHaveAccessibleName(
  'Service Operational',
);
```

## Accessibility in E2E

- Use `@axe-core/playwright` for a11y checks on key pages.
- Audit ALL meaningful visual states (ok, error, loading, degraded) — a single-state audit misses violations.

```typescript
import AxeBuilder from '@axe-core/playwright';
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  .analyze();
expect(results.violations).toEqual([]);
```

### Common a11y pitfall: low-opacity background + same-hue text (MUI)

MUI badge/chip patterns often use `{color}1a` (10% opacity) as background with the
`main` color as text — this fails WCAG AA (ratio ~2.5–3; required 4.5:1).

Fix: add `.dark` entries to MUI theme and use them in components:

```typescript
// theme.ts
success: { main: '#16a34a', dark: '#14532d' },
warning: { main: '#f59e0b', dark: '#78350f' },
error:   { main: '#dc2626', dark: '#7f1d1d' },

// component
color: theme.palette.success.dark   // not .main
```

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
- Do NOT dispatch `visibilitychange`/`focus` events to trigger React Query re-fetches — use `page.reload()` + route swap.
- Do NOT use a request-intercepted signal for loading-state assertions — use a Promise latch that holds the response.

## Checklist

- [ ] `nvm use` run before any command.
- [ ] `npx playwright install` verified — no missing browser binaries.
- [ ] `@axe-core/playwright` installed.
- [ ] Critical journeys covered (load, error, restore, state variants).
- [ ] Tests use accessible locators.
- [ ] No sensitive data in test files.
- [ ] Failure artifacts configured (screenshots, traces).
- [ ] axe audit run on ALL visual states (ok, error, loading, degraded).
- [ ] Color contrast verified: no `main` color on 10%-opacity same-hue backgrounds.

```

```
