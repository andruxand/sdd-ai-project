import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GetHealthUseCase, type HealthCheckOutput } from './getHealth.js';

describe('GetHealthUseCase', () => {
  let useCase: GetHealthUseCase;
  let originalVersion: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetHealthUseCase();
    originalVersion = process.env.npm_package_version;
  });

  afterEach(() => {
    // Restore original version
    if (originalVersion !== undefined) {
      process.env.npm_package_version = originalVersion;
    } else {
      delete process.env.npm_package_version;
    }
  });

  it('returns correct shape with version from process.env', () => {
    process.env.npm_package_version = '1.2.3';

    const result: HealthCheckOutput = useCase.execute();

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('timestamp');
    expect(result.status).toBe('ok');
    expect(result.version).toBe('1.2.3');
    expect(typeof result.timestamp).toBe('string');
  });

  it('returns "unknown" if npm_package_version is undefined', () => {
    delete process.env.npm_package_version;

    const result = useCase.execute();

    expect(result.version).toBe('unknown');
    expect(result.status).toBe('ok');
  });

  it('returns valid ISO 8601 timestamp', () => {
    process.env.npm_package_version = '1.0.0';

    const result = useCase.execute();

    // ISO 8601 format: 2024-01-01T00:00:00.000Z
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    expect(result.timestamp).toMatch(iso8601Regex);

    // Verify it's a valid date
    const date = new Date(result.timestamp);
    expect(date).toBeInstanceOf(Date);
    expect(date.toString()).not.toBe('Invalid Date');
  });

  it('returns timestamp close to current time', () => {
    const before = Date.now();
    const result = useCase.execute();
    const after = Date.now();

    const resultTime = new Date(result.timestamp).getTime();
    expect(resultTime).toBeGreaterThanOrEqual(before);
    expect(resultTime).toBeLessThanOrEqual(after);
  });

  it('returns status "ok" consistently', () => {
    process.env.npm_package_version = '2.0.0';

    const result = useCase.execute();

    expect(result.status).toBe('ok');
    // Future: when degraded status is implemented, this test will need updating
  });
});
