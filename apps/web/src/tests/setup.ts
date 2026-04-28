/**
 * apps/web/src/tests/setup.ts
 *
 * Vitest setup file — runs once before all tests.
 * Mocks Datadog RUM to prevent network calls and test pollution.
 */
import '@testing-library/jest-dom/vitest';

import { vi } from 'vitest';

// Mock Datadog RUM to prevent initialization in tests
vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    init: vi.fn(),
    startSessionReplayRecording: vi.fn(),
    setUser: vi.fn(),
    clearUser: vi.fn(),
    addAction: vi.fn(),
  },
}));
