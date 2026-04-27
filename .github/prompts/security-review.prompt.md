---
name: security-review
description: Review code changes for security issues
agent: agent
---

## Security Review

Review the current changes for security issues. Focus on:

1. **Secrets exposure**: API keys, tokens, passwords, connection strings in code, logs, tests, comments, or fixtures.
2. **IAM permissions**: wildcard `*` permissions, provider-level IAM, overly broad resource ARNs.
3. **Input validation**: missing validation on path params, query params, headers, and body.
4. **Auth & AuthZ**: JWT validation (signature, expiration, issuer, audience), missing authorization checks.
5. **Injection vectors**: SQL, NoSQL, command injection, path traversal.
6. **Logging**: PII or tokens in logs, unstructured logging, missing sanitization.
7. **Error handling**: internal details leaked in error responses.
8. **Dependencies**: known vulnerabilities in new or updated dependencies.

### Output format

For each finding:

- **File**: affected file and line range
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Issue**: what's wrong
- **Fix**: recommended remediation

If no issues found, state: "No security issues detected in the current changes."

### References

- `docs/standards/aws-security.md`
- `.github/skills/log-sanitization/SKILL.md`
