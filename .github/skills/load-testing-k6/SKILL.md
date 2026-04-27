# Skill: load-testing-k6

> Source: Grafana k6 official documentation (grafana.com/docs/k6/latest)
> Type: **active** — loaded by `tester-backend` and `reviewer` agents

## Purpose

Provide k6-based load testing knowledge for Lambda/API Gateway backends. Covers test type taxonomy, thresholds as CI gate, phased stages, constant-arrival-rate executor, checks, GitHub Actions integration, and the k6 vs Artillery decision matrix.

---

## Test type taxonomy (official k6 taxonomy)

| Type             | Purpose                                                | Duration                |
| ---------------- | ------------------------------------------------------ | ----------------------- |
| **Smoke**        | Verify the script and system work with minimal load    | 1–5 min, 1–3 VUs        |
| **Average-load** | Typical production load ("day-in-life")                | 30–60 min               |
| **Stress**       | Above-average load to find the breaking point          | Ramp to 150–300% of avg |
| **Spike**        | Sudden surge, then rapid drop                          | 1–5 min spike           |
| **Soak**         | Sustained average load for reliability validation      | 4–24 hours              |
| **Breakpoint**   | Steadily increase until failure to find capacity limit | Until failure           |

**Rules:**

- Smoke test on every PR (fast, minimal VUs, no threshold breach is expected).
- Average-load test in pre-production before every release.
- Stress and spike tests on demand or in release candidates.
- Never run breakpoint tests against production.

---

## Threshold configuration (CI gate)

Thresholds are the pass/fail criteria. k6 exits with a non-zero exit code if any threshold fails — making them a natural CI gate.

```javascript
// tests/load/api-health.smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2,
  duration: '1m',
  thresholds: {
    // 95% of requests must complete under 200 ms
    http_req_duration: ['p(95)<200'],
    // Error rate must stay below 1%
    http_req_failed: ['rate<0.01'],
    // All checks must pass more than 99% of the time
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

**Threshold expression syntax:** `<aggregation_method> <operator> <value>`

| Method  | Applies to        | Example     |
| ------- | ----------------- | ----------- |
| `p(N)`  | Trend (durations) | `p(95)<200` |
| `avg`   | Trend             | `avg<150`   |
| `rate`  | Rate              | `rate<0.01` |
| `count` | Counter           | `count<100` |

**Multiple thresholds on one metric** (array, not repeated keys):

```javascript
http_req_duration: ['p(90)<400', 'p(95)<800', 'p(99.9)<2000'],
```

**Abort on threshold breach** (fail fast in CI):

```javascript
thresholds: {
  http_req_duration: [{ threshold: 'p(99)<10', abortOnFail: true, delayAbortEval: '10s' }],
},
```

---

## Average-load test with stages

```javascript
// tests/load/api-load.avg.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 }, // ramp-up: 1 → 50 VUs over 5 minutes
    { duration: '30m', target: 50 }, // steady: hold 50 VUs for 30 minutes
    { duration: '5m', target: 0 }, // ramp-down: 50 → 0 VUs
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/items`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Ramp-up duration guideline:** 5–15% of total test duration. This allows auto-scaling and provides a warm-up baseline for comparison.

---

## Constant arrival rate executor (request/s modeling)

Use `constant-arrival-rate` when you want to model a fixed RPS target regardless of response time.

```javascript
export const options = {
  scenarios: {
    api_load: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 20, // pre-allocate, k6 scales up if needed
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};
```

**When to use:**

- VU model → use `stages` when you want to simulate a number of concurrent users.
- RPS model → use `constant-arrival-rate` when you know the target throughput (e.g., 500 req/s).

---

## Data parameterization with SharedArray

```javascript
import { SharedArray } from 'k6/data';
import http from 'k6/http';

const users = new SharedArray('users', () => JSON.parse(open('./users.json')));

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  http.post(`${__ENV.BASE_URL}/login`, JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## Tag-specific thresholds

```javascript
export const options = {
  thresholds: {
    'http_req_duration{endpoint:items}': ['p(95)<200'],
    'http_req_duration{endpoint:auth}': ['p(95)<500'],
  },
};

// In default():
http.get(`${__ENV.BASE_URL}/api/items`, { tags: { endpoint: 'items' } });
```

---

## File structure convention

```
tests/
  load/
    *.smoke.js      → PR smoke tests (fast, cheap)
    *.avg.js        → Average-load, pre-release
    *.stress.js     → Stress, release candidates
    *.soak.js       → Manual / scheduled
    data/           → SharedArray JSON files
```

---

## GitHub Actions integration

```yaml
# .github/workflows/load-test.yml
name: Load test (smoke)
on:
  pull_request:

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - name: Run smoke test
        run: k6 run tests/load/api-health.smoke.js
        env:
          BASE_URL: ${{ secrets.STAGING_BASE_URL }}
        # k6 exits non-zero if any threshold fails → CI gate
```

For JSON output and CloudWatch integration:

```bash
k6 run --out json=result.json tests/load/api-load.avg.js
```

---

## k6 vs Artillery decision matrix

| Criteria                     | k6                         | Artillery                  |
| ---------------------------- | -------------------------- | -------------------------- |
| Language                     | JavaScript (ES modules)    | YAML + JS hooks            |
| Scripting flexibility        | High (full JS)             | Medium (YAML-first)        |
| CI integration               | Native (exit code)         | Via `ensure` plugin        |
| AWS Lambda direct invocation | Via custom plugin          | Built-in (HTTP)            |
| CloudWatch output            | Via k6-output plugin       | Via plugin                 |
| Protocol support             | HTTP, WebSocket, gRPC      | HTTP, WebSocket, Socket.IO |
| **Use when**                 | Complex scenarios, JS team | Quick HTTP YAML tests      |

**Recommendation for this stack:** Use k6 for all load tests. Its JavaScript model matches the codebase's TypeScript/JS expertise and its native threshold-as-CI-gate is superior to Artillery's `ensure` plugin for automation.

---

## Checks vs Thresholds

- **Checks** are assertions inside the script (`check(res, {...})`). They do NOT affect exit code alone.
- **Thresholds** on the `checks` metric make check failures block CI:
  ```javascript
  thresholds: {
    checks: ['rate>0.99'];
  }
  ```
- Combine both: checks for per-request assertions, thresholds on `checks` metric for CI gate.

---

## DO / DON'T

| ✅ DO                                      | ❌ DON'T                                         |
| ------------------------------------------ | ------------------------------------------------ |
| Define thresholds on every test file       | Run load tests without thresholds                |
| Use `BASE_URL` via `__ENV`                 | Hardcode URLs in scripts                         |
| Place load test data in `tests/load/data/` | Put sensitive data in load test fixtures         |
| Run smoke test on every PR                 | Run stress/breakpoint tests on production        |
| Use `SharedArray` for large datasets       | Load large JSON inside `default()` per iteration |
| Report `p(95)` and `p(99)`                 | Report only `avg` (misleading for tail latency)  |
