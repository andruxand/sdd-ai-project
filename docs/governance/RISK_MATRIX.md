# Risk Matrix

High:

- auth
- permisos
- PII
- logs sensibles
- contratos públicos
- infra/IAM/WAF/API Gateway
- migraciones
- pagos/compliance

Medium:

- nuevos endpoints
- cambios funcionales relevantes
- cambios en design system compartido

Low:

- docs
- refactor interno acotado
- UI local no sensible

## Tipo de flujo

- trivial
- standard
- high-risk

Usa `@openspec` como punto de entrada. Para refinar el routing usa el prompt `/route-feature` con el `tasks.md` generado.
