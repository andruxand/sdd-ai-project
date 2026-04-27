```skill
---
name: aws-well-architected-review
description: Review feature or architecture change against AWS Well-Architected and serverless guidance.
---

## Pillars to check

### 1. Operational Excellence
- Structured logging and tracing enabled.
- Runbook or operational docs updated.
- Monitoring and alerts defined.
- Deployment strategy supports rollback.

### 2. Security
- Least-privilege IAM (no wildcards without justification).
- Encryption at rest and in transit.
- Secrets in SSM/Secrets Manager (never in code or env vars in plaintext).
- API Gateway auth configured (Cognito, Lambda authorizer, API key).
- WAF rules reviewed for public endpoints.

### 3. Reliability
- Retry strategy with backoff for downstream calls.
- Dead-letter queues for async processing.
- Circuit breaker pattern for external dependencies.
- Idempotency for write operations.

### 4. Performance Efficiency
- Lambda memory/timeout tuned for workload.
- Cold start minimized (bundling, provisioned concurrency if needed).
- Connection reuse (keep-alive for HTTP, connection pooling for DB).
- Appropriate compute (Lambda vs Fargate vs Step Functions).

### 5. Cost Optimization
- Right-sized Lambda memory.
- Log retention configured (not infinite).
- Unused resources cleaned up.
- Reserved capacity vs on-demand decision documented.
- Lambda version accumulation controlled (`versionFunctions: false` or `serverless-prune-plugin`).
- Single shared deployment bucket per stage (not one bucket per service).

> For actionable implementation of the above: apply the `serverless-baseline` skill.

### 6. Sustainability
- Minimize unnecessary compute.
- Efficient data transfer patterns.

## Checklist
- [ ] IAM follows least privilege.
- [ ] No secrets in code.
- [ ] Retry + DLQ strategy defined for async flows.
- [ ] Logging and tracing enabled with sanitization.
- [ ] Lambda memory and timeout configured explicitly.
- [ ] Rollback strategy documented.
```
