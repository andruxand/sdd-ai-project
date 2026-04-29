# Jira source

- Jira key: DIG-123456
- Jira URL: (provided by developer)
- Related docs: n/a
- Related prior delivery: n/a

## Why

- Business problem: Need infrastructure-level health check endpoint to verify service availability and version deployed
- User problem: Operations team needs a quick way to verify service health in monitoring dashboards (Datadog, CloudWatch, etc.) without authentication
- Desired outcome: Public health check endpoint returning service status, version, and timestamp that can be polled by monitoring systems

## Scope

- In:
  - REST endpoint GET /health (public, no auth)
  - Backend handler and use case returning status/version/timestamp
  - Structured logging per request (requestId, status, duration)
  - Frontend component with 30s polling and visual states (ok/degraded/error)
  - Storybook stories for all three states
  - OpenAPI schema update
- Out:
  - Database connectivity checks (no DB dependencies)
  - External service health checks (AWS SDK, third-party APIs)
  - Authentication/authorization
  - PII or sensitive data handling
  - Feature flags or gradual rollout (low risk, all-or-nothing deployment)

## Impact

- Backend: New handler in services/api, new use case getHealth.ts
- Frontend: New feature/health/ module with <HealthStatus /> component, React Query integration
- REST: New GET /health endpoint in openapi.yaml
- GraphQL: No impact
- Design system: No impact (uses existing UI primitives)
- Logs/traces/metrics: Structured log per request, basic CloudWatch metrics for latency
- Security/auth/permissions: Public endpoint (no JWT), requires API Gateway throttling and WAF review
- Infra/AWS/serverless/WAF/IAM: Public endpoint → must verify throttling and WAF rules

## Risks

- Functional: Low — stateless endpoint, no business logic, no external dependencies
- Security: **Medium** — public endpoint without authentication exposes infrastructure information (version, status). Risk mitigated by:
  - API Gateway throttling (rate limit per IP)
  - WAF rate-based rule
  - No sensitive data in response (version is public, status is generic)
- Contract: Low — new endpoint, no breaking changes
- Operational: Low — simple handler, fast response, no DB or external calls

## Rollback

- Kill switch / feature flag: Not required (low risk)
- Revert path: Remove handler from serverless.ts, redeploy. Frontend will gracefully handle 404 (shows error state)
- Data implications: None (no writes, no persistence)
