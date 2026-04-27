import { describe, expect, it } from 'vitest';

describe('api workspace smoke test', () => {
  it('confirms the workspace test runner is wired', () => {
    expect(2 + 2).toBe(4);
  });
});
