import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    passWithNoTests: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.stories.tsx',
        // React entry points — no unit-testable logic
        'src/main.tsx',
        'src/app/**/*',
        'src/app/index.tsx',
        // Types-only files
        'src/features/**/types.ts',
        'src/features/**/*-query-keys.ts',
        'src/features/**/index.ts',
        // Vite environment declarations
        'src/vite-env.d.ts',
        // RUM initialization — side-effectful infra module, integration tested
        'src/shared/monitoring/rum.ts',
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
