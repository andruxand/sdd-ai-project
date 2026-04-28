# Prompt — Mitigación gaps de seguridad en agentes especializados

Eres un agente de mejora del sistema SDD. Tu tarea es editar tres archivos de agente
para cerrar los gaps de seguridad identificados en DIG-123456 (sesión 2026-04-27).

Lee cada archivo con `read_file` antes de editarlo. No inventes contenido ni añadas
secciones fuera de las indicadas. Al terminar, corre `npm run validate` y
`node scripts/agent-lint.mjs` y reporta el resultado.

---

## GAP 1 — @openspec mezcla tareas de implementación y verificación en el mismo stream

**Archivo:** `.github/agents/openspec.agent.md`

**Sección a modificar:** `#### Rule: public endpoints always require infrastructure security tasks`

**Problema:** La regla actual genera sólo tareas "Verify X" y las pone en la sección Security
de tasks.md. Nadie tiene asignada la implementación de throttling y WAF.

**Cambio requerido:** Reemplazar el bloque completo de esa regla con el siguiente contenido:

```chatagent
#### Rule: public endpoints always require infrastructure security tasks

If the feature adds or modifies any endpoint **without** `security: [jwt]`
(i.e., public API Gateway endpoints), the following tasks are MANDATORY
**regardless of risk level**.

**`@security` verifies. `@backend-implementer` implements. Never mix these responsibilities.**

##### Tasks for the Backend stream (assigned to `@backend-implementer`)

Add these to the `## Backend` section of tasks.md:

- [ ] Add explicit throttling to `serverless.ts` for the HTTP API stage:
      `httpApi.throttling: { rateLimit: 100, burstLimit: 200 }`
      (adjust values per design.md § Security)
- [ ] Add `AWS::WAFv2::WebACL` CloudFormation resource with a
      `RateBasedStatement` (2000 req / 5 min) and associate it via
      `AWS::WAFv2::WebACLAssociation`

##### Tasks for the Security stream (assigned to `@security`)

Add these to the `## Security` section of tasks.md:

- [ ] Verify throttling is implemented in `serverless.ts` — confirm
      rate/burst values match design.md § Security
- [ ] Verify `AWS::WAFv2::WebACL` resource exists and is associated
      to the HTTP API stage
- [ ] Verify CORS origins are explicit (no wildcard) for the public endpoint

This rule applies even if the risk is `low`. WAF, throttling, and rate limiting
are infrastructure controls for every public endpoint, not only high-risk features.
```

---

## GAP 2 — @backend-implementer tiene checklist pasivo para throttling/WAF

**Archivo:** `.github/agents/backend-implementer.agent.md`

**Sección a modificar:** `## Exit checklist`

**Problema:** Las líneas actuales dicen `note in handoff if WAF rule change needed` — es pasivo.
El agente puede omitir la implementación y sólo documentar el gap.

**Cambio requerido:** Localizar y reemplazar estas dos líneas exactas:

```
- [ ] API Gateway throttling configured for any new/modified endpoint (rate, burst, quota).
- [ ] WAF coverage verified for any public endpoint — note in handoff if WAF rule change needed.
```

Con estas tres líneas:

```
- [ ] API Gateway throttling: if tasks.md includes a throttling task, confirm
      `httpApi.throttling` (or per-route equivalent) is present in `serverless.ts`.
      If missing: **implement it now**. DO NOT skip with a handoff note —
      implement or explicitly escalate to tech lead with written justification.
- [ ] WAF: if tasks.md includes a WAF task, confirm `AWS::WAFv2::WebACL` +
      `AWS::WAFv2::WebACLAssociation` resources exist in `serverless.ts`.
      If missing: **implement them now**. DO NOT skip with a handoff note —
      implement or explicitly escalate to tech lead with written justification.
- [ ] Cross-check every item marked **"Must configure"** in `design.md § Security`
      against `serverless.ts`. Any unimplemented item is a **blocking gap** —
      resolve before `/handoff`.
```

---

## GAP 3 — @security no genera tareas rutables para `approved-with-caveats`

**Archivo:** `.github/agents/security.agent.md`

**Sección a modificar:** Bloque que empieza con `` `blocked` means the change MUST NOT be merged ``

**Problema:** El bloque sólo define el flujo para `blocked`. Para `approved-with-caveats`
no hay instrucciones — los findings quedan en prosa sin owner ni merge condition.

**Cambio requerido:** Añadir DESPUÉS del bloque `blocked` (sin modificarlo) el siguiente
bloque nuevo:

```chatagent
`approved-with-caveats` means the change MAY be merged but every open finding
MUST be tracked as a concrete task.

1. For every caveat, generate one actionable task entry using this exact format:

   - [ ] [SEC-XX] <SEVERITY> — `<file or resource>` — <exact change required>
         Route to: @<agent-name>
         Merge condition: acceptable for non-prod / must-fix before prod

2. Add all caveat tasks to `openspec/changes/{change-id}/handoff.md` under a new
   section `## Hardening tasks — pending`. This section is consumed by `@reviewer`
   to include them in the PR description as a follow-up checklist.
3. Do NOT absorb caveats into prose. Every caveat = one tracked task with an
   explicit owner and merge condition.
```
