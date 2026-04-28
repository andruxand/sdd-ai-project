/**
 * Lighthouse CI configuration.
 * Budgets enforce performance baselines on every PR.
 * Adjust thresholds per product requirements — do not relax without team agreement.
 */
module.exports = {
  ci: {
    collect: {
      // Build the app and serve it locally for audit
      startServerCommand: 'npm run preview --workspace=apps/web',
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 30000,
      url: ['http://localhost:4173/'],
      numberOfRuns: 3,
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        // Core Web Vitals — budget per Google's "Good" thresholds
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Core Web Vitals individual metrics
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        interactive: ['warn', { maxNumericValue: 3500 }],

        // Security & best practices
        'is-on-https': 'off', // local serve is HTTP
        'uses-http2': 'off', // local serve
        'no-vulnerable-libraries': 'error',
        'csp-xss': 'warn',

        // Performance budget
        'total-byte-weight': ['warn', { maxNumericValue: 500000 }], // 500 KB
        'unused-javascript': ['warn', { maxNumericValue: 100000 }], // 100 KB unused JS
        'render-blocking-resources': 'warn',
        'uses-optimized-images': 'warn',
        'uses-responsive-images': 'warn',
        'uses-text-compression': 'error',

        // Disable audits that produce NaN scores (not applicable to this SPA)
        // or that fire because the preview build points to a stub API URL.
        'lcp-lazy-loaded': 'off',
        'errors-in-console': 'off',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
