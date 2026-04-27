import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      '.serverless/**',
      'storybook-static/**',
      '.generated/**',
      '.turbo/**',
    ],
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        module: 'readonly',
        process: 'readonly',
      },
    },
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  // Import ordering
  {
    plugins: { 'import-x': importX },
    rules: {
      'import-x/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-duplicates': 'warn',
      // Circular dependency detection — complements eslint-plugin-boundaries layer enforcement
      'import-x/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
    },
  },
  // Unused imports auto-removal
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'unused-imports/no-unused-imports': 'warn',
    },
  },
  // React hooks rules (only for tsx files)
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // ── Architecture: DDD + Hexagonal (backend) ──────────────────────────────
  // Dependency rule: infrastructure → application → domain
  // Outer layers may import inner layers; inner layers NEVER import outer layers.
  {
    files: ['services/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'services/*/src/domain/**/*' },
        { type: 'application', pattern: 'services/*/src/application/**/*' },
        {
          type: 'infrastructure',
          pattern: 'services/*/src/infrastructure/**/*',
        },
        { type: 'shared-backend', pattern: 'services/*/src/shared/**/*' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            // domain: pure business logic — no framework/infra imports
            { from: { type: 'domain' }, allow: [{ to: { type: 'domain' } }] },
            // application: orchestrates domain, framework-agnostic
            {
              from: { type: 'application' },
              allow: [
                { to: { type: 'domain' } },
                { to: { type: 'application' } },
              ],
            },
            // infrastructure: the ONLY layer allowed to import AWS SDK + all inner layers
            {
              from: { type: 'infrastructure' },
              allow: [
                { to: { type: 'domain' } },
                { to: { type: 'application' } },
                { to: { type: 'infrastructure' } },
                { to: { type: 'shared-backend' } },
              ],
            },
            // shared: cross-cutting utilities; may reference domain errors (error-mapper)
            {
              from: { type: 'shared-backend' },
              allow: [
                { to: { type: 'domain' } },
                { to: { type: 'shared-backend' } },
              ],
            },
          ],
        },
      ],
    },
  },
  // ── Architecture: FSD — Feature-Sliced Design (frontend) ─────────────────
  // Features do NOT import from other features. Compose at page level.
  // shared/ui atoms/molecules/organisms do NOT import from features.
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/shared/ui/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'fsd-app', pattern: 'apps/web/src/app/**/*' },
        { type: 'fsd-features', pattern: 'apps/web/src/features/**/*' },
        { type: 'fsd-components', pattern: 'apps/web/src/components/**/*' },
        { type: 'fsd-shared-ui', pattern: 'packages/shared/ui/**/*' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            // app layer: composition root — can use all layers below
            {
              from: { type: 'fsd-app' },
              allow: [
                { to: { type: 'fsd-features' } },
                { to: { type: 'fsd-components' } },
                { to: { type: 'fsd-shared-ui' } },
              ],
            },
            // features: self-contained slices — CANNOT import other features
            {
              from: { type: 'fsd-features' },
              allow: [
                { to: { type: 'fsd-components' } },
                { to: { type: 'fsd-shared-ui' } },
              ],
            },
            // components (shared app-level): only design system
            {
              from: { type: 'fsd-components' },
              allow: [{ to: { type: 'fsd-shared-ui' } }],
            },
            // shared-ui design system: fully isolated — no feature/app imports
            {
              from: { type: 'fsd-shared-ui' },
              allow: [{ to: { type: 'fsd-shared-ui' } }],
            },
          ],
        },
      ],
    },
  },
);
