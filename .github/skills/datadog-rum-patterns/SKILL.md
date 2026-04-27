````skill
---
name: datadog-rum-patterns
description: Datadog Browser RUM (@datadog/browser-rum) — init pattern, mandatory privacy controls, sessionReplay setup, user enrichment/cleanup, custom actions, VITE env vars, backend trace correlation, and test isolation. Mandatory for every frontend app.
type: always-active
agents: [frontend-implementer, tester-frontend, observability-implementer]
---

## Package

```bash
npm install @datadog/browser-rum
````

---

## Initialization module

Create one module per app. Never import in test environments.

```typescript
// apps/web/src/shared/monitoring/rum.ts

import { datadogRum } from '@datadog/browser-rum';

const ALLOWED_STAGES = ['production', 'staging'] as const;
type AllowedStage = (typeof ALLOWED_STAGES)[number];

const stage = import.meta.env.VITE_STAGE as string | undefined;

// ✅ Do NOT initialize in test, development, or CI environments
export function initRum(): void {
  if (!stage || !(ALLOWED_STAGES as readonly string[]).includes(stage)) return;

  datadogRum.init({
    applicationId: import.meta.env.VITE_DATADOG_APP_ID ?? '',
    clientToken: import.meta.env.VITE_DATADOG_CLIENT_TOKEN ?? '',
    site: 'datadoghq.com',
    service: import.meta.env.VITE_SERVICE_NAME ?? 'web',
    env: stage,
    version: import.meta.env.VITE_APP_VERSION ?? '0.0.0',
    sessionSampleRate: 100,
    // ✅ Session replay: 20% in production, 0 in staging
    sessionReplaySampleRate: stage === 'production' ? 20 : 0,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    // ✅ MANDATORY: mask user inputs to prevent capturing passwords, card numbers, etc.
    defaultPrivacyLevel: 'mask-user-input',
    // ✅ Restrict distributed tracing to your own API Gateway only
    allowedTracingUrls: [
      import.meta.env.VITE_API_BASE_URL ?? '',
      // Add more origins if needed — never use a wildcard regex
    ],
  });

  // ✅ Start session replay only in production after init
  if (stage === 'production') {
    datadogRum.startSessionReplayRecording();
  }
}
```

**Call once at app entry point:**

```typescript
// apps/web/src/main.tsx
import React    from 'react';
import ReactDOM from 'react-dom/client';
import { initRum } from '@/shared/monitoring/rum';
import { App }  from './App';

initRum(); // ← before React renders

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

---

## VITE environment variables

```dotenv
# .env.production
VITE_DATADOG_APP_ID=<applicationId from Datadog RUM app>
VITE_DATADOG_CLIENT_TOKEN=<clientToken — NOT secret, safe for browser>
VITE_SERVICE_NAME=my-app
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=https://api.my-domain.com
VITE_STAGE=production
```

```dotenv
# .env.staging
VITE_DATADOG_APP_ID=<staging applicationId>
VITE_DATADOG_CLIENT_TOKEN=<staging clientToken>
VITE_SERVICE_NAME=my-app
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=https://staging-api.my-domain.com
VITE_STAGE=staging
```

```dotenv
# .env.development (and CI — no Datadog init)
VITE_STAGE=development
```

> `clientToken` is NOT a secret — it is scoped to a specific Datadog org and has no write access to metrics. It can be in source control as a VITE env var.
> `applicationId` is also non-sensitive.
> Never commit `VITE_DATADOG_APP_ID` or `VITE_DATADOG_CLIENT_TOKEN` pointing to production if they differ from what is in `.env.production.example`. Use CI/CD secrets injection.

---

## User enrichment — post-auth

```typescript
// apps/web/src/features/auth/hooks/use-auth-session.ts
import { datadogRum } from '@datadog/browser-rum';
import { hashUserId } from '@/shared/utils/hash'; // SHA-256 of userId, NOT email

export function enrichRumUser(user: { id: string; role: string }): void {
  datadogRum.setUser({
    id: hashUserId(user.id), // ✅ Hashed — not PII
    role: user.role, // ✅ Safe attribute (not email, not phone)
    // ❌ Never: email: user.email (PII)
    // ❌ Never: phone: user.phone (PII)
    // ❌ Never: name: user.displayName (PII)
  });
}

export function clearRumUser(): void {
  datadogRum.clearUser(); // ✅ Call on logout
}
```

**Integration points:**

- Call `enrichRumUser()` after a successful Cognito login flow (inside the auth callback handler).
- Call `clearRumUser()` in the logout handler, before redirecting.
- Do NOT call from within a React component render cycle — call in event handlers or async flows.

---

## Custom actions

```typescript
import { datadogRum } from '@datadog/browser-rum';

// ✅ Track meaningful user actions with anonymized payload
datadogRum.addAction('checkout_started', {
  itemCount: cart.items.length,
  totalCents: cart.totalCents, // monetary value — not PII
  // ❌ Never: userEmail, addressLine, cardLast4
});

datadogRum.addAction('filter_applied', {
  filterType: filter.type,
  resultCount: results.length,
});

// ✅ Track feature flag exposures for analysis
datadogRum.addAction('feature_flag_evaluated', {
  flag: flagName,
  variant: variant,
});
```

---

## Backend trace correlation

Datadog RUM injects the following headers on requests to `allowedTracingUrls`:

- `x-datadog-trace-id`
- `x-datadog-parent-id`
- `x-datadog-sampling-priority`

Your API Gateway / Lambda backend must propagate these headers for correlated traces.

```typescript
// In Lambda handler (backend):
const traceId = event.headers?.['x-datadog-trace-id'];
if (traceId) {
  logger.appendKeys({ ddTraceId: traceId }); // ← adds to every log line in this invocation
}
```

---

## Privacy controls summary

| Data type            | Allowed in RUM | Action                                             |
| -------------------- | -------------- | -------------------------------------------------- |
| User ID (hashed)     | ✅             | `setUser({ id: hashedId })`                        |
| User role            | ✅             | `setUser({ role })`                                |
| Cart item count      | ✅             | `addAction()`                                      |
| Total amount (cents) | ✅             | `addAction()`                                      |
| Email / phone        | ❌             | Never — anonymize first                            |
| Name / address       | ❌             | Never — strip before logging                       |
| Passwords / tokens   | ❌             | Masked by `defaultPrivacyLevel: 'mask-user-input'` |
| Credit card numbers  | ❌             | Masked by `defaultPrivacyLevel: 'mask-user-input'` |

---

## Testing — prevent RUM init in tests

```typescript
// apps/web/src/tests/setup.ts (setupFiles in vitest.config.ts)

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    init: vi.fn(),
    startSessionReplayRecording: vi.fn(),
    setUser: vi.fn(),
    clearUser: vi.fn(),
    addAction: vi.fn(),
  },
}));
```

```typescript
// vitest.config.ts — ensure setup file is loaded
export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup.ts'],
  },
});
```

**Why this is mandatory:** If RUM is not mocked in tests it attempts a network call to `datadoghq.com` on every test run. This makes tests slow, non-deterministic, and leaks test data to Datadog.

---

## Anti-patterns

| Anti-pattern                                       | Problem                                      | Fix                                             |
| -------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `datadogRum.init()` without `ALLOWED_STAGES` guard | Sends data from dev/CI to Datadog            | Wrap in env check                               |
| `allowedTracingUrls: [/.*/]`                       | Leaks trace headers to third-party APIs      | Explicitly list own origins only                |
| `setUser({ email: user.email })`                   | PII in Datadog SaaS                          | Use hashed ID only                              |
| `sessionReplaySampleRate: 100` in prod             | Full replay captures everything              | Use 20% in prod, 0 in staging                   |
| Not mocking in tests                               | Network calls, test pollution, Datadog noise | Mock in `setupFiles`                            |
| `startSessionReplayRecording()` in staging         | Unnecessary cost + data exposure             | Only in production                              |
| Calling `initRum()` inside a React component       | Re-initializes on re-render                  | Call in `main.tsx` before `ReactDOM.createRoot` |
| Logging `user.email` in `addAction`                | PII in RUM                                   | Use non-PII attributes only                     |

---

## Checklist

- [ ] `initRum()` called once in `main.tsx`, before React renders.
- [ ] Init guarded by `ALLOWED_STAGES` — does not run in development/test/CI.
- [ ] `defaultPrivacyLevel: 'mask-user-input'` set.
- [ ] `allowedTracingUrls` lists only own API origins.
- [ ] `sessionReplaySampleRate: 20` in production, `0` in staging.
- [ ] `startSessionReplayRecording()` called only in production.
- [ ] `setUser()` called post-auth with hashed ID and non-PII attributes only.
- [ ] `clearUser()` called on logout.
- [ ] All `addAction()` calls use anonymized data.
- [ ] Backend Lambda propagates `x-datadog-trace-id` to logger.
- [ ] `@datadog/browser-rum` fully mocked in `vitest` setupFiles.
- [ ] VITE env vars documented in `.env.*.example` (no real values committed).

```

```
