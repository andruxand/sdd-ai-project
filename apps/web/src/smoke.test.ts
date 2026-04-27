import { describe, expect, it } from 'vitest';

describe('web workspace smoke test', () => {
  it('confirms the workspace test runner is wired', () => {
    expect(1 + 1).toBe(2);
  });
});
