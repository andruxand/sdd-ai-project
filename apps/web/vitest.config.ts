import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.stories.tsx',
        // Empty scaffold placeholder — no testable exports
        'src/features/**',
        // React entry points — no unit-testable logic
        'src/main.tsx',
        'src/app/**/*',
        'src/app/index.tsx',
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
