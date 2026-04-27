# AWS Logging and Observability

## Tooling defaults

- **Backend logging**: `@aws-lambda-powertools/logger` (mandatory).
- **Backend tracing**: `@aws-lambda-powertools/tracer` (mandatory).
- **Backend metrics**: `@aws-lambda-powertools/metrics` (CloudWatch EMF, mandatory).
- **Idempotency**: `@aws-lambda-powertools/idempotency` for non-idempotent mutations.
- **Frontend observability**: Datadog RUM (`@datadog/browser-rum`) — traces, errors, session replay.
- Do NOT use raw `console.log` or `aws-xray-sdk` directly — always go through Powertools or Datadog.

## Structured logging (Powertools Logger)

- Initialize once per handler: `const logger = new Logger({ serviceName: process.env.SERVICE_NAME })`.
- Auto-injected fields: `timestamp`, `level`, `cold_start`, `service`, `xray_trace_id`.
- Required per call: `action` (describe what the code is doing).
- Recommended: `userId` (anonymized/hashed), `duration`, `statusCode`, `correlationId`.
- Log levels: `ERROR` (failures), `WARN` (degraded), `INFO` (business events), `DEBUG` (dev only).
- Use `injectLambdaContext` Middy middleware to auto-inject Lambda context into every log line.

## Correlation IDs

- Append at entry: `logger.appendKeys({ correlationId: event.requestContext?.requestId ?? uuidv4() })`.
- Propagate downstream via HTTP header `X-Correlation-ID` and SQS attribute `correlationId`.
- Powertools injects `xray_trace_id` automatically — do not duplicate manually.
- **Frontend→Backend**: Datadog RUM injects `x-datadog-trace-id` and `x-datadog-parent-id` on
  fetch/XHR to `allowedTracingUrls` — preserve through API Gateway and Lambda.

## Tracing (Powertools Tracer)

- Initialize: `const tracer = new Tracer({ serviceName: process.env.SERVICE_NAME })`.
- Use `captureLambdaHandler` Middy middleware to auto-capture the handler segment.
- Custom annotations: `tracer.putAnnotation('orderId', id)`.
- Custom metadata: `tracer.putMetadata('response', sanitizedResponse)`.
- Capture external calls: `tracer.captureAWSv3Client(dynamoClient)`, `tracer.captureHTTPsGlobal(https)`.
- If Datadog: use `dd-trace` + `datadog-lambda-js` instead; disable X-Ray in `serverless.ts`.
- Never annotate PII — annotate IDs and status codes only.

## Datadog RUM (frontend)

- Initialize in app shell (`apps/web/src/app/`) on app startup.
- Required init props: `applicationId`, `clientToken` (from env vars VITE*DD*\*), `env`, `version`.
- Set `defaultPrivacyLevel: 'mask-user-input'` always.
- Set `allowedTracingUrls` to match your API Gateway domains only — never wildcard.
- `sessionReplaySampleRate: 20` in production; `0` in all other envs.
- Call `startSessionReplayRecording()` only in production and after explicit user consent.
- Post-auth: `datadogRum.setUser({ id: hashedUserId, email: maskedEmail })`.
- On logout: `datadogRum.clearUser()`.
- Custom actions: `datadogRum.addAction('order_placed', { orderId, currency })` — anonymized IDs only.
- NEVER include PII, raw tokens, or session secrets in RUM custom attributes.
- Do NOT initialize RUM in test or local environments.

## Metrics (Powertools Metrics)

- Initialize: `const metrics = new Metrics({ namespace, serviceName })` from env vars.
- Use `logMetrics` Middy middleware to flush at handler end — avoids manual flush calls.
- Standard per handler: `FunctionInvocationsCount`, `FunctionErrorsCount`, `FunctionDuration`.
- Business metrics with dimensions (`env`, `service`, `feature`): e.g. `OrdersCreated`, `PaymentsProcessed`.
- Every metric MUST have a CloudWatch alarm or Datadog monitor with threshold and notification.

## Sanitization

- NEVER log: PII, tokens, passwords, API keys, full request/response bodies.
- Mask tokens: show only last 4 chars.
- Redact headers: `authorization`, `cookie`, `x-api-key`, `x-api-secret`.
- Never log `event` or `context` objects directly — extract only safe fields.

## CloudWatch configuration

- `logRetentionInDays: 30` minimum in `serverless.ts`.
- Create log groups explicitly with custom retention when needed.
- Enable metric filters for ERROR level patterns.

## Anti-patterns

- Do NOT use `console.log` or `console.error` — always use Powertools Logger.
- Do NOT log everything (cost and noise).
- Do NOT create metrics without alarms.
- Do NOT skip tracing — Powertools overhead is under 1ms on warm instances.
- Do NOT hardcode `applicationId` or `clientToken` — always from env vars.
- Do NOT initialize Datadog RUM in test environments.

## Checklist

- [ ] Powertools Logger initialized with `serviceName` env var.
- [ ] `injectLambdaContext` Middy middleware applied.
- [ ] Correlation ID appended at handler entry.
- [ ] Powertools Tracer initialized and `captureLambdaHandler` applied.
- [ ] External calls captured via Tracer.
- [ ] Powertools Metrics initialized, `logMetrics` applied.
- [ ] No sensitive data in logs, traces, or RUM attributes.
- [ ] Log retention configured.
- [ ] Business metrics with alarms defined.
- [ ] Datadog RUM initialized (frontend, if applicable).
- [ ] `allowedTracingUrls` scoped to API domains only.
