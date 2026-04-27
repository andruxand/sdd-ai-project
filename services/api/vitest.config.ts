import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        // Pure singleton initialization — no testable logic
        'src/shared/observability.ts',
      ],
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
