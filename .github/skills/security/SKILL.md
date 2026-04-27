```skill
---
name: security
description: >
  Consolidated adversarial security review skill. Covers OWASP Top 10 (2021),
  API security (REST + GraphQL), AWS IAM/WAF/Cognito, frontend security
  (CSP, XSS, CSRF), secret hygiene, and CI/CD supply-chain hardening.
  Apply when risk ≥ medium, or the feature touches auth, PII, public endpoints,
  payments, IAM, WAF, or API Gateway.
---

## Source references

- OWASP Top 10 2021 — owasp.org/www-project-top-ten
- OWASP API Security Top 10 2023 — owasp.org/www-project-api-security
- AWS Security Best Practices — docs.aws.amazon.com/wellarchitected
- OWASP GraphQL Cheat Sheet — cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html

---

## 1. OWASP Top 10 (2021) — Lambda/Node.js checklist

| # | Category | Rule for this stack |
|---|---|---|
| A01 | Broken Access Control | Verify every Lambda handler checks authorization server-side. Never trust `isAdmin` or role claims from the client. Validate JWT claims with `aws-jwt-verify` before any privileged operation. |
| A02 | Cryptographic Failures | TLS enforced (API Gateway minimum TLS 1.2). DynamoDB tables encrypted at rest (`SSESpecification`). Secrets Manager for sensitive values — never SSM SecureString for secrets needing rotation. |
| A03 | Injection | All inputs validated with Zod before use. No AWS SDK expression building from raw user strings. Use ExpressionAttributeNames/Values for DynamoDB. |
| A04 | Insecure Design | Threat-model new endpoints: what happens if this input is 10 MB? What if called 10,000×/s? Rate limiting via API Gateway usage plans or WAF. |
| A05 | Security Misconfiguration | No wildcard IAM actions without documented justification. Lambda functions have individual IAM roles (not shared provider role). `serverless-offline` must NEVER be deployed to prod (`plugins` list guarded by stage). |
| A06 | Vulnerable & Outdated Components | `npm audit --audit-level=high` in CI (enforced). `dependency-review` GitHub Action on every PR. Pin GitHub Action versions to major tag (e.g. `@v4`). |
| A07 | Auth & Identity Failures | Cognito User Pools with SRP flow. `aws-jwt-verify` for offline validation — never decode-only. Token expiry ≤ 1 hour (access token). Refresh token rotation enabled in Cognito. |
| A08 | Software & Data Integrity | Signed commits recommended. `gitleaks` in CI for secret detection. Changesets for versioned releases. Never `npm install` in CI — use `npm ci`. |
| A09 | Logging & Monitoring Failures | Structured JSON logs via Powertools Logger. CloudTrail enabled per account. Alarm on 5XX spike, auth failure rate, and anomalous IAM calls. |
| A10 | SSRF | Never forward user-supplied URLs to internal AWS service calls or `fetch()`. Validate and allowlist destination domains for any outbound HTTP triggered by user input. |

---

## 2. OWASP API Security Top 10 (2023)

| # | Issue | Mitigation |
|---|---|---|
| API1 | Broken Object-Level Auth | Validate that the authenticated user owns the resource being accessed. Never rely on path parameters alone. |
| API2 | Broken Auth | All POST/PUT/PATCH/DELETE endpoints require a valid Cognito JWT. Read-only public endpoints may be unauthenticated but must be rate-limited. |
| API3 | Broken Object Property Level Auth | Never return entire DynamoDB items to the client. Whitelist fields in the response DTO. |
| API4 | Unrestricted Resource Consumption | API Gateway usage plans. Lambda reserved concurrency. SQS `maxReceiveCount` + DLQ. Request body size limit (API GW default 10 MB — lower for most endpoints). |
| API5 | Broken Function-Level Auth | Admin endpoints in a separate path prefix (`/admin/`) protected by a dedicated Lambda authorizer or Cognito group claim. |
| API6 | Unrestricted Access to Sensitive Business Flows | Rate-limit account creation, OTP verification, and payment initiation at WAF level (rule group with rate-based rule). |
| API7 | Server-Side Request Forgery | See A10 above. |
| API8 | Security Misconfiguration | CORS: allowOrigins must be an explicit list — never `'*'` for authenticated endpoints. |
| API9 | Improper Inventory Management | OpenAPI spec must exist and be up-to-date before endpoints go live. No undocumented endpoints in production. |
| API10 | Unsafe Consumption of APIs | Validate all responses from third-party APIs with Zod before processing. Use circuit breaker pattern. |

---

## 3. GraphQL security (OWASP GraphQL Cheat Sheet)

> Apply when the feature uses `packages/contracts/graphql/`.

| Risk | Mitigation |
|---|---|
| **Introspection in prod** | Disable introspection for non-admin requests in production. Apollo Server: `introspection: process.env.NODE_ENV !== 'production'`. |
| **Query depth attacks** | Enforce query depth limit (recommended ≤ 7). Use `graphql-depth-limit` or built-in Apollo Server `validationRules`. |
| **Query complexity attacks** | Assign complexity scores to fields. Reject queries exceeding a budget (e.g. 1000 points). Use `graphql-query-complexity`. |
| **Batching/alias amplification** | Limit query aliases and array batching. Enable `apolloBatchHttpLink` max batch size on the server. |
| **Authorization at resolver level** | Never rely solely on schema-level directives. Verify ownership inside every resolver that returns sensitive data. |
| **Error leakage** | In production, mask resolver errors: `formatError: (err) => ({ message: 'Internal error' })`. Log full error server-side. |
| **Persisted queries** | Use Automatic Persisted Queries (APQ) in production to prevent arbitrary query execution. |
| **Field-level rate limiting** | Rate-limit expensive fields (search, aggregations) separately from cheap fields. |

---

## 4. Frontend security (React + Vite)

| Area | Rule |
|---|---|
| **Content Security Policy** | Add `Content-Security-Policy` HTTP response header (via CloudFront response headers policy or `<meta>` tag). Disallow `unsafe-inline` scripts. |
| **XSS prevention** | Never use `dangerouslySetInnerHTML` with unsanitized input. If needed, sanitize with `DOMPurify`. |
| **Sensitive data in state** | Never store tokens, passwords, or PII in `localStorage`. Use memory state or `sessionStorage` for access tokens. Refresh tokens must be `httpOnly` cookies. |
| **HTTPS only** | `VITE_API_BASE_URL` must always be `https://` in non-local environments. Enforce in env var validation. |
| **Third-party scripts** | Datadog RUM and any analytics script must be reviewed for data collection scope. Include in CSP allowlist. |
| **Dependency supply chain** | `npm audit` in CI. `license-checker` for copyleft license flagging. |

---

## 5. AWS IAM / infrastructure hardening

```

Checklist:

- [ ] Each Lambda function has its own IAM execution role.
- [ ] Role allows only the specific DynamoDB table(s) and actions it needs.
- [ ] No `Resource: "*"` without documented justification in the PR.
- [ ] CloudFormation stack uses `DeletionPolicy: Retain` for stateful resources (DynamoDB, S3).
- [ ] S3 buckets: Block Public Access enabled, versioning enabled, server-side encryption enabled.
- [ ] API Gateway: request validation enabled (body + parameters).
- [ ] WAF WebACL attached to API Gateway stages for public endpoints.
- [ ] VPC Lambda functions use security groups with outbound rules restricted to required destinations.
- [ ] Secrets Manager secrets have rotation configured for credentials.
- [ ] CloudTrail enabled and log validation turned on.

```

---

## 6. CI/CD supply-chain security

| Control | Implementation |
|---|---|
| Secret scanning | `gitleaks` workflow on every PR and push. |
| Dependency vulnerabilities | `dependency-review` on PR + `npm audit --audit-level=high` in CI. |
| SAST | CodeQL analysis workflow (JavaScript/TypeScript). |
| IaC scanning | Checkov + cfn-lint + cfn-guard on CloudFormation/Serverless changes. |
| OSSF Scorecard | Runs weekly; reports to Security tab. |
| Action version pinning | All GitHub Actions pinned to major version tag (e.g. `@v4`). Never `@latest`. |

---

## 7. Security review checklist (complete before PR approval)

```

Authentication & Authorization

- [ ] JWT validated server-side with aws-jwt-verify (not decode-only).
- [ ] Every handler enforces ownership check (user can only access their own data).
- [ ] Admin endpoints use a separate Cognito group or Lambda authorizer.

Input & Output

- [ ] All inputs validated with Zod; unknown fields rejected.
- [ ] All error responses use generic messages (no stack traces, no internal paths).
- [ ] No PII in logs, trace annotations, or error responses.

Infrastructure

- [ ] IAM roles follow least privilege (no wildcards without justification).
- [ ] Secrets in Secrets Manager or SSM Parameter Store — not in env vars or code.
- [ ] CORS allowOrigins is an explicit list, not '\*'.
- [ ] Rate limiting configured at API Gateway or WAF level.

GraphQL (if applicable)

- [ ] Introspection disabled in production.
- [ ] Query depth limit enforced.
- [ ] Query complexity limit enforced.

Frontend (if applicable)

- [ ] No tokens in localStorage.
- [ ] No dangerouslySetInnerHTML with unsanitized input.
- [ ] CSP header configured.

Supply chain

- [ ] npm audit passes at --audit-level=high.
- [ ] No new dependency introduces a copyleft license.

```

```
