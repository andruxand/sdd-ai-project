---
name: observability-check
description: Check observability coverage in current changes
agent: agent
---

## Observability Check

Review the current changes for observability gaps. Focus on:

1. **Structured logging**: all logs must be JSON with `timestamp`, `level`, `correlationId`, `action`.
2. **Correlation IDs**: generated at entry point and propagated across calls.
3. **Tracing**: X-Ray or Datadog tracing enabled, custom subsegments for external calls.
4. **Metrics**: business-relevant custom metrics defined with alert thresholds.
5. **Sanitization**: no PII, tokens, or passwords in logs.
6. **Error logging**: errors logged with stack trace and context, not swallowed silently.
7. **Log retention**: `logRetentionInDays` configured in `serverless.ts`.

### Output format

For each gap:

- **File**: affected file and line range
- **Category**: Logging / Tracing / Metrics / Sanitization
- **Issue**: what's missing
- **Fix**: recommended remediation

If coverage is adequate, state: "Observability coverage is adequate for the current changes."

### References

- `docs/standards/aws-logging-observability.md`
- `.github/skills/observability-hardening/SKILL.md`
