# Jira source

- Jira key: DIG-123456
- Proposal reference: openspec/changes/DIG-123456/proposal.md

## Architecture decisions

- Affected services/packages:
  - `services/api` — new handler `src/handlers/health/getHealth.ts`
  - `services/api` — new use case `src/use-cases/health/getHealth.ts`
  - `packages/contracts/rest` — openapi.yaml update
  - `apps/web/src/features/health` — new React feature module
- New boundaries or modules:
  - `health` domain — new use case namespace (stateless, no repository)
- Rationale:
  - Health check is infrastructure-level concern, not business domain
  - No database layer needed (version from process.env)
  - React Query polling aligns with existing frontend data-fetching patterns

## Contracts

### REST (if applicable)

- New/changed endpoints:
  ```
  GET /health
  ```
- Request shape: None (no query params, no body)
- Response shape:
  ```json
  {
    "status": "ok" | "degraded",
    "version": "1.2.3",
    "timestamp": "2026-04-27T10:30:00.000Z"
  }
  ```
- Breaking changes: None (new endpoint)

### GraphQL (if applicable)

- N/A

## Data flow

- Input source: HTTP GET request from monitoring tool or frontend component
- Processing:
  1. API Gateway receives request
  2. Lambda handler invokes getHealth use case
  3. Use case reads `process.env.APP_VERSION` (explicitly injected by Serverless Framework via `${file(./package.json):version}`) with fallback to `process.env.npm_package_version` and then `'unknown'`
     > **Deviation from original design:** The original design relied on `npm_package_version` being injected by npm at runtime. In practice, `serverless offline` spawns Lambda handlers in a child process where npm does not inject that variable. To ensure the version is always available in all environments (local offline, deployed Lambda), `APP_VERSION` is now declared explicitly in the `provider.environment` block of `serverless.ts` and becomes the primary source.
  4. Use case returns { status: "ok", version, timestamp: ISO 8601 }
  5. Handler logs structured event (requestId, status, durationMs)
  6. Handler returns 200 with JSON response
- Output/storage: None (no persistence)
- Async flows (queues, events): None

## Security

- Auth mechanism: None — public endpoint
- Permissions model: Public access, no authorization checks
- PII handling: None — no user data
- Encryption needs: HTTPS enforced by API Gateway (standard)
- IAM changes: None — handler uses existing Lambda execution role
- API Gateway throttling: **Must configure** — inherit stage-level throttling: 100 req/s rate, 200 burst (or verify custom per-endpoint limit)
- WAF rules: **Must verify** — public endpoint must be behind WAF with rate-based rule (e.g., block IP after 2000 req/5min)
- CORS: **Must configure** — allow frontend origin (https://app.example.com), expose headers: `Content-Type`, preflight cache 86400s
- Attack surface: Public endpoint → DDoS risk mitigated by throttling + WAF. Response exposes version string (acceptable for health checks)
- OWASP notes:
  - A01 (Broken Access Control): N/A — intentionally public
  - A05 (Security Misconfiguration): Mitigated by throttling + WAF
  - A09 (Security Logging Failures): Structured log captures all requests
- Security review required: **Yes** — public endpoint added, must verify WAF and throttling configuration

## Observability

- Logs: key events to log:
  - Request received: `{ event: "health_check_request", requestId, httpMethod, path }`
  - Response sent: `{ event: "health_check_response", requestId, statusCode, durationMs, version }`
- Traces: external calls to instrument:
  - None (no external dependencies)
- Metrics: business metrics to track:
  - CloudWatch custom metric: `HealthCheck.Latency` (milliseconds, avg/p50/p95/p99)
  - CloudWatch custom metric: `HealthCheck.Requests` (count, per minute)
- Alerts: thresholds to define:
  - Error rate > 5% in 5 minutes → SNS alert
  - p95 latency > 200ms in 5 minutes → SNS alert (health check should be <50ms typically)
- Sanitization: fields to mask/omit:
  - None (no sensitive data)

## Reliability & Error Handling

- Expected errors and mapping:
  - None expected (stateless, no external calls)
  - If `process.env.npm_package_version` is missing → return `"unknown"` as version
- Retry strategy: N/A (no retryable operations)
- Dead-letter / fallback: N/A (not async)
- Circuit breaker: N/A (no external dependencies)
- Idempotency: Naturally idempotent (GET request, no side effects)

## Rollback

- Kill switch / feature flag: Not required (low functional risk)
- Revert path: Remove handler from `serverless.ts`, redeploy stack
- Data implications: None (no writes, no persistence)
- Coordination needed: None (frontend gracefully handles 404)

## Open questions

- None
