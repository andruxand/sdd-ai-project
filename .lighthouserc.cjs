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
        'no-vulnerable-libraries': 'off', // auditRan=0 false-positive in preview build
        'csp-xss': 'warn',

        // Performance budget
        'total-byte-weight': ['warn', { maxNumericValue: 500000 }], // 500 KB
        'unused-javascript': ['warn', { maxNumericValue: 100000 }], // 100 KB unused JS
        'render-blocking-resources': 'warn',
        'uses-optimized-images': 'warn',
        'uses-responsive-images': 'warn',
        'uses-text-compression': 'error',

        // Disable audits that produce NaN scores (not applicable to this SPA),
        // fire because the preview build points to a stub API URL,
        // or require infrastructure not part of the SPA bundle (robots.txt, CDN).
        'lcp-lazy-loaded': 'off',
        'errors-in-console': 'off',
        'non-composited-animations': 'off', // NaN — no animations in this build
        'prioritize-lcp-image': 'off', // NaN — no image LCP candidate
        'robots-txt': 'off', // robots.txt served by CDN/infra, not SPA
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
