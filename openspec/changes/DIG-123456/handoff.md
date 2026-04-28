# Handoff

- Change ID: DIG-123456
- Fecha: 2026-04-27
- Fase completada: Security Review
- Fase siguiente: Review (@reviewer) → PR body

## Objetivo del cambio

Public health check endpoint `GET /health` — `{ status, version, timestamp }` — para monitoring
y ops dashboards. Fullstack: contracts + backend + frontend + observability + tests + E2E + security.

## Archivos clave

- Backend: `services/api/src/application/use-cases/health/getHealth.ts`, `services/api/src/infrastructure/http/handlers/health/getHealth.ts`, `services/api/serverless.ts`
- Frontend: `apps/web/src/features/health/`, `apps/web/src/app/theme.ts`, `apps/web/src/shared/monitoring/rum.ts`
- Contracts: `packages/contracts/rest/openapi.yaml`
- Types: `apps/web/src/types/vitest-axe.d.ts`, `apps/web/src/types/vitest-matchers.d.ts`

## Estado actual

**Completado ✅:**

- Contracts, Backend, Frontend, Observability
- Backend tests: 26 — 100% cov
- Frontend tests: 28 — 98% cov
- E2E: 28 tests × 4 browsers — 28/28 passing
- Security: APPROVED WITH CAVEATS (SEC-01, SEC-02 — non-blocking)
- `npm run validate`: ✅ 0 errors
- `npm audit --audit-level=high`: ✅ 0 high/critical

**Pendiente:**

- PR review + PR body (@reviewer)

## Riesgos abiertos

- 🟡 **SEC-01 MEDIUM** — `serverless.ts` no define `throttling` explícito en HTTP API stage. AWS default (10k req/s) cubre el caso base. Resolver en sprint siguiente.
- 🟡 **SEC-02 MEDIUM** — No hay `AWS::WAFv2::WebACL` en IaC. Endpoint stateless/read-only — CW alarms actúan como detection layer. Resolver en sprint siguiente.

## Hardening tasks — pending

- [ ] [SEC-01] MEDIUM — `services/api/serverless.ts` — añadir `httpApi.throttling: { rateLimit: 100, burstLimit: 200 }`
      Route to: @backend-implementer | Merge condition: must-fix before prod
- [ ] [SEC-02] MEDIUM — `services/api/serverless.ts` — añadir `AWS::WAFv2::WebACL` con `RateBasedStatement` (2000 req/5min) + `AWS::WAFv2::WebACLAssociation`
      Route to: @backend-implementer | Merge condition: must-fix before prod

## Cómo validar

```bash
nvm use
npm run validate                                          # 0 errors
cd apps/web && npx vitest run                             # 28 unit tests
cd apps/web && npx playwright test e2e/health.spec.ts     # 28 E2E tests
```

## Decisiones tomadas

- **TypeScript augmentation**: `vitest-matchers.d.ts` como MODULE (con `export {}`) para que `declare module 'vitest'` sea merge y no reemplazo. `vitest-axe.d.ts` se mantiene ambient (stubs de subpaths sin exports map).
- **Color contrast**: `palette.{color}.dark` sobre fondos `{color}1a` — cumple WCAG AA. `palette.main` falla (ratio 2.82).
- **E2E loading**: promise latch en route handler. Stop/restore: `page.reload()` + route swap.
- **Security**: SEC-01/SEC-02 aceptados para merge. Throttling default AWS (10k req/s) + CW alarms = cobertura base suficiente para non-prod.
