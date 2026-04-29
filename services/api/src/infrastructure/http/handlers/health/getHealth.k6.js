/* eslint-disable no-undef */
/**
 * k6 smoke test for GET /health endpoint
 *
 * Prerequisites:
 *   - Install k6: brew install k6 (macOS) or https://k6.io/docs/get-started/installation/
 *   - Backend must be running (npm run dev in services/api)
 *
 * Run locally:
 *   k6 run services/api/src/infrastructure/http/handlers/health/getHealth.k6.js
 *
 * Run against deployed environment:
 *   API_BASE_URL=https://api.dev.example.com k6 run services/api/src/infrastructure/http/handlers/health/getHealth.k6.js
 *
 * Thresholds (CI gate):
 *   - p(95) < 200ms — 95th percentile latency under 200 milliseconds
 *   - error rate < 1% — less than 1% of requests fail
 *   - 100% availability — all health checks succeed
 *
 * Note: Full integration testing with Middy middleware is covered by k6 rather than
 * mocking Powertools + custom middleware in unit tests, which is brittle and complex.
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

// Load API base URL from environment or default to local
const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = `${API_BASE_URL}/health`;

export const options = {
  // Smoke test: minimal load, short duration
  stages: [
    { duration: '10s', target: 5 }, // Ramp up to 5 VUs over 10s
    { duration: '20s', target: 5 }, // Stay at 5 VUs for 20s
    { duration: '10s', target: 0 }, // Ramp down to 0
  ],

  // Thresholds: CI fails if any threshold is breached
  thresholds: {
    // p95 latency must be below 200ms
    'http_req_duration{endpoint:health}': ['p(95)<200'],

    // Error rate must be below 1%
    'http_req_failed{endpoint:health}': ['rate<0.01'],

    // All requests should succeed (100% availability)
    'checks{check:status_200}': ['rate==1'],
    'checks{check:has_status}': ['rate==1'],
    'checks{check:has_version}': ['rate==1'],
    'checks{check:has_timestamp}': ['rate==1'],
    'checks{check:valid_iso8601}': ['rate==1'],
  },
};

export default function () {
  const response = http.get(HEALTH_ENDPOINT, {
    tags: { endpoint: 'health' },
  });

  // Validate response
  const checkResults = check(
    response,
    {
      status_200: (r) => r.status === 200,
      has_status: (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status !== undefined;
        } catch {
          return false;
        }
      },
      has_version: (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.version !== undefined;
        } catch {
          return false;
        }
      },
      has_timestamp: (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.timestamp !== undefined;
        } catch {
          return false;
        }
      },
      valid_iso8601: (r) => {
        try {
          const body = JSON.parse(r.body);
          const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
          return iso8601Regex.test(body.timestamp);
        } catch {
          return false;
        }
      },
      content_type_json: (r) =>
        r.headers['Content-Type']?.includes('application/json'),
    },
    { check: 'health_check' },
  );

  if (!checkResults) {
    console.error(`Health check failed: ${response.status} ${response.body}`);
  }

  // Small delay between requests (not needed for health endpoint but good practice)
  sleep(0.5);
}

/**
 * Setup function - runs once before the test
 */
export function setup() {
  console.log(`Starting k6 smoke test for ${HEALTH_ENDPOINT}`);
  console.log('Test duration: 40s (10s ramp-up, 20s steady, 10s ramp-down)');
  console.log('Target VUs: 5');
  console.log('Thresholds: p95<200ms, error rate<1%, 100% availability');
}

/**
 * Teardown function - runs once after the test
 */
export function teardown() {
  console.log('k6 smoke test completed');
}
