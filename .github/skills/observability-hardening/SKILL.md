```skill
---
name: observability-hardening
description: Improve logs, traces, metrics, and sanitization.
---

## Context
Platforms: AWS Lambda Powertools (default) + CloudWatch. Datadog optional replace.
Stack: AWS Lambda + Node.js/TypeScript.
Mandatory: `@aws-lambda-powertools/logger`, `@aws-lambda-powertools/tracer`, `@aws-lambda-powertools/metrics`.
Frontend: `@datadog/browser-rum` for end-to-end trace correlation.

## Three pillars
### Logs
- Use `@aws-lambda-powertools/logger` — never `console.log`.
- Initialize: `new Logger({ serviceName: process.env.SERVICE_NAME })`.
- Apply `injectLambdaContext` Middy middleware for automatic context injection.
- Required field per call: `action`. Recommended: `correlationId`, `userId` (hashed), `duration`.
- JSON format, structured fields, sanitized (no PII, no tokens, no full payloads).
- CloudWatch log groups with `logRetentionInDays: 30` minimum.

### Traces
- Use `@aws-lambda-powertools/tracer` — never raw `aws-xray-sdk`.
- Initialize: `new Tracer({ serviceName: process.env.SERVICE_NAME })`.
- Apply `captureLambdaHandler` Middy middleware.
- Capture external calls: `tracer.captureAWSv3Client(client)`, `tracer.captureHTTPsGlobal(https)`.
- Annotations: IDs and status codes only (never PII). Use `putMetadata` for sanitized response data.
- If Datadog: `dd-trace` + `datadog-lambda-js` instead; disable X-Ray in `serverless.ts`.
- Frontend→Backend trace: Datadog RUM propagates `x-datadog-trace-id` automatically to `allowedTracingUrls`.

### Metrics
- Use `@aws-lambda-powertools/metrics` — never manual CloudWatch PutMetricData.
- Initialize: `new Metrics({ namespace: process.env.METRICS_NAMESPACE, serviceName })`.
- Apply `logMetrics` Middy middleware for automatic flush.
- Business metrics with dimensions (`env`, `service`, `feature`).
- Every metric MUST have an alarm or monitor.

## Implementation checklist
- [ ] Structured JSON logging in place.
- [ ] Correlation ID generated at entry point and propagated.
- [ ] X-Ray or Datadog tracing enabled.
- [ ] Custom subsegments for external service calls.
- [ ] No sensitive data in logs or trace metadata.
- [ ] CloudWatch log retention configured.
- [ ] Business metrics identified and instrumented.
- [ ] Alerts defined for critical thresholds.

## Anti-patterns
- Do NOT use `console.log` — use Powertools Logger.
- Do NOT log everything (cost + noise).
- Do NOT skip tracing (overhead is minimal).
- Do NOT create metrics without alerts.
- Do NOT annotate PII in traces.
```
