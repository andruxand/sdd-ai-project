/**
 * apps/web/e2e/health.spec.ts
 *
 * E2E tests for the HealthStatus user journeys.
 *
 * Journeys:
 * 1. App load — HealthStatus appears and transitions from loading → ok
 * 2. Backend stop — component shows red error state when backend is unavailable
 * 3. Backend restore — component recovers to green ok state after backend comes back
 * 4. Degraded state — component shows yellow warning
 * 5. Accessibility — WCAG 2.1 AA audit on all status states
 *
 * All backend responses are intercepted via Playwright route mocking.
 * No real backend required.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const HEALTH_API_URL = '**/health';

function healthOkBody(version = '1.0.0') {
  return JSON.stringify({
    status: 'ok',
    version,
    timestamp: new Date().toISOString(),
  });
}

function healthDegradedBody() {
  return JSON.stringify({
    status: 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}

test.describe('HealthStatus — user journeys', () => {
  /**
   * Journey 1: App loads → HealthStatus shows loading then transitions to ok state.
   *
   * The route handler holds the response until we have asserted the loading state,
   * then releases it so the component transitions to ok.
   */
  test('app load: shows loading state then transitions to ok', async ({
    page,
  }) => {
    // Deferred that controls when the API response is sent
    let releaseResponse!: () => void;
    const responseHeld = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route(HEALTH_API_URL, async (route) => {
      // Block until the test releases the response
      await responseHeld;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: healthOkBody(),
      });
    });

    await page.goto('/');

    // Component is in loading state: spinner + "Checking..."
    await expect(page.getByLabel('Checking service status')).toBeVisible();
    await expect(page.getByText('Checking...')).toBeVisible();

    // Release the response — component transitions to ok
    releaseResponse();

    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Operational',
    );
    await expect(page.getByText('Service Operational')).toBeVisible();
    await expect(page.getByText('v1.0.0')).toBeVisible();
  });

  /**
   * Journey 2: Backend stops → HealthStatus shows red error state.
   *
   * Strategy: load with ok route → assert ok, then reload with abort route.
   */
  test('backend stop: shows error state when backend is unavailable', async ({
    page,
  }) => {
    // Phase 1: healthy backend
    await page.route(HEALTH_API_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: healthOkBody(),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Operational',
    );

    // Phase 2: backend stops — abort all health requests
    await page.unroute(HEALTH_API_URL);
    await page.route(HEALTH_API_URL, (route) => route.abort('failed'));

    // Reload triggers a fresh fetch — component should show error
    await page.reload();

    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Unavailable',
    );
    await expect(page.getByText('Service Unavailable')).toBeVisible();
  });

  /**
   * Journey 3: Backend restores → HealthStatus recovers to green ok state.
   *
   * Strategy: load with abort route → assert error, then reload with ok route.
   */
  test('backend restore: recovers to ok state after backend comes back', async ({
    page,
  }) => {
    // Phase 1: backend is down
    await page.route(HEALTH_API_URL, (route) => route.abort('failed'));

    await page.goto('/');
    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Unavailable',
    );

    // Phase 2: backend restores
    await page.unroute(HEALTH_API_URL);
    await page.route(HEALTH_API_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: healthOkBody(),
      });
    });

    // Reload triggers a fresh fetch — component should recover
    await page.reload();

    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Operational',
    );
    await expect(page.getByText('Service Operational')).toBeVisible();
  });

  /**
   * Journey 4: Degraded response → HealthStatus shows yellow warning state.
   */
  test('degraded response: shows degraded state', async ({ page }) => {
    await page.route(HEALTH_API_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: healthDegradedBody(),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Degraded',
    );
    await expect(page.getByText('Service Degraded')).toBeVisible();
  });

  /**
   * Accessibility audit — WCAG 2.1 AA on main page with ok state (green badge).
   */
  test('accessibility: WCAG 2.1 AA passes on ok state', async ({ page }) => {
    await page.route(HEALTH_API_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: healthOkBody(),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Operational',
    );

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('accessibility: WCAG 2.1 AA passes on error state', async ({ page }) => {
    await page.route(HEALTH_API_URL, (route) => route.abort('failed'));

    await page.goto('/');
    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Unavailable',
    );

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('accessibility: WCAG 2.1 AA passes on degraded state', async ({
    page,
  }) => {
    await page.route(HEALTH_API_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: healthDegradedBody(),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('status')).toHaveAccessibleName(
      'Service Degraded',
    );

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
