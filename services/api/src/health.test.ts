import { describe, expect, it } from 'vitest';

import { getHealthStatus } from './health.js';

describe('getHealthStatus', () => {
  it('returns ok', () => {
    expect(getHealthStatus()).toBe('ok');
  });
});
