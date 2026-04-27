```skill
---
name: log-sanitization
description: Review logs/errors for sensitive data exposure and observability quality.
---

## What to check
1. **PII exposure**: names, emails, phone numbers, addresses, national IDs.
2. **Credentials**: tokens, API keys, passwords, connection strings.
3. **Business sensitive**: payment details, account numbers, health data.
4. **Stack traces**: internal file paths, dependency versions.

## Structured logging rules
- All logs must be JSON format.
- Required fields: `timestamp`, `level`, `correlationId`, `action`.
- Optional but recommended: `userId` (anonymized if needed), `duration`, `statusCode`.
- Use log levels correctly: ERROR for failures, WARN for degraded, INFO for business events, DEBUG for dev.

## Sanitization patterns
- Mask tokens: show only last 4 characters.
- Hash or omit PII fields.
- Never log full request/response bodies — log only safe fields.
- Never log `event` or `context` objects directly in Lambda handlers.
- Redact headers: `authorization`, `cookie`, `x-api-key`.

## Error handling
- Return generic messages to clients.
- Log full error details server-side with correlation ID.
- Do NOT include stack traces in API responses.
- Do NOT expose internal service names or paths.

## Review checklist
- [ ] No PII in log statements.
- [ ] No credentials in log statements.
- [ ] No full request/response bodies logged.
- [ ] Correlation ID present in all log lines.
- [ ] Error responses do not leak internals.
- [ ] Log levels used correctly.
```
