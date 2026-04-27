# Jira source

- Jira key:
- Proposal reference:

## Architecture decisions

- Affected services/packages:
- New boundaries or modules:
- Rationale:

## Contracts

### REST (if applicable)

- New/changed endpoints:
- Request shape:
- Response shape:
- Breaking changes:

### GraphQL (if applicable)

- New/changed types or operations:
- Schema changes:
- Breaking changes:

## Data flow

- Input source:
- Processing:
- Output/storage:
- Async flows (queues, events):

## Security

> If ANY of the following fields are non-trivial, mark `risk=medium` or higher in the proposal — this triggers mandatory `@security` review.

- Auth mechanism: <!-- Cognito JWT / API key / none -->
- Permissions model: <!-- who can call this, at what scope -->
- PII handling: <!-- what fields are PII, where they go, what's masked -->
- Encryption needs: <!-- at-rest (DDB, S3), in-transit (HTTPS enforced) -->
- IAM changes: <!-- new roles, policies, resource-based policies -->
- API Gateway throttling: <!-- rate (req/s), burst, quota per stage/per-key -->
- WAF rules: <!-- are public endpoints behind WAF? new rules needed? -->
- CORS: <!-- origins allowed, exposed headers, preflight caching -->
- Attack surface: <!-- is this endpoint public/authenticated/internal? DDoS exposure? -->
- OWASP notes: <!-- any specific vectors to address (A01-A10) -->
- Security review required: <!-- yes / no — if yes, add @security task in tasks.md -->

## Observability

- Logs: key events to log:
- Traces: external calls to instrument:
- Metrics: business metrics to track:
- Alerts: thresholds to define:
- Sanitization: fields to mask/omit:

## Reliability & Error Handling

> Well-Architected Reliability pillar. Fill for any async flow, write operation, or external dependency.

- Expected errors and mapping:
- Retry strategy: <!-- exponential backoff? max attempts? -->
- Dead-letter / fallback: <!-- DLQ for SQS/SNS/EventBridge triggers? fallback behavior? -->
- Circuit breaker: <!-- external HTTP or third-party SDK calls that need fault isolation -->
- Idempotency: <!-- write operations (POST/PUT/PATCH) — idempotency key strategy -->

## Rollback

- Kill switch / feature flag:
- Revert path:
- Data implications:
- Coordination needed:

## Open questions

-
