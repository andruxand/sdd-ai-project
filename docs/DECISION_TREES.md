# Decision Trees

Guía rápida para elegir prompts y agentes sin adivinar.

## 1) ¿Cómo arranco un cambio?

```text
¿Tienes un spec aprobado en openspec/changes/?
  ├─ No → empieza aquí: @openspec (siempre, sin excepción)
  └─ Sí → abre Copilot Chat, escribe /resume-phase y continúa en la fase que corresponde

¿El cambio es trivial (1 archivo, <1 hora, no toca contratos ni auth)?
  ├─ Sí → @openspec (intake rápido, sin design completo) → implementer especializado → @reviewer
  └─ No  → flujo completo (ver AGENTS.md o árbol de abajo)
```

## 2) ¿Qué flujo sigo según mi perfil?

```text
¿Cuál es tu perfil activo? (cat .generated/active-profile.yaml | grep scope)

  backend-only:
    @openspec → [@contracts-implementer] → @backend-implementer
    → [@observability-implementer] → @tester-backend → [@security] → @reviewer

  frontend-only:
    @openspec → @frontend-implementer → @tester-frontend → [@e2e-tester] → @reviewer

  fullstack:
    @openspec → @contracts-implementer → @backend-implementer → @frontend-implementer
    → @observability-implementer → @tester-backend → @tester-frontend
    → [@e2e-tester] → [@security] → @reviewer

Los corchetes [ ] son condicionales: se usan solo si el spec lo requiere.
Cada → es una sesión nueva: /handoff al terminar, /resume-phase al empezar la siguiente.
```

## 3) ¿Qué agente implementa?

```text
¿El feature toca contratos (agrega o modifica un endpoint)?
  ├─ Sí → @contracts-implementer PRIMERO (antes que el backend)
  └─ No → sigue con el stream que corresponda

¿Es backend (handlers, servicios, base de datos, infra)?
  └─ Sí → @backend-implementer

¿Es frontend (componentes React, UI, Storybook)?
  └─ Sí → @frontend-implementer

¿Es observabilidad (logs, trazas, métricas)?
  └─ Sí → @observability-implementer
```

## 4) ¿Qué agente prueba?

```text
¿El stream fue backend?
  └─ Sí → @tester-backend

¿El stream fue frontend?
  └─ Sí → @tester-frontend

¿Necesitas validar un flujo de usuario completo de inicio a fin?
  └─ Sí → @e2e-tester (requiere que el perfil tenga playwright activo)
```

## 5) ¿Cuándo invoco `@security`?

Invócalo si aplica uno o más:

- auth, permisos, IAM, JWT, API keys
- PII o datos sensibles
- cambios en WAF/API Gateway/retries
- cambios de contrato que puedan exponer información

## 6) ¿Cuándo corto sesión?

```text
¿Terminaste una fase (spec/impl/test/review)?
  ├─ Sí → /handoff y abre sesión nueva con /resume-phase
  └─ No
      ¿El agente repite errores y ya corregiste 2 veces?
        ├─ Sí → corta sesión, /handoff y reintenta en sesión limpia
        └─ No → continúa en la misma sesión
```

## 7) ¿Qué hago si falla algo?

- Setup/CLI/VS Code: `docs/onboarding/TROUBLESHOOTING.md`
- Flujo Copilot/agentes/sesiones: `docs/runbooks/HOW_TO_USE_VSCODE_COPILOT.md`
- Seguridad/calidad: `docs/runbooks/SECURITY_AND_QUALITY_CHECKLIST.md`
